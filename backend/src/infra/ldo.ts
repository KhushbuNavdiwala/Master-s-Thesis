// src/infra/ldo.ts
import { createLdoDataset, LdoDataset } from "ldo";
import { normalizeToNamedGraph } from "./graph.helpers";

let _ds: LdoDataset | null = null;

/** One in-memory LDO dataset for the whole app (Step 3). */
export function getDataset(): LdoDataset {
  if (_ds) return _ds;
  _ds = createLdoDataset();
  // (If you need to register contexts globally, do it here.)
  return _ds;
}

// Call this after any create/update/delete to force data into GRAPH_IRI
export function normalizeDatasetGraph() {
  const ds = getDataset();
  normalizeToNamedGraph(ds);
}
