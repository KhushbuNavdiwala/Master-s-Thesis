// src/features/movies/movies.store.ts
import { getDataset, normalizeDatasetGraph } from "../../infra/ldo.ts";
import {
  mintStableMovieId,
  directorIri,
  MOVIE_BASE,
  GRAPH_IRI,
} from "../../infra/graph.helpers.ts";
import { DataFactory } from "n3";
const { namedNode, literal, quad } = DataFactory as any;

import { MovieShapeType } from "../../domain/ldo/movie.shapeTypes.ts";
import type { Movie } from "../../domain/ldo/movie.typings.ts";

// Use full IRIs (HTTPS form) to be consistent with your reader
const P_NAME = "https://schema.org/name";
const P_DATE = "https://schema.org/datePublished";
const P_DIR  = "https://schema.org/director";

// IMPORTANT: HTTP form for rdf:type so filters match
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const C_MOVIE  = "https://schema.org/Movie";
const C_PERSON = "https://schema.org/Person";

/** CREATE — write raw quads so we’re 100% sure data lands in the dataset */
export function createMovie(
  input: Omit<Movie, "@id"> & { "@id"?: string } & {
    directorLabelOrIriOrQid?: string;
    sameAsQid?: string;
    // also accept nested "director" payloads
    director?: { iri?: string; name?: string };
  }
): Movie {
  const ds = getDataset();

  // 1) stable subject IRI
  const subjectIri = mintStableMovieId({
    "@id": input["@id"],
    "schema:name": (input as any).name,
    "schema:datePublished": (input as any).datePublished,
    sameAsQid: (input as any).sameAsQid,
  });
  const S = namedNode(subjectIri);
  const G = namedNode(GRAPH_IRI);

  // 2) assert type so the list route picks it up
  ds.add(quad(S, namedNode(RDF_TYPE), namedNode(C_MOVIE), G));

  // 3) add explicit triples (no proxy magic)
  if ((input as any).name) {
    ds.add(quad(S, namedNode(P_NAME), literal((input as any).name), G));
  }
  if ((input as any).datePublished) {
    ds.add(quad(S, namedNode(P_DATE), literal((input as any).datePublished), G));
  }

  // 4) director: accept both flat string and nested object
  const nestedDir = (input as any).director as { iri?: string; name?: string } | undefined;
  const dIn: string | undefined =
    (input as any).directorLabelOrIriOrQid ??
    nestedDir?.iri ??
    nestedDir?.name;

  if (dIn) {
    const dir = directorIri(dIn)!; // mint/normalize IRI from label/QID/IRI
    ds.add(quad(S, namedNode(P_DIR), namedNode(dir), G));

    const looksLikeQid = /^[Qq]\d+$/.test(dIn.trim());
    const looksLikeIri = /^https?:\/\//i.test(dIn.trim());
    if (!looksLikeQid && !looksLikeIri) {
      // label-only → mint a Person + attach label
      ds.add(quad(namedNode(dir), namedNode(RDF_TYPE), namedNode(C_PERSON), G));
      ds.add(quad(namedNode(dir), namedNode(P_NAME), literal(dIn), G));
    } else if (nestedDir?.name) {
      // if caller provided both iri and a label, cache the label too
      ds.add(quad(namedNode(dir), namedNode(P_NAME), literal(nestedDir.name), G));
    }
  }

  // 5) ensure quads live in GRAPH_IRI (noop if already there)
  normalizeDatasetGraph();

  // 6) return an LDO view (so callers can keep using the same type)
  return ds.usingType<Movie>(MovieShapeType).fromSubject(subjectIri);
}

/** READ single */
export function getMovie(idOrIri: string): Movie | undefined {
  const ds = getDataset();
  const iri = idOrIri.startsWith("http") ? idOrIri : MOVIE_BASE + idOrIri;
  const m = ds.usingType<Movie>(MovieShapeType).fromSubject(iri);

  // Presence check via raw matches
  const S = DataFactory.namedNode(iri);
  const hasAny =
    ds.match(S, namedNode(P_NAME), undefined, undefined).size > 0 ||
    ds.match(S, namedNode(P_DATE), undefined, undefined).size > 0 ||
    ds.match(S, namedNode(P_DIR),  undefined, undefined).size > 0 ||
    ds.match(S, namedNode(RDF_TYPE), namedNode(C_MOVIE), undefined).size > 0;

  return hasAny ? m : undefined;
}

