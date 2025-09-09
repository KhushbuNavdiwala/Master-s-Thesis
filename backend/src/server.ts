// src/server.ts
import "dotenv/config";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";

const { PORT, FUSEKI_URL, GRAPH_IRI } = loadConfig();

console.log("[CFG] PORT:", PORT);
console.log("[CFG] FUSEKI_URL:", FUSEKI_URL);
console.log("[CFG] GRAPH_IRI:", GRAPH_IRI || "(default graph)");
console.log("[CFG] ROUTER_MODE:", process.env.ROUTER_MODE || "memory"); // memory | gsp

const app = await createApp();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
