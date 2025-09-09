import { ShapeType } from "@ldo/ldo";
import { movieSchema } from "./movie.schema";
import { movieContext } from "./movie.context";
import { Movie, Person } from "./movie.typings";

/**
 * =============================================================================
 * LDO ShapeTypes movie
 * =============================================================================
 */

/**
 * Movie ShapeType
 */
export const MovieShapeType: ShapeType<Movie> = {
  schema: movieSchema,
  shape: "https://ldo.js.org/MovieShape",
  context: movieContext,
};

/**
 * Person ShapeType
 */
export const PersonShapeType: ShapeType<Person> = {
  schema: movieSchema,
  shape: "https://ldo.js.org/PersonShape",
  context: movieContext,
};
