import { FUSEKI_SPARQL, FUSEKI_QUERY, GRAPH_IRI } from "./fuseki.config.js";

type Binding = Record<string, { type: string; value: string }>;
type SparqlJson = { head: { vars: string[] }; results: { bindings: Binding[] } };

class FusekiError extends Error {
  constructor(
    msg: string,
    public details: {
      endpoint: string;
      status?: number;
      bodyPreview?: string;
      graphIri?: string;
      hint?: string;
    }
  ) {
    super(msg);
    this.name = "FusekiError";
  }
}

async function postJSON(endpoint: string, body: URLSearchParams, graphIri?: string) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new FusekiError(
      `SPARQL endpoint returned ${res.status} ${res.statusText}`,
      {
        endpoint,
        status: res.status,
        bodyPreview: text.slice(0, 500),
        graphIri,
        hint:
          res.status === 404
            ? "Check dataset name (FUSEKI_URL) and that /sparql endpoint exists."
            : "See bodyPreview for Fuseki error text.",
      }
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new FusekiError("Failed to parse SPARQL JSON response.", {
      endpoint,
      bodyPreview: text.slice(0, 500),
      graphIri,
      hint: "Ensure you are calling a /sparql or /query endpoint with Accept JSON.",
    });
  }
}

export async function runSelect<T = Record<string, string>>(
  query: string,
  opts?: { endpoint?: string; graphIri?: string }
): Promise<T[]> {
  const endpoint = opts?.endpoint ?? FUSEKI_SPARQL;
  const json = (await postJSON(
    endpoint,
    new URLSearchParams({ query, format: "application/sparql-results+json" }),
    opts?.graphIri
  )) as SparqlJson;

  const rows = json.results?.bindings ?? [];
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v.value;
    return out as T;
  });
}

/** Quick GET-friendly SELECT (some Fuseki setups allow /query?query=...) */
export async function runSelectGET<T = Record<string, string>>(
  query: string,
  opts?: { endpoint?: string; graphIri?: string }
) {
  const endpoint = (opts?.endpoint ?? FUSEKI_QUERY) + `?query=${encodeURIComponent(query)}`;
  const res = await fetch(endpoint, { headers: { Accept: "application/sparql-results+json" } });
  const text = await res.text();
  if (!res.ok) {
    throw new FusekiError(`GET /query failed with ${res.status}`, {
      endpoint,
      status: res.status,
      bodyPreview: text.slice(0, 500),
      graphIri: opts?.graphIri,
      hint: "Your Fuseki may not expose /query; prefer POST to /sparql.",
    });
  }
  try {
    const json = JSON.parse(text) as SparqlJson;
    const rows = json.results?.bindings ?? [];
    return rows.map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) out[k] = v.value;
      return out as T;
    });
  } catch {
    throw new FusekiError("Failed to parse GET /query JSON.", {
      endpoint,
      bodyPreview: text.slice(0, 500),
      graphIri: opts?.graphIri,
    });
  }
}

/** High-level helper that explains common “no data” cases clearly. */
export async function safeSelect<T = Record<string, string>>(query: string, graphIri = GRAPH_IRI) {
  try {
    const rows = await runSelect<T>(query, { graphIri });
    if (rows.length > 0) return rows;

    // empty result → figure out why
    // 1) does the graph exist and have any triples?
    const { askGraphHasAnyTriple, selectGraphTripleCount } =
      await import("../domain/movies/movie.queries.js");

    const [hasAny] = await runSelect<{ ask: string }>(
      `SELECT (IF(${askGraphHasAnyTriple(graphIri)}, "true", "false") AS ?ask)`,
      { graphIri }
    );

    if (hasAny?.ask === "true") {
      // graph has triples but not matching pattern
      const [{ triples }] =
        await runSelect<{ triples: string }>(selectGraphTripleCount(graphIri), { graphIri });
      throw new FusekiError("Query returned 0 rows, but the named graph has data.", {
        endpoint: FUSEKI_SPARQL,
        graphIri,
        hint:
          `Triples in graph: ${triples}. Likely your SELECT pattern is too specific (e.g., schema:name missing). ` +
          `Try a simpler query or verify predicates in your data.`,
      });
    } else {
      throw new FusekiError("The named graph does not exist or is empty.", {
        endpoint: FUSEKI_SPARQL,
        graphIri,
        hint:
          "Verify GRAPH_IRI and that you loaded data into this *named* graph. " +
          "In Fuseki UI → Dataset → Graphs → check the graph list.",
      });
    }
  } catch (e: any) {
    if (e instanceof FusekiError) throw e;
    throw new FusekiError("Unexpected error during SELECT.", {
      endpoint: FUSEKI_SPARQL,
      graphIri,
      hint: String(e?.message ?? e),
    });
  }
}
