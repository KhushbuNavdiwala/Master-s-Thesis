// backend/src/infra/sparql.ts
import { FUSEKI_QUERY } from "./fuseki.config.ts";

export class SparqlError extends Error {
  constructor(
    msg: string,
    public details?: { endpoint?: string; status?: number; body?: string }
  ) {
    super(msg);
    this.name = "SparqlError";
  }
}

export async function runSelect(query: string, defaultGraphIri?: string) {
  if (!FUSEKI_QUERY) {
    throw new SparqlError("FUSEKI_QUERY is not configured (check fuseki.config.ts / .env)");
  }
  if (!query?.trim()) {
    throw new SparqlError("Empty SPARQL query provided to runSelect()");
  }

  const params = new URLSearchParams();
  params.set("query", query);
  if (defaultGraphIri?.trim()) params.set("default-graph-uri", defaultGraphIri.trim());

  const res = await fetch(FUSEKI_QUERY, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/sparql-results+json",
    },
    body: params.toString(),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new SparqlError(
      `Fuseki SELECT failed: ${res.status} ${res.statusText}`,
      { endpoint: FUSEKI_QUERY, status: res.status, body: text.slice(0, 800) }
    );
  }

  try {
    return JSON.parse(text) as {
      head: { vars: string[] };
      results: { bindings: Record<string, { type: string; value: string }> [] };
    };
  } catch (e: any) {
    throw new SparqlError("Failed to parse SPARQL JSON response from Fuseki.", {
      endpoint: FUSEKI_QUERY,
      body: text.slice(0, 800),
    });
  }
}
