import { Schema } from "shexj";

/**
 * =============================================================================
 * movieSchema: ShexJ Schema for movie
 * =============================================================================
 */
export const movieSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "https://ldo.js.org/MovieShape",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: ["https://schema.org/Movie"],
              },
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/name",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/datePublished",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#date",
              },
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/director",
              valueExpr: "https://ldo.js.org/PersonShape",
            },
          ],
        },
      },
    },
    {
      id: "https://ldo.js.org/PersonShape",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: ["https://schema.org/Person"],
              },
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/name",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
            },
          ],
        },
      },
    },
  ],
};
