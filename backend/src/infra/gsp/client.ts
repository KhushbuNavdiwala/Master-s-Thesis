import { FUSEKI_DATA, FUSEKI_GET, FUSEKI_GRAPH } from "../fuseki.config.ts";
import { GspError } from "./errors.ts";
import { requestWithTimeout, readBodySafe } from "./request.ts";
import { serializeGraphTurtle } from "./serializers.ts";

/** PUT: replace the whole named graph with current in-memory snapshot */
export async function gspPutNamedGraph(graphIri: string = FUSEKI_GRAPH): Promise<void> {
  const url = `${FUSEKI_DATA}?graph=${encodeURIComponent(graphIri)}`;
  const turtle = await serializeGraphTurtle(graphIri);
  const res = await requestWithTimeout(url, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle; charset=UTF-8" },
    body: turtle,
  });
  if (!res.ok) {
    throw new GspError("GSP PUT failed", {
      url,
      status: res.status,
      body: await readBodySafe(res),
    });
  }
}

/** POST: append triples into the named graph */
export async function gspPostNamedGraph(graphIri: string = FUSEKI_GRAPH): Promise<void> {
  const url = `${FUSEKI_DATA}?graph=${encodeURIComponent(graphIri)}`;
  const turtle = await serializeGraphTurtle(graphIri);
  const res = await requestWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "text/turtle; charset=UTF-8" },
    body: turtle,
  });
  if (!res.ok) {
    throw new GspError("GSP POST failed", {
      url,
      status: res.status,
      body: await readBodySafe(res),
    });
  }
}

/** DELETE: clear the named graph */
export async function gspDeleteNamedGraph(graphIri: string = FUSEKI_GRAPH): Promise<void> {
  const url = `${FUSEKI_DATA}?graph=${encodeURIComponent(graphIri)}`;
  const res = await requestWithTimeout(url, { method: "DELETE" });
  if (!res.ok) {
    throw new GspError("GSP DELETE failed", {
      url,
      status: res.status,
      body: await readBodySafe(res),
    });
  }
}

/** GET: download the named graph (Turtle) */
export async function gspGetNamedGraph(graphIri: string = FUSEKI_GRAPH): Promise<string> {
  const url = `${FUSEKI_GET}?graph=${encodeURIComponent(graphIri)}`;
  const res = await requestWithTimeout(url, {
    method: "GET",
    headers: { Accept: "text/turtle" },
  });
  const text = await readBodySafe(res);
  if (!res.ok) {
    throw new GspError("GSP GET failed", { url, status: res.status, body: text });
  }
  return text;
}
