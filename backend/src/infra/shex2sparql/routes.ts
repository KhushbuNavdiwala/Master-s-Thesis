import { Router } from "express";
import { compileAndRun, shex2sparql, withGraph, runAgainstFuseki, SparqlType } from "./index.js";

// If you already centralize config, feel free to import from there:
const FUSEKI_URL = process.env.FUSEKI_URL ?? "http://localhost:3030/Movies_2008";
const GRAPH_IRI  = process.env.GRAPH_IRI  ?? "http://example.org/graph/movies";

export const shex2sparqlRouter = Router();

/**
 * POST /api/shex2sparql/compile
 * Body: { schemaPath: string, start: string, type: "SELECT"|"CONSTRUCT"|"ASK", graphIri?: string }
 * Returns: { query: string }
 */
shex2sparqlRouter.post("/compile", async (req, res) => {
  try {
    const { schemaPath, start, type, graphIri } = req.body as {
      schemaPath: string; start: string; type: SparqlType; graphIri?: string;
    };
    if (!schemaPath || !start || !type) {
      return res.status(400).json({ error: "schemaPath, start, and type are required" });
    }

    let query = await shex2sparql({ schemaPath, start, type });
    query = withGraph(query, graphIri ?? GRAPH_IRI);

    res.json({ query });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/shex2sparql/run
 * Body: {
 *   schemaPath: string, start: string, type?: "SELECT"|"CONSTRUCT"|"ASK",
 *   graphIri?: string, limit?: number, offset?: number, fusekiUrl?: string
 * }
 * Returns: SPARQL JSON (for SELECT) or text (for CONSTRUCT/ASK)
 */
shex2sparqlRouter.post("/run", async (req, res) => {
  try {
    const {
      schemaPath, start,
      type = "SELECT",
      graphIri,
      limit, offset,
      fusekiUrl,
    } = req.body as {
      schemaPath: string; start: string; type?: SparqlType;
      graphIri?: string; limit?: number; offset?: number; fusekiUrl?: string;
    };

    if (!schemaPath || !start) {
      return res.status(400).json({ error: "schemaPath and start are required" });
    }

    const out = await compileAndRun({
      schemaPath,
      start,
      type,
      graphIri: graphIri ?? GRAPH_IRI,
      fusekiUrl: fusekiUrl ?? FUSEKI_URL,
      limit, offset,
    });

    // Content-type based on type
    if (type === "SELECT") {
      res.json(out);
    } else {
      res.type("text/plain").send(out as string);
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

/**
 * POST /api/shex2sparql/run-query
 * Body: { query: string, type?: "SELECT"|"CONSTRUCT"|"ASK", fusekiUrl?: string }
 * Returns: SPARQL JSON (SELECT) or text
 */
shex2sparqlRouter.post("/run-query", async (req, res) => {
  try {
    const { query, type = "SELECT", fusekiUrl } = req.body as {
      query: string; type?: SparqlType; fusekiUrl?: string;
    };
    if (!query) return res.status(400).json({ error: "query is required" });

    const out = await runAgainstFuseki({
      fusekiUrl: fusekiUrl ?? FUSEKI_URL,
      query,
      type,
    });

    if (type === "SELECT") {
      res.json(out);
    } else {
      res.type("text/plain").send(out as string);
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