/** LIST — only your locally created (MOVIE_BASE) movies */
export function listMovies(limit = 50, offset = 0): Movie[] {
  const ds = getDataset();
  const subs = new Set<string>();
  for (const q of ds) {
    const s = (q.subject as any).value || "";
    if (s.startsWith(MOVIE_BASE)) subs.add(s);
  }
  const all = [...subs].map((s) =>
    ds.usingType<Movie>(MovieShapeType).fromSubject(s)
  );
  return all.slice(offset, offset + limit);
}

/** UPDATE — replace existing triples for changed fields (idempotent) */
export function updateMovie(
  idOrIri: string,
  patch: Partial<Movie> & {
    directorLabelOrIriOrQid?: string;
    director?: { iri?: string; name?: string };
  }
): Movie | undefined {
  const ds = getDataset();
  const iri = idOrIri.startsWith("http") ? idOrIri : MOVIE_BASE + idOrIri;
  const S = namedNode(iri);
  const G = namedNode(GRAPH_IRI);

  let touched = false;

  // normalize nested director to a single string if present
  const patchAny = patch as any;
  if (patchAny.director && patch.directorLabelOrIriOrQid === undefined) {
    patchAny.directorLabelOrIriOrQid = patchAny.director.iri ?? patchAny.director.name;
  }

  if (patchAny.name !== undefined) {
    // delete old names
    for (const q of ds.match(S, namedNode(P_NAME), undefined, undefined)) ds.delete(q);
    if (patchAny.name !== null) {
      ds.add(quad(S, namedNode(P_NAME), literal(patchAny.name), G));
    }
    touched = true;
  }

  if (patchAny.datePublished !== undefined) {
    for (const q of ds.match(S, namedNode(P_DATE), undefined, undefined)) ds.delete(q);
    if (patchAny.datePublished !== null) {
      ds.add(quad(S, namedNode(P_DATE), literal(patchAny.datePublished), G));
    }
    touched = true;
  }

  if (patch.directorLabelOrIriOrQid !== undefined) {
    // remove old link(s)
    for (const q of ds.match(S, namedNode(P_DIR), undefined, undefined)) ds.delete(q);

    if (patch.directorLabelOrIriOrQid !== null) {
      const raw = patch.directorLabelOrIriOrQid.trim();
      const dirIriStr = directorIri(raw);
      if (dirIriStr) {
        ds.add(quad(S, namedNode(P_DIR), namedNode(dirIriStr), G));

        const looksLikeQid = /^[Qq]\d+$/.test(raw);
        const looksLikeIri = /^https?:\/\//i.test(raw);

        if (!looksLikeQid && !looksLikeIri) {
          // label-only → treat as a new Person label
          ds.add(quad(namedNode(dirIriStr), namedNode(RDF_TYPE), namedNode(C_PERSON), G));
          ds.add(quad(namedNode(dirIriStr), namedNode(P_NAME), literal(raw), G));
        } else if (patchAny.director?.name) {
          // if caller also provided a human label with the IRI, cache it
          ds.add(quad(namedNode(dirIriStr), namedNode(P_NAME), literal(patchAny.director.name), G));
        }
      }
    }
    touched = true;
  }

  if (!touched) return getMovie(iri);

  // Re-assert type (harmless if already present)
  ds.add(quad(S, namedNode(RDF_TYPE), namedNode(C_MOVIE), G));

  normalizeDatasetGraph();
  return ds.usingType<Movie>(MovieShapeType).fromSubject(iri);
}

/** DELETE */
export function deleteMovie(idOrIri: string): boolean {
  const ds = getDataset();

  // Resolve to a full IRI:
  // - http(s)://... → use as-is
  // - Q12345 → Wikidata entity
  // - otherwise → your MOVIE_BASE item
  let iri: string;
  if (idOrIri.startsWith("http")) {
    iri = idOrIri;
  } else if (/^[Qq]\d+$/.test(idOrIri)) {
    iri = `http://www.wikidata.org/entity/${idOrIri.toUpperCase()}`;
  } else {
    iri = MOVIE_BASE + idOrIri;
  }

  const S = namedNode(iri);
  let removed = false;
  for (const q of ds.match(S, undefined, undefined, undefined)) {
    ds.delete(q);
    removed = true;
  }
  return removed;
}
