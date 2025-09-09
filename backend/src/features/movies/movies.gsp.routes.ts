// src/features/movies/movies.gsp.routes.ts
import { Router } from "express";
import {
  createMovie,
  getMovie,
  listMovies,
  updateMovie,
  deleteMovie,
} from "./movies.store.ts";
import {
  toDtoLoose,
  listSubjectsFromMemory,
  hasType,
} from "./movies.dto.ts";
import {
  gspPutNamedGraph,
  gspGetNamedGraph,
  gspHealthcheck,
  GspError,
} from "../../infra/gsp/index.ts";
import { loadGraphFromFuseki } from "../../infra/fuseki.ts";
import { FUSEKI_GRAPH } from "../../infra/fuseki.config.ts";

const router = Router();

/** helper: map GspError → 502 JSON; others → 500 JSON */
function sendError(res: any, err: any) {
  if (err instanceof GspError) {
    return res.status(502).json({
      error: "Fuseki write/read failed",
      details: err.details, // { url, status, body }
    });
  }
  return res
    .status(500)
    .json({ error: "Unexpected server error", message: String(err?.message || err) });
}

/** "/" lists preloaded in-memory movies (with q/limit/offset) */
router.get("/", (req, res) => {
  const limit  = Number(req.query.limit ?? 25);
  const offset = Number(req.query.offset ?? 0);
  const q      = (req.query.q ?? "").toString().trim().toLowerCase();

  const allSubjects = listSubjectsFromMemory();
  const movieIris = allSubjects.filter((iri) => hasType(iri));
  let rows = movieIris.map((iri) => toDtoLoose(iri));

  if (q) rows = rows.filter(r => (r.name || "").toLowerCase().includes(q));

  res.setHeader("X-Total-Count", String(rows.length));
  res.json(rows.slice(offset, offset + limit));
});

/** Preloaded subjects → DTOs (memory view) */
router.get("/preloaded", (_req, res) => {
  const subjectIris = listSubjectsFromMemory();
  res.json(subjectIris.map((iri) => toDtoLoose(iri)));
});

/** READ by id */
router.get("/:id", (req, res) => {
  const m = getMovie(req.params.id);
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(toDtoLoose((m as any)["@id"]));
});

/** CREATE (in-memory) + mirror to Fuseki via GSP PUT */
router.post("/", async (req, res) => {
  const created = createMovie(req.body);
  try {
    await gspPutNamedGraph(); // replace Fuseki named graph with current in-memory snapshot
  } catch (e) {
    return sendError(res, e);
  }
  res.status(201).json(toDtoLoose((created as any)["@id"]));
});

/** UPDATE (in-memory) + mirror to Fuseki via GSP PUT */
router.patch("/:id", async (req, res) => {
  const updated = updateMovie(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  try {
    await gspPutNamedGraph();
  } catch (e) {
    return sendError(res, e);
  }
  res.json(toDtoLoose((updated as any)["@id"]));
});

/** DELETE (in-memory) + mirror to Fuseki via GSP PUT */
router.delete("/:id", async (req, res) => {
  const ok = deleteMovie(req.params.id);
  if (!ok) return res.status(404).json({ error: "Not found" });
  try {
    await gspPutNamedGraph();
  } catch (e) {
    return sendError(res, e);
  }
  res.status(204).end();
});

/* -------- OPTIONAL ADMIN/HEALTH HELPERS (nice for demos) -------- */

/** Healthcheck: verify we can read the named graph via GSP */
router.get("/admin/health/gsp", async (_req, res) => {
  try {
    await gspHealthcheck(FUSEKI_GRAPH);
    res.json({ ok: true, graph: FUSEKI_GRAPH });
  } catch (e) {
    return sendError(res, e);
  }
});

/** Download current named graph from Fuseki (Turtle) */
router.get("/admin/fuseki-graph", async (_req, res) => {
  try {
    const ttl = await gspGetNamedGraph(FUSEKI_GRAPH);
    res.setHeader("Content-Type", "text/turtle; charset=utf-8");
    res.send(ttl);
  } catch (e) {
    return sendError(res, e);
  }
});

/** Reload memory from Fuseki (paged CONSTRUCT) */
router.post("/admin/reload-from-fuseki", async (_req, res) => {
  try {
    const added = await loadGraphFromFuseki({ verbose: true });
    res.json({ reloaded: true, added });
  } catch (e) {
    return sendError(res, e);
  }
});

export default router;
