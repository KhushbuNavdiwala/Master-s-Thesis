// src/routes/debug.routes.ts
import { Router } from "express";
import DataFactory from "@rdfjs/data-model";
import { getDataset } from "../infra/ldo.ts";

const { namedNode } = DataFactory;
const router = Router();

const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const WDT_P31  = namedNode("http://www.wikidata.org/prop/direct/P31");

router.get("/types", (_req, res) => {
  const ds = getDataset();
  const typeCounts: Record<string, number> = {};
  for (const q of ds.match(undefined, RDF_TYPE, undefined, undefined)) {
    if (q.object.termType === "NamedNode") {
      typeCounts[q.object.value] = (typeCounts[q.object.value] ?? 0) + 1;
    }
  }
  const p31Counts: Record<string, number> = {};
  for (const q of ds.match(undefined, WDT_P31, undefined, undefined)) {
    if (q.object.termType === "NamedNode") {
      p31Counts[q.object.value] = (p31Counts[q.object.value] ?? 0) + 1;
    }
  }
  res.json({ rdfType: typeCounts, p31: p31Counts });
});

router.get("/samples", (req, res) => {
  const pred = req.query.pred as string | undefined;
  const obj  = req.query.obj as string | undefined;
  if (!pred || !obj) return res.status(400).json({ error: "Provide ?pred=<iri>&obj=<iri>" });

  const ds = getDataset();
  const samples: string[] = [];
  for (const q of ds.match(undefined, namedNode(pred), namedNode(obj), undefined)) {
    if (q.subject.termType === "NamedNode") {
      samples.push(q.subject.value);
      if (samples.length >= 20) break;
    }
  }
  res.json({ pred, obj, samples });
});

export default router;
