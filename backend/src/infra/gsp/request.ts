import { GspError } from "./errors.ts";

export async function requestWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err: any) {
    throw new GspError(
      `Network error calling ${init.method || "GET"} ${url}`,
      { url, body: String(err?.message || err) }
    );
  } finally {
    clearTimeout(t);
  }
}

export async function readBodySafe(res: Response, limit = 2000): Promise<string> {
  try {
    const txt = await res.text();
    return txt.length > limit ? txt.slice(0, limit) + "…[truncated]" : txt;
  } catch {
    return "";
  }
}
