// backend/src/features/movies/movies.routes.ts
import { Router } from "express";
import {
  createMovie,
  getMovie,
  listMovies,
  updateMovie,
  deleteMovie,
} from "./movies.store.ts";

import { DataFactory } from "n3";
import { getDataset } from "../../infra/ldo.ts";
import { runSelect, SparqlError } from "../../infra/sparql.ts";
import { FUSEKI_GRAPH } from "../../infra/fuseki.config.ts";

// ⬅️ UPDATED: import from movies.queries.ts (plural) and bring both helpers
import {
  loadCompiledMovieQuery ,
  selectMoviesBasic,
} from "../../domain/movies/movie.queries.ts";

import { patchSparqlRuntime } from "../../infra/sparql.patch.ts";

const { namedNode } = DataFactory;

/* ----------------------------- RDF constants ----------------------------- */
const RDF_TYPE      = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const RDFS_LABEL    = namedNode("http://www.w3.org/2000/01/rdf-schema#label");
const S_NAME_HTTP   = namedNode("http://schema.org/name");
const S_NAME_HTTPS  = namedNode("https://schema.org/name");
const S_DATE_HTTP   = namedNode("http://schema.org/datePublished");
const S_DATE_HTTPS  = namedNode("https://schema.org/datePublished");
const S_DIR_HTTP    = namedNode("http://schema.org/director");
const S_DIR_HTTPS   = namedNode("https://schema.org/director");
const C_MOVIE_HTTP  = namedNode("http://schema.org/Movie");
const C_MOVIE_HTTPS = namedNode("https://schema.org/Movie");

