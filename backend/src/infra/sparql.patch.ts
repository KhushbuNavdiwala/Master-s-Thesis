// backend/src/infra/sparql.patch.ts
const WHERE_RX = /\bWHERE\s*\{/i;

// very conservative: drops FILTERs that explicitly reference xsd:*
// (these are the ones that usually zero results when data is loose)
const STRICT_XSD_FILTER_RX = /FILTER\s*\([^)]*xsd:\w+[^)]*\)\s*\.\s*/gi;

// detect if query already contains a GRAPH block for this IRI
function hasGraphBlock(q: string, graphIri: string): boolean {
  const rx = new RegExp(`GRAPH\\s*<${graphIri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>`, "i");
  return rx.test(q);
}

// Turn a CONSTRUCT query into a SELECT DISTINCT * while keeping the WHERE { ... } intact
function forceSelectStar(q: string): string {
  const whereIdx = q.search(WHERE_RX);
  if (whereIdx < 0) return q; // nothing to do
  const wherePart = q.slice(whereIdx); // "WHERE { ... } ..."
  return `SELECT DISTINCT * ${wherePart}`;
}

// Inject GRAPH <iri> immediately after WHERE { … }
function injectGraph(q: string, graphIri: string): string {
  const m = WHERE_RX.exec(q);
  if (!m) return q;

  const start = m.index + m[0].length; // position just after "WHERE {"
  // If already has the graph block, skip
  if (hasGraphBlock(q, graphIri)) return q;

  // Insert `GRAPH <iri> {` after WHERE {  … and add a balancing `}` before the WHERE's closing `}`
  // We find the matching closing brace of the WHERE block (simple brace counter).
  let i = start;
  let depth = 1;
  while (i < q.length && depth > 0) {
    const ch = q[i++];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth !== 0) return q; // malformed—leave it untouched

  const whereOpenToEnd = q.slice(start, i - 1);     // content inside WHERE { ... }
  const restAfterWhere = q.slice(i - 1);            // closing } and beyond

  const wrapped =
    ` GRAPH <${graphIri}> {` +
    whereOpenToEnd +
    ` }`;

  return q.slice(0, start) + wrapped + restAfterWhere;
}

// Drop strict datatype filters that often kill results
function dropStrictDatatypeFilters(q: string): string {
  return q.replace(STRICT_XSD_FILTER_RX, "");
}

/**
 * Patch a ShEX2SPARQL-emitted query so it works robustly at runtime.
 * - Always injects your named graph into WHERE { … }
 * - Drops strict xsd:* FILTERs
 * - If the file looks like a CONSTRUCT query, it switches header to SELECT DISTINCT *
 */
export function patchSparqlRuntime(original: string, graphIri: string): string {
  let q = original;

  // If it "looks like CONSTRUCT", normalize to SELECT DISTINCT *
  if (/^\s*CONSTRUCT\b/i.test(q)) {
    q = forceSelectStar(q);
  }

  // Drop strict datatype filters (xsd:date, xsd:string, etc.)
  q = dropStrictDatatypeFilters(q);

  // Inject GRAPH <...> into WHERE
  q = injectGraph(q, graphIri);

  return q;
}
