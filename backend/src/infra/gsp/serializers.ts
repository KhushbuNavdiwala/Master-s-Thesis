import { DataFactory, Writer, Quad } from "n3";
import { getDataset } from "../ldo.ts";

const { namedNode } = DataFactory;

/** Serialize ONLY quads from the given named graph to Turtle */
export async function serializeGraphTurtle(graphIri: string): Promise<string> {
  const ds = getDataset();
  const G = namedNode(graphIri);
  const writer = new Writer({ format: "text/turtle" });

  for (const q of ds.match(undefined, undefined, undefined, G)) {
    writer.addQuad(q as unknown as Quad);
  }

  return new Promise<string>((resolve, reject) => {
    writer.end((err, turtle) => (err ? reject(err) : resolve(turtle || "")));
  });
}
