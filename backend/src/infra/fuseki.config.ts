// src/infra/fuseki.config.ts
import { loadConfig } from "../config.ts";

// Read from .env via your loadConfig()
const { FUSEKI_URL: RAW_URL, GRAPH_IRI: RAW_GRAPH } = loadConfig() as {
  FUSEKI_URL?: string;
  GRAPH_IRI?: string;
};

// Normalize dataset base (strip trailing slashes)
const DATASET_BASE = (RAW_URL ?? "").replace(/\/+$/, "");

// Export canonical values
export const FUSEKI_URL = DATASET_BASE; // e.g., http://localhost:3030/Movies_2008
export const GRAPH_IRI  = (RAW_GRAPH ?? "http://example.org/graph/movies").trim();

// Back-compat alias so existing imports work:
export const FUSEKI_GRAPH = GRAPH_IRI;

// SPARQL endpoints
export const FUSEKI_SPARQL = `${FUSEKI_URL}/sparql`; // SELECT / CONSTRUCT
export const FUSEKI_QUERY  = `${FUSEKI_URL}/query`;  // optional alias
export const FUSEKI_UPDATE = `${FUSEKI_URL}/update`; // SPARQL UPDATE

// Graph Store Protocol (GSP)
export const FUSEKI_DATA = `${FUSEKI_URL}/data`;   // PUT/POST/DELETE
export const FUSEKI_GET  = `${FUSEKI_URL}/get`;    // GET ?graph=...

if (process.env.NODE_ENV !== "test") {
  console.log("[CFG]", {
    FUSEKI_URL,
    GRAPH_IRI,
    FUSEKI_GRAPH, // will print same as GRAPH_IRI
    FUSEKI_SPARQL,
    FUSEKI_DATA,
    FUSEKI_GET,
    FUSEKI_UPDATE,
  });
}
