/**
 * Centralized fetch wrapper for the admin / dashboard app.
 *
 * Why this exists:
 * - On production deploys, a `fetch("/api/...")` call from a page served by
 *   the same Next.js app should include the httpOnly `session` cookie so
 *   the middleware (and any route-level auth check) can verify the caller.
 * - The fetch default `credentials: "same-origin"` works in most cases,
 *   but it can silently drop cookies in a few real-world scenarios:
 *     1. The admin app is served from a different subdomain than the API
 *        (e.g. `admin.example.com` vs `www.example.com`).
 *     2. A reverse proxy / CDN terminates TLS and rewrites the host
 *        header in a way that the browser no longer treats the request
 *        as same-origin.
 *     3. The session cookie has `Domain=.example.com` but the page is
 *        loaded on `example.com` (no leading dot in URL) — some browser
 *        / proxy combinations mishandle this and the request reaches
 *        the server with no `Cookie` header, causing a 401 even though
 *        the user is logged in.
 *   Setting `credentials: "include"` is safe for same-origin calls AND
 *   it works for the cross-subdomain / cross-origin cases above as long
 *   as the response carries the right CORS headers (which we already
 *   set for partner APIs; for first-party admin APIs the request is
 *   same-origin so no CORS preflight is required).
 * - The wrapper also normalizes JSON parsing and error messages so the
 *   admin pages can show useful errors instead of generic ones.
 */

export interface ApiFetchOptions extends Omit<RequestInit, "body" | "credentials"> {
  /** Optional JSON body. Will be JSON.stringified and Content-Type set. */
  json?: unknown
  /** Body for non-JSON requests. */
  body?: BodyInit | null
  /**
   * Override the default `credentials` policy. Same-origin requests default
   * to "include" so cookies are always sent, even when subtle origin/host
   * mismatches (CDN, proxy) would otherwise make the browser drop them.
   */
  credentials?: RequestCredentials
}

export class ApiError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data: any) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

const isAbsoluteUrl = (input: string) => /^https?:\/\//i.test(input)

export async function apiFetch(
  input: string,
  init: ApiFetchOptions = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {})

  let body = init.body ?? null
  if (init.json !== undefined) {
    body = JSON.stringify(init.json)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  }

  // `credentials: "include"` is the safest default for first-party admin
  // API calls because it always sends cookies regardless of subtle
  // origin/host mismatches between the page and the API. For relative
  // URLs (same-origin) this is a strict superset of "same-origin". For
  // absolute URLs, the server must respond with the right
  // Access-Control-Allow-Credentials / Allow-Origin headers — and our
  // partner routes already do that.
  const sameOrigin = !isAbsoluteUrl(input)

  return fetch(input, {
    ...init,
    headers,
    body,
    credentials: sameOrigin ? "include" : init.credentials ?? "include",
    cache: init.cache ?? "no-store",
  })
}

/**
 * Convenience helper for JSON requests. Throws `ApiError` on non-2xx
 * responses with the parsed body attached, so call sites can show the
 * server's error message directly.
 */
export async function apiFetchJson<T = any>(
  input: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const response = await apiFetch(input, init)
  const text = await response.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.error || data.message)) ||
      `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, data)
  }

  return data as T
}
