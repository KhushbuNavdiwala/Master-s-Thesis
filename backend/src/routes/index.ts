// src/routes/index.ts
import type {Express} from "express";
import healthRouter from "./health.routes.ts";
import debugRouter from "./debug.routes.ts"
import moviesRemoteRouter from "../features/movies/movies.remote.routes.ts";
import moviesMemoryRouter from "../features/movies/movies.memory.routes.ts";
import moviesGspRouter from "../features/movies/movies.gsp.routes.ts";
import movieSparqlRouter from "../features/movies/movies.routes.ts";


export default function routes(app: Express){


  //health
  app.use("/health", healthRouter);

  //debug (inmemory snapshot tools)
  app.use("/debug", debugRouter);

  //fuseki read-only endpoints
  app.use("/movies", moviesRemoteRouter);

  //Mount your new SPARL-test endpoint first
  app.use("api/movies" , movieSparqlRouter);
  console.log("[ROUTES] Added SPARQL-Test route at /api/movies/sparl-test");

const mode = (process.env.ROUTER_MODE || "memory").toLocaleLowerCase();
if(mode === "gsp") {

  app.use("api/movies", moviesGspRouter);
  console.log("[ROUTES] Using GSP router at /api/movies");
}else{

  app.use("/api/movies",moviesMemoryRouter);
  console.log("[ROUTES] USing MEMORY router at /api/movies");
}
}





