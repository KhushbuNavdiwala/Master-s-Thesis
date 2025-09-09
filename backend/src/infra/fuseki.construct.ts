import { FUSEKI_SPARQL, GRAPH_IRI } from "./fuseki.config.ts";

class FusekiError extends Error {
  constructor(
    msg: string,
    public details: { endpoint: string; status?: number; bodyPreview?: string; graphIri?: string; hint?: string }
  ) {
    super(msg);
    this.name = "FusekiError";
  }
}

/** Returns raw Turtle (string). Great for smoke tests or loading into N3. */
export async function runConstruct(
  constructQuery: string,
  opts?: { endpoint?: string; graphIri?: string }
): Promise<string> {
  const endpoint = opts?.endpoint ?? FUSEKI_SPARQL;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "text/turtle" },
    body: new URLSearchParams({ query: constructQuery, format: "text/turtle" }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new FusekiError(
      `CONSTRUCT failed with ${res.status} ${res.statusText}`,
      {
        endpoint,
        status: res.status,
        bodyPreview: text.slice(0, 500),
        graphIri: opts?.graphIri,
        hint: "Check dataset URL and query syntax. If using GRAPH, verify GRAPH_IRI exists.",
      }
    );
  }
  if (!text.trim()) {
    throw new FusekiError("CONSTRUCT returned empty Turtle.", {
      endpoint,
      graphIri: opts?.graphIri,
      hint: "Graph may be empty or your CONSTRUCT pattern didn’t match. Try a bare { ?s ?p ?o } in the same GRAPH.",
    });
  }
  return text;
}

/** Convenience smoke-test: fetch a few triples from the named graph. */
export async function smokeTestGraph(graphIri = GRAPH_IRI) {
  const query = graphIri
    ? `CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <${graphIri}> { ?s ?p ?o } } LIMIT 5`
    : `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 5`;
  return runConstruct(query, { graphIri });
}
