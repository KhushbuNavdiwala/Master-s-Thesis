// backend/src/infra/fuseki.ts
// Loads triples from Fuseki into your in-memory dataset (getDataset()) using paged CONSTRUCT.
// Parses N-Triples and assigns a graph to every quad if graphIri is provided.

import { Parser as N3Parser, Quad } from "n3";
import { DataFactory } from "n3";
import { getDataset } from "./ldo.ts";
import { FUSEKI_SPARQL, FUSEKI_GRAPH } from "./fuseki.config.ts";

const { namedNode, quad } = DataFactory;

export type FusekiConfig = {
  endpointUrl?: string;  // if omitted, uses FUSEKI_SPARQL from config
  graphIri?: string;     // named graph to read from and assign to
  pageSize?: number;     // triples per page
  maxPages?: number;     // safety stop
  verbose?: boolean;     // log progress
};

class FusekiError extends Error {
  constructor(
    msg: string,
    public details: { endpoint: string; status?: number; bodyPreview?: string; hint?: string }
  ) {
    super(msg);
    this.name = "FusekiError";
  }
}

function buildConstructQuery(graphIri?: string, limit = 5000, offset = 0) {
  const WHERE = graphIri && graphIri.trim()
    ? `WHERE { GRAPH <${graphIri}> { ?s ?p ?o } }`
    : `WHERE { ?s ?p ?o }`;
  // Note: we keep CONSTRUCT without GRAPH and assign graph on insert.
  return `CONSTRUCT { ?s ?p ?o } ${WHERE} LIMIT ${limit} OFFSET ${offset}`;
}

async function fetchConstructNTriples(query: string, endpoint: string): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/n-triples",
    },
    body: new URLSearchParams({ query, format: "application/n-triples" }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new FusekiError(`CONSTRUCT failed with ${res.status} ${res.statusText}`, {
      endpoint,
      status: res.status,
      bodyPreview: text.slice(0, 500),
      hint: "Check dataset /sparql URL and graph IRI.",
    });
  }
  return text;
}

function addPageToDataset(ntriples: string, assignGraph?: string): number {
  const ds = getDataset();
  const parser = new N3Parser({ format: "N-Triples" });
  let count = 0;
  for (const q of parser.parse(ntriples) as Quad[]) {
    const g = assignGraph ? namedNode(assignGraph) : q.graph;
    ds.add(quad(q.subject, q.predicate, q.object, g));
    count++;
  }
  return count;
}

/** Load triples from Fuseki into memory in pages. Returns total added quads. */
export async function loadGraphFromFuseki(cfg: FusekiConfig): Promise<number> {
  const endpoint = (cfg.endpointUrl?.replace(/\/+$/, "") || FUSEKI_SPARQL).toString();
  const graphIri = (cfg.graphIri ?? FUSEKI_GRAPH)?.trim();
  const pageSize = cfg.pageSize ?? 5000;
  const maxPages = cfg.maxPages ?? 50;
  const verbose  = cfg.verbose ?? true;

  if (verbose) {
    console.log(`[Fuseki Loader] endpoint=${endpoint} graph=${graphIri || "(default)"} pageSize=${pageSize} maxPages=${maxPages}`);
  }

  let total = 0;
  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const query = buildConstructQuery(graphIri, pageSize, offset);

    const ntriples = await fetchConstructNTriples(query, endpoint);
    if (!ntriples.trim()) {
      if (verbose) console.log(`[Fuseki Loader] Page ${page} empty; stop.`);
      break;
    }

    const added = addPageToDataset(ntriples, graphIri || undefined);
    if (verbose) console.log(`[Fuseki Loader] Page ${page} added ${added} triples.`);
    total += added;

    if (added < pageSize) {
      if (verbose) console.log(`[Fuseki Loader] Last page detected; stop.`);
      break;
    }
  }

  if (verbose) console.log(`[Fuseki Loader] Done. Total added: ${total}.`);
  return total;
}
