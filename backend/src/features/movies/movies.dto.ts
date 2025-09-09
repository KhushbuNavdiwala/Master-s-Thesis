// src/features/movies/movies.dto.ts
import { DataFactory } from "n3";
import { getDataset } from "../../infra/ldo.ts";
const { namedNode } = DataFactory;

export const RDF_TYPE     = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
export const RDFS_LABEL   = namedNode("http://www.w3.org/2000/01/rdf-schema#label");
export const S_NAME_HTTP  = namedNode("http://schema.org/name");
export const S_NAME_HTTPS = namedNode("https://schema.org/name");
export const S_DATE_HTTP  = namedNode("http://schema.org/datePublished");
export const S_DATE_HTTPS = namedNode("https://schema.org/datePublished");
export const S_DIR_HTTP   = namedNode("http://schema.org/director");
export const S_DIR_HTTPS  = namedNode("https://schema.org/director");
export const C_MOVIE_HTTP  = namedNode("http://schema.org/Movie");
export const C_MOVIE_HTTPS = namedNode("https://schema.org/Movie");

export function firstLiteral(subjectIri: string, preds: any[]): string | null {
  const ds = getDataset();
  for (const p of preds) {
    for (const q of ds.match(namedNode(subjectIri), p, undefined, undefined)) {
      if (q.object.termType === "Literal") return (q.object as any).value;
    }
  }
  return null;
}

export function firstObjectIri(subjectIri: string, preds: any[]): string | null {
  const ds = getDataset();
  for (const p of preds) {
    for (const q of ds.match(namedNode(subjectIri), p, undefined, undefined)) {
      if (q.object.termType === "NamedNode") return (q.object as any).value;
    }
  }
  return null;
}

export function lastSegment(iri: string | null) {
  if (!iri) return null;
  const parts = iri.split(/[\/#]/);
  return parts[parts.length - 1] || iri;
}

export function fixMojibake(s: string | null): string | null {
  if (!s) return s;
  if (/[ÃÂ]/.test(s)) {
    try {
      const rec = Buffer.from(s, "latin1").toString("utf8");
      if (rec && rec !== s) return rec;
    } catch {}
  }
  return s;
}

export function toDtoLoose(subjectIri: string) {
  const name = firstLiteral(subjectIri, [S_NAME_HTTPS, S_NAME_HTTP, RDFS_LABEL]);
  const date = firstLiteral(subjectIri, [S_DATE_HTTPS, S_DATE_HTTP]);
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

/** Find subjects in memory regardless of MOVIE_BASE */
export function listSubjectsFromMemory(): string[] {
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

/** type check: is subject a schema:Movie? */
export function hasType(subjectIri: string): boolean {
  const ds = getDataset();
  for (const q of ds.match(namedNode(subjectIri), RDF_TYPE, undefined, undefined)) {
    if (q.object.termType === "NamedNode") {
      const v = (q.object as any).value;
      if (v === C_MOVIE_HTTP.value || v === C_MOVIE_HTTPS.value) return true;
    }
  }
  return false;
}
