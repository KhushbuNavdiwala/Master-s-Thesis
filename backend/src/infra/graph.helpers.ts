// src/infra/graph.helpers.ts
import { createHash } from "crypto";
import { DataFactory } from "n3";
import type { DatasetCore, Quad } from "@rdfjs/types";

const { namedNode, quad } = DataFactory as any;

// ---- Base + graph, with safe trimming and trailing slash enforcement
const rawGraph = (process.env.GRAPH_IRI ?? "http://example.org/graph/movies").trim();
const rawBase  = (process.env.MOVIE_BASE ?? "http://example.org/movies/").trim();

function ensureTrailingSlash(s: string) {
  return s.endsWith("/") ? s : s + "/";
}

export const GRAPH_IRI  = rawGraph;
export const MOVIE_BASE = ensureTrailingSlash(rawBase);

// ----------------------- Slug + hashing helpers -----------------------
/** tiny slug for IRIs (lowercase, accent-insensitive, safe ASCII) */
function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics (keeps base letters, e.g., ł -> l)
    .replace(/[^\w\s-]/g, "")         // remove remaining non-word chars
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function sha10(s: string) {
  return createHash("sha1").update(s).digest("hex").slice(0, 10);
}

/** normalize free-text names before hashing (trim + collapse spaces). */
function normalizeNameForHash(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return slug(trimmed);
}

/**
 * Normalize dates so "2001-01-01" and "2001-01-01T00:00:00Z" hash the same.
 */
function normalizeDateForHash(d: string) {
  const s = d.trim();
  const midnight = s.replace(/T00:00:00(?:\.000)?Z$/, "");
  if (midnight !== s && /^\d{4}-\d{2}-\d{2}$/.test(midnight)) return midnight;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoDateMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoDateMatch) return isoDateMatch[1];
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return s;
}

// ----------------------- ID minting -----------------------
export function mintStableMovieId(input: {
  "@id"?: string;
  "schema:name"?: string | string[];
  "schema:datePublished"?: string | string[];
  sameAsQid?: string; // e.g., 'Q123'
}) {
  // 1) If @id given, keep it (support full IRI or local token)
  if (input["@id"]) {
    const id = input["@id"].trim();
    return id.startsWith("http")
      ? id.replace(/^</, "").replace(/>$/, "")
      : MOVIE_BASE + id;
  }

  // 2) If a Wikidata QID is given, reuse canonical IRI
  if (input.sameAsQid) {
    const qid = input.sameAsQid.trim().toUpperCase();
    if (/^Q\d+$/.test(qid)) return `http://www.wikidata.org/entity/${qid}`;
  }

  // 3) Name + date → slug + short hash (normalized)
  const rawName = Array.isArray(input["schema:name"])
    ? input["schema:name"][0]
    : input["schema:name"] ?? "unnamed";

  const rawDate = Array.isArray(input["schema:datePublished"])
    ? input["schema:datePublished"][0]
    : input["schema:datePublished"] ?? "";

  const nameForSlug = slug(String(rawName));
  const nameForHash = normalizeNameForHash(String(rawName));
  const dateForHash = normalizeDateForHash(String(rawDate));

  const idToken = `m-${nameForSlug}-${sha10(`${nameForHash}|${dateForHash}`)}`;
  return MOVIE_BASE + idToken;
}

// ----------------------- Director IRI -----------------------
export function directorIri(x: string) {
  if (!x) return undefined;
  const s = x.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const qid = s.toUpperCase();
  if (/^Q\d+$/.test(qid)) return `http://www.wikidata.org/entity/${qid}`;
  return `${MOVIE_BASE}person/${slug(s)}`;
}

// ----------------------- Named graph normalization -----------------------
/** Move all triples about our MOVIE_BASE subjects from default graph → GRAPH_IRI. */
export function normalizeToNamedGraph(ds: DatasetCore, graphIri = GRAPH_IRI) {
  const moves: Quad[] = [];
  for (const q of ds) {
    const g = (q.graph as any).value || "";
    const s = (q.subject as any).value || "";
    if (!g && s && s.startsWith(MOVIE_BASE)) moves.push(q);
  }
  for (const q of moves) {
    ds.delete(q);
    ds.add(quad(q.subject, q.predicate, q.object, namedNode(graphIri)));
  }
  return moves.length;
}
