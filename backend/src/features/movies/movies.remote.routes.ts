// backend/src/features/movies/movies.remote.routes.ts
// Fuseki-facing routes (keep your old in-memory routes file as-is).
// Provides: 
//   GET /movies/remote?limit=25&offset=0
//   GET /movies/remote/construct?limit=50&offset=0

import { Router } from "express";
import { listMoviesFromFuseki } from "../../domain/movies/movies.remote.ts";
import { constructWholeGraph } from "../../domain/movies/movie.queries.ts";
import { runConstruct } from "../../infra/fuseki.construct.ts";
import { FUSEKI_GRAPH } from "../../infra/fuseki.config.ts";

export const moviesRemoteRouter = Router();

/** SELECT — list movies directly from Fuseki (diagnostics via safeSelect) */
moviesRemoteRouter.get("/remote", async (req, res) => {
  try {
    const limit  = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);
    const data = await listMoviesFromFuseki(limit, offset, FUSEKI_GRAPH);
    res.json({ ok: true, count: data.length, data });
  } catch (e: any) {
    const err = e?.details
      ? { message: e.message, ...e.details }
      : { message: String(e?.message ?? e) };
    res.status(500).json({ ok: false, error: err });
  }
});

/** CONSTRUCT — quick smoke-test of the (named) graph */
moviesRemoteRouter.get("/remote/construct", async (req, res) => {
  try {
    const limit  = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const turtle = await runConstruct(constructWholeGraph(limit, offset, FUSEKI_GRAPH), {
      graphIri: FUSEKI_GRAPH,
    } as any);
    res.setHeader("Content-Type", "text/turtle; charset=utf-8");
    res.send(turtle);
  } catch (e: any) {
    const err = e?.details
      ? { message: e.message, ...e.details }
      : { message: String(e?.message ?? e) };
    res.status(500).json({ ok: false, error: err });
  }
});

export default moviesRemoteRouter;
