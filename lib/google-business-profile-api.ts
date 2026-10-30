import { z } from "zod"
import { businessAccessToken, BusinessProfileError } from "@/lib/google-business-profile-auth"

export async function googleBusinessGet<T>(ownerId: string, connectionId: string, url: URL, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  if (!new Set(["mybusinessaccountmanagement.googleapis.com", "mybusinessbusinessinformation.googleapis.com", "mybusiness.googleapis.com"]).has(url.hostname) || url.protocol !== "https:") {
    throw new BusinessProfileError("Invalid Business Profile API destination.", 400, "INVALID_API_DESTINATION")
  }
  const token = await businessAccessToken(ownerId, connectionId)
  let response: Response
  try { response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000), cache: "no-store" }) }
  catch { throw new BusinessProfileError("Google Business Profile could not be reached. Please try again.", 503, "GOOGLE_UNAVAILABLE") }
  if (!response.ok) {
    let reason = ""
    try {
      const error = z.object({ error: z.object({ details: z.array(z.object({ reason: z.string().optional() })).optional() }).optional() }).parse(await response.json())
      reason = error.error?.details?.map(detail => detail.reason).filter(Boolean).join(" ") || ""
    } catch { /* Provider response bodies are never forwarded to the browser. */ }
    if (response.status === 401) throw new BusinessProfileError("Google authorization expired or was revoked. Reconnect this Google account.", 401, "RECONNECT_REQUIRED")
    if (reason.includes("SERVICE_DISABLED")) throw new BusinessProfileError(`Enable ${url.hostname} in your Google Cloud project, then try again. Business Profile API access approval may also be required.`, 403, "API_DISABLED")
    if (reason.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) throw new BusinessProfileError("Google Business Profile permission was not granted. Reconnect and allow access to business profiles.", 403, "SCOPE_REQUIRED")
    if (response.status === 429) throw new BusinessProfileError("Google Business Profile API quota was reached or the project has zero quota. Check API access approval and quotas in Google Cloud, then try again.", 429, "GOOGLE_QUOTA")
    if (response.status === 403) throw new BusinessProfileError("Google denied access. Check Business Profile API approval, enabled APIs, OAuth permission and your owner/manager access. Reviews are available only for verified locations.", 403, "GOOGLE_ACCESS_DENIED")
    if (response.status === 404) throw new BusinessProfileError("Google could not find this account, location or resource. Some review and photo resources require a verified listing.", 404, "GOOGLE_RESOURCE_NOT_FOUND")
    throw new BusinessProfileError("Google Business Profile returned an error. Refresh the data or try again later.", 502, "GOOGLE_API_ERROR")
  }
  try { return schema.parse(await response.json()) }
  catch { throw new BusinessProfileError("Google returned an unexpected Business Profile response. Try again later.", 502, "INVALID_GOOGLE_RESPONSE") }
}