/* --------------------------------- utils -------------------------------- */
function lastSegment(iri: string | null) {
  if (!iri) return null;
  const parts = iri.split(/[\/#]/);
  return parts[parts.length - 1] || iri;
}

function fixMojibake(s: string | null): string | null {
  if (!s) return s;
  if (/[ÃÂ]/.test(s)) {
    try {
      const rec = Buffer.from(s, "latin1").toString("utf8");
      if (rec && rec !== s) return rec;
    } catch {}
  }
  return s;
}

function firstLiteral(subjectIri: string, preds: any[]): string | null {
  const ds = getDataset();
  for (const p of preds) {
    for (const q of ds.match(namedNode(subjectIri), p, undefined, undefined)) {
      if (q.object.termType === "Literal") return (q.object as any).value;
    }
  }
  return null;
}

function firstObjectIri(subjectIri: string, preds: any[]): string | null {
  const ds = getDataset();
  for (const p of preds) {
    for (const q of ds.match(namedNode(subjectIri), p, undefined, undefined)) {
      if (q.object.termType === "NamedNode") return (q.object as any).value;
    }
  }
  return null;
}

/** Loose DTO builder from the in-memory dataset */
function toDtoLoose(subjectIri: string) {
  const name   = firstLiteral(subjectIri, [S_NAME_HTTPS, S_NAME_HTTP, RDFS_LABEL]);
  const date   = firstLiteral(subjectIri, [S_DATE_HTTPS, S_DATE_HTTP]);
  const dirIri = firstObjectIri(subjectIri, [S_DIR_HTTPS, S_DIR_HTTP]);
  const dirName = dirIri
    ? firstLiteral(dirIri, [S_NAME_HTTPS, S_NAME_HTTP, RDFS_LABEL])
    : null;

  return {
    id: lastSegment(subjectIri),
    iri: subjectIri,
    name: fixMojibake(name),
    datePublished: date ? date.slice(0, 10) : null,
    director: dirIri
      ? { iri: dirIri, id: lastSegment(dirIri), name: fixMojibake(dirName) }
      : null,
  };
}

/** Discover subjects present in memory, regardless of base */
function listSubjectsFromMemory(): string[] {
  const ds = getDataset();
  const seen = new Set<string>();

  // A) rdf:type schema:Movie
  for (const q of ds.match(undefined, RDF_TYPE, undefined, undefined)) {
    if (q.object.termType === "NamedNode") {
      const o = (q.object as any).value;
      if (o === C_MOVIE_HTTP.value || o === C_MOVIE_HTTPS.value) {
        if (q.subject.termType === "NamedNode") seen.add((q.subject as any).value);
      }
    }
  }

  // B) subjects with schema:name (http/https)
  for (const p of [S_NAME_HTTPS, S_NAME_HTTP]) {
    for (const q of ds.match(undefined, p, undefined, undefined)) {
      if (q.subject.termType === "NamedNode") seen.add((q.subject as any).value);
    }
  }

  // C) subjects with rdfs:label
  for (const q of ds.match(undefined, RDFS_LABEL, undefined, undefined)) {
    if (q.subject.termType === "NamedNode") seen.add((q.subject as any).value);
  }

  return [...seen];
}

/** Minimal type check for schema:Movie */
function hasType(subjectIri: string): boolean {
  const ds = getDataset();
  for (const q of ds.match(namedNode(subjectIri), RDF_TYPE, undefined, undefined)) {
    if (q.object.termType === "NamedNode") {
      const v = (q.object as any).value;
      if (v === C_MOVIE_HTTP.value || v === C_MOVIE_HTTPS.value) return true;
    }
  }
  return false;
}

/* ----------------------- SPARQL JSON result typing ----------------------- */
type SparqlBindingValue = { type: string; value: string };
type SparqlRow = Record<string, SparqlBindingValue>;
type SparqlJson = { head: { vars: string[] }; results: { bindings: SparqlRow[] } };

/* --------------------------- Domain DTO typing --------------------------- */
type MovieDto = {
  id: string | null;
  iri: string | null;
  name: string | null;
  datePublished: string | null;
  director: null | { iri: string | null; id: string | null; name: string | null };
};

/** Map a SPARQL JSON binding row to the unified DTO */
function bindingToDto(binding: SparqlRow): MovieDto {
  const get = (k: string) => (binding?.[k]?.value ?? null) as string | null;

  const movieIri     = get("movie");
  const name         = get("name");
  const dateRaw      = get("date");
  const directorIri  = get("director");
  const directorName = get("directorName");

  return {
    id: lastSegment(movieIri),
    iri: movieIri,
    name: fixMojibake(name),
    datePublished: dateRaw ? dateRaw.slice(0, 10) : null,
    director: directorIri
      ? { iri: directorIri, id: lastSegment(directorIri), name: fixMojibake(directorName) }
      : null,
  };
}

/* --------------------------------- router -------------------------------- */
const router = Router();

/**
 * GET /api/movies/sparql-test
 * (kept from your file) Uses the compiled query + runtime patch, logs final query.
 */
router.get("/sparql-compiled", async (_req, res) => {
  try {
    const compiled = loadCompiledMovieQuery(); // SELECT or CONSTRUCT
    const finalQuery = patchSparqlRuntime(compiled.text, FUSEKI_GRAPH); // → SELECT

    console.log("\n--- FINAL PATCHED SELECT QUERY ---\n");
    console.log(finalQuery);
    console.log("\n----------------------------------\n");

    const json = await runSelect(finalQuery);
    const rows = (json?.results?.bindings ?? []).map(bindingToDto);
    res.setHeader("X-Total-Count", String(rows.length));
    res.status(200).json({ ok: true, rowCount: rows.length, rows });
  } catch (err: any) {
    const status = err instanceof SparqlError ? 502 : 500;
    res.status(status).json({ ok: false, error: String(err?.message ?? err) });
  }
});

/**
 * ✅ NEW: GET /api/movies/sparql-manual
 * Uses the handwritten SELECT with an optional GRAPH wrapper.
 */
router.get("/sparql-manual", async (req, res) => {
  try {
    const limit  = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);

    const query = selectMoviesBasic(limit, offset, FUSEKI_GRAPH);
    const json = await runSelect(query);

    const rows = (json?.results?.bindings ?? []).map(bindingToDto);
    res.setHeader("X-Total-Count", String(rows.length));
    res.status(200).json({ ok: true, rowCount: rows.length, rows });
  } catch (err: any) {
    const status = err instanceof SparqlError ? 502 : 500;
    res.status(status).json({ ok: false, error: String(err?.message ?? err) });
  }
});

/**
 * ✅ NEW: GET /api/movies/sparql-compiled
 * Loads the compiled SELECT produced by ShEx2SPARQL and runs it as-is.
 */
router.get("/sparql-compiled", async (_req, res) => {
  try {
    const compiled = loadCompiledMovieQuery(); // SELECT or CONSTRUCT
    const finalQuery = patchSparqlRuntime(compiled.text, FUSEKI_GRAPH); // → SELECT

    console.log("\n--- FINAL PATCHED SELECT QUERY ---\n");
    console.log(finalQuery);
    console.log("\n----------------------------------\n");

    const json = await runSelect(finalQuery);
    const rows = (json?.results?.bindings ?? []).map(bindingToDto);
    res.setHeader("X-Total-Count", String(rows.length));
    res.status(200).json({ ok: true, rowCount: rows.length, rows });
  } catch (err: any) {
    const status = err instanceof SparqlError ? 502 : 500;
    res.status(status).json({ ok: false, error: String(err?.message ?? err) });
  }
});
/**
 * "/" lists preloaded in-memory movies (discovered at startup) with q/limit/offset.
 */
router.get("/", (req, res) => {
  const limit  = Number(req.query.limit ?? 25);
  const offset = Number(req.query.offset ?? 0);
  const q      = (req.query.q ?? "").toString().trim().toLowerCase();

  const allSubjects = listSubjectsFromMemory();
  const movieIris   = allSubjects.filter((iri) => hasType(iri));

  let rows = movieIris.map((iri) => toDtoLoose(iri));
  if (q) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(q));

  res.setHeader("X-Total-Count", String(rows.length));
  res.json(rows.slice(offset, offset + limit));
});

/** Debug view of everything we preloaded into memory (loose matching). */
router.get("/preloaded", (_req, res) => {
  const subjectIris = listSubjectsFromMemory();
  res.json(subjectIris.map((iri) => toDtoLoose(iri)));
});

/** READ by id (MOVIE_BASE ids or full IRIs) — in-memory */
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
