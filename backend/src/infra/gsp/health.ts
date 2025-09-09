import { FUSEKI_GET, FUSEKI_GRAPH } from "../fuseki.config.ts";
import { GspError } from "./errors.ts";
import { requestWithTimeout, readBodySafe } from "./request.ts";

/** Quick healthcheck: confirm that GSP GET works for the configured graph */
export async function gspHealthcheck(graphIri: string = FUSEKI_GRAPH): Promise<true> {
  const url = `${FUSEKI_GET}?graph=${encodeURIComponent(graphIri)}`;
  const res = await requestWithTimeout(url, {
    method: "GET",
    headers: { Accept: "text/turtle" },
  }, 5_000);

  if (!res.ok) {
    throw new GspError("GSP healthcheck failed", {
      url,
      status: res.status,
      body: await readBodySafe(res),
    });
  }
  return true;
}
