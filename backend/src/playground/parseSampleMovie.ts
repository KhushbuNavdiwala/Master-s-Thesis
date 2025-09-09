//import { createLdoDataset } from "@ldo/ldo";    
import {Parser as N3Parser} from "n3";
//import { movieContext } from "../domain/ldo/movie.context.ts";
import { MovieShapeType } from "../domain/ldo/movie.shapeTypes.ts";
import type { Person } from "../domain/ldo/movie.typings.ts";
import { getDataset } from "../infra/ldo.ts";


async function main(){

    const ttl = `
    @prefix schema: <https://schema.org/> .
    @prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
    @prefix ex:     <http://example.org/movie#> .

    ex:tt0001 a schema:Movie ;
      schema:name "My First Movie" ;
      schema:datePublished "2008-01-01"^^xsd:date ;
      schema:director ex:nolan .

    ex:nolan a schema:Person ;
      schema:name "Christopher Nolan" .
  `;
  

  //PArse TTL -> quads 

  const quads = new N3Parser({format: "text/turtle"}).parse(ttl);

  // create dataset, load data, register the generated context 
  const ds = getDataset();
  for(const q of quads) ds.add(q);
  //ds.setContext(movieContext);

  //Wrap the subject as a typed Movie via the generated binding 

  const movie = ds
  .usingType(MovieShapeType)
  .fromSubject("http://example.org/movie#tt0001");

  //access typed fields
  /*type PersonLike = {name?: string};
 const directors: Person[]=
  movie.director == null
    ? []
    : Array.isArray(movie.director)
      ? (movie.director)
      : ([movie.director]);*/
      // Access typed fields (normalize director to array)
  const directors: Person[] = Array.isArray(movie.director)
    ? movie.director
    : movie.director
    ? [movie.director]
    : [];


  console.log("Title:" ,movie.name);
  console.log("Published",movie.datePublished);
  console.log("Director", directors.map(d =>d?.name));  

}


main().catch(console.error);

