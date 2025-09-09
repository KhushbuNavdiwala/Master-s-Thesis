// write-query.cjs
const fs = require("fs");
const path = "backend/src/domain/shex/compiled/movie.select.rq";

const query = `PREFIX schema: <http://schema.org/>
PREFIX rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?movie ?name ?date ?director ?directorName
WHERE {
  GRAPH <http://example.org/graph/movies> {
    ?movie rdf:type schema:Movie .
    OPTIONAL { ?movie schema:name          ?name }
    OPTIONAL { ?movie schema:datePublished ?date }
    OPTIONAL {
      ?movie   schema:director ?director .
      OPTIONAL { ?director schema:name ?directorName }
    }
  }
}
LIMIT 25
`;

fs.writeFileSync(path, query, { encoding: "utf8", flag: "w" });
console.log("✅ Wrote", path, "as UTF-8 (no BOM).");