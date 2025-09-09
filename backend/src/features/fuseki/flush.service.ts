// src/features/fuseki/flush.service.ts
import { Writer as N3Writer, DataFactory } from "n3";
import type { Quad as RdfQuad, NamedNode } from "@rdfjs/types";
import { getDataset } from "../../infra/ldo.ts";
import { FUSEKI_DATA, FUSEKI_GRAPH } from "../../infra/fuseki.config.ts";

const { namedNode } = DataFactory;

export type FlushResult = {
  ok: boolean;
  endpoint: string;
  graphIri: string;
  triplesUploaded: number;
  bytes: number;
};

/**
 * Serialize the in-memory quads of a named graph as N-Triples (triples only).
 * Note: For GSP PUT to /data?graph=..., the graph name is conveyed in the URL,
 * so the payload must be triples (no graph component).
 */
export async function serializeGraphToNTriples(
  graphIri: string
): Promise<{ ntriples: string; count: number }> {
  const ds = getDataset();
  const g: NamedNode = namedNode(graphIri);
  const writer = new N3Writer({ format: "N-Triples" });

  let count = 0;
  for (const q of ds.match(null, null, null, g) as Iterable<RdfQuad>) {
    writer.addQuad(q.subject, q.predicate, q.object);
    count++;
  }

  const ntriples: string = await new Promise((resolve, reject) => {
    writer.end((err, result) => {
      if (err) return reject(err);
      resolve(result ?? "");
    });
  });

  return { ntriples, count };
}

export async function putGraphToFuseki(
  graphIri = FUSEKI_GRAPH,
  endpointBase = FUSEKI_DATA
): Promise<FlushResult> {
  const { ntriples, count } = await serializeGraphToNTriples(graphIri);
  const target = `${endpointBase}?graph=${encodeURIComponent(graphIri)}`;

  const res = await fetch(target, {
    method: "PUT",
    headers: { "Content-Type": "application/n-triples" },
    body: ntriples, // empty string is valid → clears the remote named graph
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GSP PUT failed ${res.status} ${res.statusText} @ ${target}\n` +
      (text ? `---\n${text.slice(0, 800)}\n---` : "")
    );
  }

  const bytes = new TextEncoder().encode(ntriples).length;

  return {
    ok: true,
    endpoint: target,
    graphIri,
    triplesUploaded: count,
    bytes,
  };
}
