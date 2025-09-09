// src/app.ts
import express from "express";
import { loadConfig } from "./config.ts";
import routes from "./routes/index.ts";
import { fusekiFlushRouter } from "./features/fuseki/flush.routes.ts";
import { shex2sparqlRouter } from "./infra/shex2sparql/routes.ts";

export async function createApp() {
  const app = express();
  app.use(express.json());

  // mount all top-level routes
  routes(app);

  // global error handler (last)
  app.use((err: unknown, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });
  app.use(fusekiFlushRouter);
  app.use("/api/shex2sparql", shex2sparqlRouter);


  // optional preload from Fuseki (same behavior you had)
  const { FUSEKI_URL, GRAPH_IRI } = loadConfig();
  if (process.env.LOAD_FROM_FUSEKI === "1") {
    const { loadGraphFromFuseki } = await import("./infra/fuseki.ts");
    await loadGraphFromFuseki({
      endpointUrl: FUSEKI_URL,
      graphIri: GRAPH_IRI,
      pageSize: 5000,
      maxPages: 10,
      verbose: true,
    });
    console.log("✅ Loaded initial graph from Fuseki into memory");
  }

  return app;
}
