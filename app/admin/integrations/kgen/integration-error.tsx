/**
 * eXlr8 endpoints return their reason in an `error` field. Surfacing the raw body
 * put JSON blobs like {"error":"..."} in front of admins, so unwrap it here.
 */
export async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "")
  try {
    const parsed = JSON.parse(text)
    if (parsed?.error) return String(parsed.error)
    if (parsed?.message) return String(parsed.message)
  } catch {
    // Body was not JSON; fall through to the raw text.
  }
  return text.trim() || `Request failed with status ${res.status}`
}

export function isNotConfigured(message: string): boolean {
  return /not configured|missing\s+exlr8/i.test(message)
}

export function IntegrationError({ message }: { message: string }) {
  if (isNotConfigured(message)) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <p className="font-semibold">eXlr8 integration is not configured</p>
        <p className="mt-1 text-sm">
          This page stays empty until the eXlr8 credentials are set. Add{" "}
          <code className="rounded bg-amber-100 px-1">EXLR8_BASE_URL</code>,{" "}
          <code className="rounded bg-amber-100 px-1">EXLR8_CLIENT_ID</code> and{" "}
          <code className="rounded bg-amber-100 px-1">EXLR8_CLIENT_SECRET</code> to your environment, then restart the
          server.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <p className="font-semibold">Could not load data</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  )
}
