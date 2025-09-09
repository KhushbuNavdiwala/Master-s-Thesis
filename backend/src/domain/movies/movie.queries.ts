// backend/src/domain/movies/movies.queries.ts

import fs from "node:fs";
import path from "node:path";

const COMPILED_SELECT_PATH = path.resolve(
  process.cwd(), "backend", "src", "domain", "shex", "compiled", "movie.select.rq"
);
const COMPILED_CONSTRUCT_PATH = path.resolve(
  process.cwd(), "backend", "src", "domain", "shex", "compiled", "movie.construct.rq"
);

export type CompiledQuery = { text: string; kind: "SELECT" | "CONSTRUCT" };

export function loadCompiledMovieQuery(): CompiledQuery {
  if (fs.existsSync(COMPILED_SELECT_PATH)) {
    const q = fs.readFileSync(COMPILED_SELECT_PATH, "utf8");
    if (!q.trim()) throw new Error(`Compiled SELECT is empty at ${COMPILED_SELECT_PATH}`);
    return { text: q, kind: "SELECT" };
  }
  if (fs.existsSync(COMPILED_CONSTRUCT_PATH)) {
    const q = fs.readFileSync(COMPILED_CONSTRUCT_PATH, "utf8");
    if (!q.trim()) throw new Error(`Compiled CONSTRUCT is empty at ${COMPILED_CONSTRUCT_PATH}`);
    return { text: q, kind: "CONSTRUCT" };
  }
  throw new Error(
    `No compiled query found. Expected one of:\n` +
    ` - ${COMPILED_SELECT_PATH}\n` +
    ` - ${COMPILED_CONSTRUCT_PATH}\n` +
    `Run the ShEx compile step.`
  );
}

/**
 * Simple hand-written fallback/query for quick testing.
 * Prefer the compiled query in production.
 */
export function selectMoviesBasic(
  limit = 25,
  offset = 0,
  graphIri?: string,
) {
  const GRAPH_OPEN = graphIri ? `GRAPH <${graphIri}> {` : "";
  const GRAPH_CLOSE = graphIri ? `}` : "";
  return `
PREFIX schema: <http://schema.org/>
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?movie ?name ?date ?director ?directorName
WHERE {
  ${GRAPH_OPEN}
    ?movie a schema:Movie .
    OPTIONAL { ?movie schema:name ?name }
    OPTIONAL { ?movie rdfs:label  ?name }
    OPTIONAL { ?movie schema:datePublished ?date }
    OPTIONAL {
      ?movie schema:director ?director .
      OPTIONAL { ?director schema:name ?directorName }
    }
  ${GRAPH_CLOSE}
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}

export function constructWholeGraph(
  limit?: number,
  offset?: number,
  graphIri?: string,
) {
  const PAGE = limit != null ? `LIMIT ${limit} OFFSET ${offset ?? 0}` : "";
  if (graphIri) {
    return `
CONSTRUCT { ?s ?p ?o }
WHERE     { GRAPH <${graphIri}> { ?s ?p ?o } }
${PAGE}`.trim();
  }
  return `
CONSTRUCT { ?s ?p ?o }
WHERE     { ?s ?p ?o }
${PAGE}`.trim();
}

export function askGraphHasAnyTriple(graphIri: string) {
  return `
ASK { GRAPH <${graphIri}> { ?s ?p ?o } }
`.trim();
}

export function selectGraphTripleCount(graphIri?: string) {
  const GRAPH_OPEN = graphIri ? `GRAPH <${graphIri}> {` : "";
  const GRAPH_CLOSE = graphIri ? `}` : "";
  return `
SELECT (COUNT(*) AS ?triples)
WHERE { ${GRAPH_OPEN} ?s ?p ?o . ${GRAPH_CLOSE} }
`.trim();
}
