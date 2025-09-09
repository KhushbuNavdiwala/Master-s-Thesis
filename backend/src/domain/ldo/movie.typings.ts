//import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for movie
 * =============================================================================
 */

/**
 * Movie Type
 */
/*export interface Movie {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "Movie";
  }>;
  name: string;
  datePublished: string;
  director: Person;
}*/

/**
 * Person Type
 */
/*export interface Person {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{
    "@id": "Person";
  }>;
  name: string;
}*/




//new from here :
// src/domain/ldo/movie.typings.ts
import { LdoJsonldContext, LdSet } from "@ldo/ldo";

/**
 * =============================================================================
 * Typescript Typings for movie
 * =============================================================================
 */

export interface Movie {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{ "@id": "Movie" }>;
  name: string;
  datePublished: string;
  director: Person;
}

export interface Person {
  "@id"?: string;
  "@context"?: LdoJsonldContext;
  type: LdSet<{ "@id": "Person" }>;
  name?: string;
}
