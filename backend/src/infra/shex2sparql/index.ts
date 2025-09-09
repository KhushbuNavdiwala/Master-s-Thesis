// ESM/TypeScript module
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SparqlType = "SELECT" | "CONSTRUCT" | "ASK";

export interface CompileOpts {
  schemaPath: string;     // e.g. "backend/src/domain/shex/movie.shex"
  start: string;          // e.g. "Movie"
  type: SparqlType;       // "SELECT" | "CONSTRUCT" | "ASK"
  shex2sparqlMainPath?: string; // optional override to the main.js
}

export interface RunOpts {
  fusekiUrl: string;      // e.g. "http://localhost:3030/Movies_2008"
  query: string;
  type?: SparqlType;
  accept?: string;        // override Accept header if needed
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Try a few likely locations for the ShEX2SPARQL CLI's main.js.
 * You can override via CompileOpts.shex2sparqlMainPath or env SHEX2SPARQL_MAIN.
 */
async function locateShEx2SparqlMain(userHint?: string): Promise<string> {
  const candidates = [
    userHint,
    process.env.SHEX2SPARQL_MAIN,
    // project-root/shex2sparql/src/main.js  (from backend/src/infra/shex2sparql/*)
    path.resolve(__dirname, "../../..", "../../..", "shex2sparql", "src", "main.js"),
    // monorepo-ish fallback: ../../../shex2sparql/src/main.js
    path.resolve(__dirname, "../../..", "shex2sparql", "src", "main.js"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      await access(p!);
      return p!;
    } catch { /* keep searching */ }
  }

  throw new Error(
    "Cannot find ShEX2SPARQL main.js. " +
    "Set SHEX2SPARQL_MAIN or pass CompileOpts.shex2sparqlMainPath, " +
    "or clone the repo to ./shex2sparql (so ./shex2sparql/src/main.js exists)."
  );
}

/**
 * Compile a ShEx shape to SPARQL by invoking the ShEX2SPARQL CLI.
 * Returns the SPARQL query text.
 */
export async function shex2sparql(opts: CompileOpts): Promise<string> {
  const { schemaPath, start, type } = opts;
  const mainJs = await locateShEx2SparqlMain(opts.shex2sparqlMainPath);

  // map type to CLI flag
  const typeFlag = type.toUpperCase();
  if (!["SELECT", "CONSTRUCT", "ASK"].includes(typeFlag)) {
    throw new Error(`Unsupported SPARQL type: ${type}`);
  }

  // The CLI accepts: node main.js --schema <.shex> --start <Shape> --type SELECT|CONSTRUCT|ASK
  const args = [
    mainJs,
    "--schema", path.resolve(schemaPath),
    "--start", start,
    "--type", typeFlag,
  ];

  const query = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.toString());
      } else {
        reject(new Error(`shex2sparql failed (code ${code}).\n${stderr || stdout}`));
      }
    });
  });

  return query.trim();
}

/**
 * (Optional) Wrap a query's WHERE { ... } with GRAPH <iri> { ... } if not already present.
 * This is a heuristic; it expects a single top-level WHERE block.
 */
export function withGraph(query: string, graphIri?: string): string {
  if (!graphIri) return query;
  // naive check — skip if GRAPH already present
  if (/GRAPH\s*<[^>]+>\s*\{/.test(query)) return query;

  // inject GRAPH just inside the first WHERE {
  return query.replace(
    /WHERE\s*\{/i,
    (m) => `${m}\n  GRAPH <${graphIri}> {\n`
  ).replace(
    /\}\s*$/s,
    (m) => `\n  }\n${m}`
  );
}

/**
 * Run a SPARQL query against Fuseki.
 * - SELECT returns JSON
 * - CONSTRUCT/ASK returns text (Turtle/N-Triples for CONSTRUCT, boolean/text for ASK)
 */
export async function runAgainstFuseki(opts: RunOpts): Promise<unknown> {
  const { fusekiUrl, query } = opts;
  const type: SparqlType = (opts.type ?? "SELECT").toUpperCase() as SparqlType;

  const isSelect = type === "SELECT";
  const endpoint = isSelect ? `${fusekiUrl}/query` : `${fusekiUrl}/query`; // same endpoint for queries
  const accept =
    opts.accept ??
    (isSelect ? "application/sparql-results+json" : "text/turtle,application/n-triples,application/ld+json;q=0.8,*/*;q=0.1");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query; charset=utf-8",
      "Accept": accept,
    },
    body: query,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fuseki error ${res.status}: ${res.statusText}\n${text}`);
  }

  if (isSelect) {
    return res.json();
  }
  // CONSTRUCT / ASK — return as plain text (caller can decide)
  return res.text();
}

/**
 * Convenience: compile ShEx → SPARQL → optionally wrap GRAPH → run.
 */
export async function compileAndRun(params: {
  schemaPath: string;
  start: string;
  type: SparqlType;
  graphIri?: string;
  fusekiUrl: string;
  limit?: number;
  offset?: number;
}): Promise<unknown> {
  let q = await shex2sparql({
    schemaPath: params.schemaPath,
    start: params.start,
    type: params.type,
  });

  // Add LIMIT/OFFSET if SELECT and not already present.
  if (params.type === "SELECT") {
    const hasLimit = /\bLIMIT\b/i.test(q);
    const hasOffset = /\bOFFSET\b/i.test(q);
    if (params.limit != null && !hasLimit) q += `\nLIMIT ${params.limit}`;
    if (params.offset != null && !hasOffset) q += `\nOFFSET ${params.offset}`;
  }

  q = withGraph(q, params.graphIri);

  return runAgainstFuseki({
    fusekiUrl: params.fusekiUrl,
    query: q,
    type: params.type,
  });
}
