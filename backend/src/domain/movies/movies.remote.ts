// backend/src/domain/movies/movie.remote.ts
// Final diagnostic version: uses safeSelect + simple SELECT builder.
// Clear errors when graph is missing/empty or query matches nothing.

import { FUSEKI_GRAPH } from "../../infra/fuseki.config.ts";
import { safeSelect } from "../../infra/fuseki.select.ts";
import { selectMoviesBasic } from "./movie.queries.ts";

/** Raw row returned from SPARQL JSON (flattened) */
type MovieRow = {
  movie: string;
  name?: string;
  date?: string;
  director?: string;
  directorName?: string;
};

/** Public DTO used by your API */
export type MovieDTO = {
  id: string;
  iri: string;
  name?: string;
  datePublished?: string;
  director?: { iri: string; id: string; name?: string };
};

/** Extract a compact id (works for Wikidata Q-IDs and generic IRIs) */
const iriToId = (iri: string) => iri.split(/[\/#]/).filter(Boolean).pop() || iri;

/**
 * List movies directly from Fuseki (no in-memory step).
 * Adds strong diagnostics via `safeSelect`:
 * - Named graph missing/empty
 * - Graph has data but query matches 0 rows (predicate mismatch)
 * - Endpoint/config errors with hints
 */
export async function listMoviesFromFuseki(
  limit: number = 25,
  offset: number = 0,
  graphIri: string = (FUSEKI_GRAPH || "").trim() || undefined as unknown as string
): Promise<MovieDTO[]> {
  // Build a very permissive SELECT that works with varied data
  const query = selectMoviesBasic(limit, offset, graphIri);

  // safeSelect will throw FusekiError with detailed .details you surface in routes
  const rows = await safeSelect<MovieRow>(query, graphIri);

  // Map rows → DTO
  return rows.map((r) => ({
    id: iriToId(r.movie),
    iri: r.movie,
    name: r.name,
    // normalize date to YYYY-MM-DD if present
    datePublished: r.date ? r.date.slice(0, 10) : undefined,
    director: r.director
      ? { iri: r.director, id: iriToId(r.director), name: r.directorName }
      : undefined,
  }));
}
