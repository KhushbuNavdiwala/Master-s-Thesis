// src/features/movies/movies.memory.routes.ts
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

const router = Router();

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

/** READ by id (works for MOVIE_BASE ids or full IRIs) */
router.get("/:id", (req, res) => {
  const m = getMovie(req.params.id);
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(toDtoLoose((m as any)["@id"]));
});

/** CREATE (in-memory) */
router.post("/", (req, res) => {
  const created = createMovie(req.body);
  res.status(201).json(toDtoLoose((created as any)["@id"]));
});

/** UPDATE (in-memory) */
router.patch("/:id", (req, res) => {
  const updated = updateMovie(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(toDtoLoose((updated as any)["@id"]));
});

/** DELETE (in-memory) */
router.delete("/:id", (req, res) => {
  const ok = deleteMovie(req.params.id);
  if (!ok) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
