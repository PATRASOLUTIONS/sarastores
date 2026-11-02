import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

export const CLONE_SOURCE_DB = "e-commerce-bytewise"
export const CLONE_TARGET_DB = "sara_clone"
export const CLONE_CONTROL = "__sara_manual_clone"
export const CLONE_OWNER = "sara-manual-clone-v1"
export const CLONE_SOURCE_HOST = "ottplay.wlbaefs.mongodb.net"
export const CLONE_TARGET_HOST = "attandance.oaqihbm.mongodb.net"

export class CloneSafetyError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export function validateCloneUri(uri: string, host: string, database: string): string {
  let parsed: URL
  try { parsed = new URL(uri) } catch { throw new CloneSafetyError("A dedicated clone connection string is invalid", 503) }
  if (parsed.protocol !== "mongodb+srv:" || parsed.hostname.toLowerCase() !== host ||
      parsed.port || !parsed.username || !parsed.password ||
      !["", "/", `/${database}`].includes(parsed.pathname)) {
    throw new CloneSafetyError("Clone connections must use the approved clusters and database names", 503)
  }
  for (const name of ["tls", "ssl"]) {
    if (parsed.searchParams.has(name) && parsed.searchParams.get(name) !== "true") {
      throw new CloneSafetyError("Encrypted MongoDB connections are required", 503)
    }
  }
  for (const name of ["tlsAllowInvalidCertificates", "tlsAllowInvalidHostnames", "tlsInsecure"]) {
    if (parsed.searchParams.get(name) === "true") throw new CloneSafetyError("Insecure TLS options are not allowed", 503)
  }
  return uri
}

export function cloneConfiguration() {
  const sourceUri = process.env.DATABASE_CLONE_SOURCE_URI
  const targetUri = process.env.DATABASE_CLONE_TARGET_URI
  const secret = process.env.DATABASE_CLONE_APPROVAL_SECRET
  if (!sourceUri || !targetUri || !secret || secret.length < 32) {
    throw new CloneSafetyError("Configure dedicated clone connections and an approval secret of at least 32 characters", 503)
  }
  validateCloneUri(sourceUri, CLONE_SOURCE_HOST, CLONE_SOURCE_DB)
  validateCloneUri(targetUri, CLONE_TARGET_HOST, CLONE_TARGET_DB)
  return { sourceUri, targetUri, secret, writesEnabled: process.env.DATABASE_CLONE_WRITES_ENABLED === "true" }
}

export function assertCloneRoles(roles: { role: string; db: string }[], mode: "source" | "target") {
  const expected = mode === "source" ? "read" : "readWrite"
  const database = mode === "source" ? CLONE_SOURCE_DB : CLONE_TARGET_DB
  if (!roles.length || roles.some(role => role.role !== expected || role.db !== database)) {
    throw new CloneSafetyError(mode === "source"
      ? "The source account must have only the read role on e-commerce-bytewise; administrator credentials are refused"
      : "The destination account must have only the readWrite role on sara_clone", 503)
  }
}

export function cloneFingerprint() {
  return createHash("sha256").update(`${CLONE_SOURCE_HOST}/${CLONE_SOURCE_DB}->${CLONE_TARGET_HOST}/${CLONE_TARGET_DB}`).digest("hex")
}

const approvalSchema = z.object({
  userId: z.string().min(1), planHash: z.string().regex(/^[a-f0-9]{64}$/),
  fingerprint: z.string(), expires: z.number(),
}).strict()

export function signCloneApproval(planHash: string, userId: string, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ userId, planHash, fingerprint: cloneFingerprint(), expires: now + 5 * 60_000 })).toString("base64url")
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`
}

export function verifyCloneApproval(token: string, userId: string, secret: string, now = Date.now()) {
  const [payload, signature, extra] = token.split(".")
  if (!payload || !signature || extra) throw new CloneSafetyError("Invalid clone approval; create a fresh preview", 400)
  const expected = createHmac("sha256", secret).update(payload).digest()
  const provided = Buffer.from(signature, "base64url")
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
    throw new CloneSafetyError("Invalid clone approval; create a fresh preview", 400)
  }
  let parsed: unknown
  try { parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) } catch { throw new CloneSafetyError("Invalid clone approval", 400) }
  const claims = approvalSchema.safeParse(parsed)
  if (!claims.success || claims.data.userId !== userId || claims.data.fingerprint !== cloneFingerprint() || claims.data.expires <= now) {
    throw new CloneSafetyError("Clone preview expired or belongs to another administrator; create a fresh preview", 400)
  }
  return claims.data.planHash
}

export const CloneActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), approvalToken: z.string().min(1).max(2048),
    confirmation: z.literal("CLONE e-commerce-bytewise TO sara_clone"), acceptLogicalCopy: z.literal(true) }).strict(),
  z.object({ action: z.literal("advance"), runId: z.string().uuid() }).strict(),
])
