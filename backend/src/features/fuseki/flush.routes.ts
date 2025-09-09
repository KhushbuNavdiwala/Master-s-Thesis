// src/features/fuseki/flush.routes.ts
import { Router, Request, Response } from "express";
import { putGraphToFuseki } from "./flush.service.ts";
import { FUSEKI_DATA, FUSEKI_GRAPH } from "../../infra/fuseki.config.ts";

export const fusekiFlushRouter = Router();

/**
 * POST /api/fuseki/flush
 * Optional overrides via JSON body:
 * { "graphIri": "http://example.org/graph/movies", "endpointBase": "http://localhost:3030/Movies_2008/data" }
 */
fusekiFlushRouter.post("/api/fuseki/flush", async (req: Request, res: Response) => {
  try {
    const graphIri = (req.body?.graphIri ?? FUSEKI_GRAPH).toString().trim();
    const endpointBase = (req.body?.endpointBase ?? FUSEKI_DATA).toString().replace(/\/+$/, "");

    const result = await putGraphToFuseki(graphIri, endpointBase);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message ?? String(err),
    });
  }
});
