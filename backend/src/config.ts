/*export function loadConfig(){

    const PORT = process.env.PORT || 3000;
    const FUSEKI_URI = process.env.FUSEKI_URL || "http://localhost:3030";
    const DATASET = process.env.DATASET || "Movies_2008";
    const GRAPH = process.env.GRAPH || "http://example.org/graph/movies";

    return {
        PORT,
        FUSEKI_URI,
        DATASET,
        GRAPH
    };
}*/
export function loadConfig() {
  const PORT = process.env.PORT ?? 3000;
  const FUSEKI_URL = process.env.FUSEKI_URL ?? "http://localhost:3030/Movies_2008";
  const GRAPH_IRI  = process.env.GRAPH_IRI  ?? "http://example.org/graph/movies";
  const PAGE_SIZE  = process.env.PAGE_SIZE ? Number(process.env.PAGE_SIZE) : 5000;
  const MAX_PAGES  = process.env.MAX_PAGES ? Number(process.env.MAX_PAGES) : 10;

  return { PORT, FUSEKI_URL, GRAPH_IRI, PAGE_SIZE, MAX_PAGES };
}
