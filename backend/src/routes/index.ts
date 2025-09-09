// src/routes/index.ts
import type { Express } from "express";
import healthRouter from "./health.routes.ts";
import debugRouter from "./debug.routes.ts";

import moviesRemoteRouter from "../features/movies/movies.remote.routes.ts";
import moviesMemoryRouter from "../features/movies/movies.memory.routes.ts";
import moviesGspRouter from "../features/movies/movies.gsp.routes.ts";

// 👇 Import your new SPARQL router (movies.routes.ts)
import moviesSparqlRouter from "../features/movies/movies.routes.ts";

export default function routes(app: Express) {
  // health
  app.use("/health", healthRouter);

  // debug (in-memory snapshot tools)
  app.use("/debug", debugRouter);

  // Fuseki read-only endpoints (unchanged):
  //  - /movies/remote, /movies/remote/construct, etc.
  app.use("/movies", moviesRemoteRouter);

  // 👇 Mount your new SPARQL-test endpoint FIRST
  app.use("/api/movies", moviesSparqlRouter);
  console.log("[ROUTES] Added SPARQL-test route at /api/movies/sparql-test");

  // App CRUD endpoints (choose memory vs gsp by env)
  const mode = (process.env.ROUTER_MODE || "memory").toLowerCase();
  if (mode === "gsp") {
    app.use("/api/movies", moviesGspRouter);
    console.log("[ROUTES] Using GSP router at /api/movies");
  } else {
    app.use("/api/movies", moviesMemoryRouter);
    console.log("[ROUTES] Using MEMORY router at /api/movies");
  }
}
