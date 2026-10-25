import type { Collection, Document } from "mongodb"

export const ACCOUNT_EMAIL_COLLATION = { locale: "en", strength: 2 } as const
export const ACCOUNT_EMAIL_INDEX_NAME = "email_case_insensitive_unique"

/** Database enforcement is required before accepting any signup write. */
export async function ensureAccountEmailIndex(users: Collection<Document>): Promise<void> {
  await users.createIndex({ email: 1 }, {
    name: ACCOUNT_EMAIL_INDEX_NAME,
    unique: true,
    collation: ACCOUNT_EMAIL_COLLATION,
    partialFilterExpression: { email: { $type: "string" } },
  })
}

export function isDuplicateAccountEmail(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const duplicate = error as { code?: number; keyPattern?: Record<string, unknown>; message?: string }
  return duplicate.code === 11000 && (duplicate.keyPattern?.email === 1 ||
    /\b(?:email_unique|email_case_insensitive_unique)\b/.test(duplicate.message || ""))
}
