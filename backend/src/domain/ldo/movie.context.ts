import { LdoJsonldContext } from "@ldo/ldo";

/**
 * =============================================================================
 * movieContext: JSONLD Context for movie
 * =============================================================================
 */
export const movieContext: LdoJsonldContext = {
  type: {
    "@id": "@type",
    "@isCollection": true,
  },
  Movie: {
    "@id": "https://schema.org/Movie",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "https://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
      datePublished: {
        "@id": "https://schema.org/datePublished",
        "@type": "http://www.w3.org/2001/XMLSchema#date",
      },
      director: {
        "@id": "https://schema.org/director",
        "@type": "@id",
      },
    },
  },
  name: {
    "@id": "https://schema.org/name",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  datePublished: {
    "@id": "https://schema.org/datePublished",
    "@type": "http://www.w3.org/2001/XMLSchema#date",
  },
  director: {
    "@id": "https://schema.org/director",
    "@type": "@id",
  },
  Person: {
    "@id": "https://schema.org/Person",
    "@context": {
      type: {
        "@id": "@type",
        "@isCollection": true,
      },
      name: {
        "@id": "https://schema.org/name",
        "@type": "http://www.w3.org/2001/XMLSchema#string",
      },
    },
  },
};
