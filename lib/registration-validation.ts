import { z } from "zod"
import { parse } from "tldts"
import isEmail from "validator/lib/isEmail"

export const REGISTRATION_NAME_MAX_LENGTH = 100
export const REGISTRATION_EMAIL_MAX_LENGTH = 254

const PLACEHOLDER_NAMES = new Set([
  "null", "undefined", "true", "false", "test", "test test test", "admin", "user", "hello", "hello world",
  // Explicitly supplied short junk sample; character heuristics cannot reliably
  // distinguish every short arbitrary string from an unfamiliar real name.
  "hjguygu",
  // Reported invalid values are explicit rules, independent of heuristics.
  "asdfghjkl", "qwertyuiop", "zxcvbnm", "sdfksfgksjfygdkfgh",
  "aaaaaaaaaaaaaaaa", "xxxxxxxxxxxxxxxx", "testtesttest", "john123", "admin999",
])
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]

// Target obvious input patterns, without a dictionary or rules for foreign
// scripts. These heuristics cannot identify all random-looking strings.
function hasSuspiciousNameToken(name: string): boolean {
  if (name.length > REGISTRATION_NAME_MAX_LENGTH) return false // Length already fails.
  if (name === "NaN") return true // Preserve the legitimate name Nan.
  const normalized = name.toLowerCase().replace(/[\s._-]+/g, " ").trim()
  if (PLACEHOLDER_NAMES.has(normalized)) return true
  return (name.match(/[A-Za-z]+/g) || []).some(token => {
    const lower = token.toLowerCase()
    if (/([a-z])\1{5}/.test(lower)) return true
    if (lower.length >= 9 && /^([a-z]{3,12})\1{2,}$/.test(lower)) return true
    if (lower.length >= 6 && KEYBOARD_ROWS.some(row => row.includes(lower) ||
      Array.from(row).reverse().join("").includes(lower))) return true
    if (token.length < 16) return false
    const vowels = token.match(/[aeiouy]/gi)?.length || 0
    return vowels / token.length < 0.15 && /[bcdfghjklmnpqrstvwxz]{10}/i.test(token)
  })
}

function hasValidNameCharacters(name: string): boolean {
  // Bound work even when Zod has already reported the length error. A simple
  // character class avoids ambiguous repeated groups in Unicode name parsing.
  if (name.length > REGISTRATION_NAME_MAX_LENGTH ||
    !/^[\p{L}\p{M} .'\u2019\u02BC\u2010\u2011\u200C\u200D-]+$/u.test(name)) return false
  if (/[-\u2010\u2011]{2}|([.'\u2019\u02BC])\1{2}/u.test(name)) return false
  const letters = Array.from(name)
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === "\u200C" || letters[i] === "\u200D") {
      if (!letters[i - 1] || !letters[i + 1] ||
        !/^[\p{L}\p{M}]$/u.test(letters[i - 1]) || !/^[\p{L}\p{M}]$/u.test(letters[i + 1])) return false
    }
  }
  return true
}

export const registrationNameSchema = z.string()
  .trim()
  .transform(value => value.normalize("NFC").replace(/\p{Zs}+/gu, " "))
  .pipe(z.string()
    .min(1, "Name is required")
    .max(REGISTRATION_NAME_MAX_LENGTH, "Name must be 100 characters or fewer")
    // Letters and combining marks in every script; separators and initials.
    .refine(hasValidNameCharacters,
      "Enter a name using letters, spaces, hyphens or apostrophes")
    .refine(value => /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u.test(value), "Enter a name containing letters")
    .refine(value => !hasSuspiciousNameToken(value), "Please check your name for typing errors"))

function normalizeEmail(value: string): string {
  const email = value.trim().normalize("NFC").toLowerCase()
  const at = email.lastIndexOf("@")
  if (at < 0) return email
  const domain = email.slice(at + 1)
  // URL handles international domain names, but must not repair URL syntax
  // (ports, percent escapes, paths, credentials) into an accepted address.
  if (!/^[\p{L}\p{M}\p{N}.-]+$/u.test(domain)) return email
  try {
    return `${email.slice(0, at)}@${new URL(`http://${domain}`).hostname}`
  } catch {
    return email
  }
}

function hasPublicEmailDomain(email: string): boolean {
  const domain = email.slice(email.lastIndexOf("@") + 1)
  if (domain.length > 253) return false
  const labels = domain.split(".")
  if (labels.length < 2 || labels.some(label => label.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return false
  const result = parse(domain, { allowPrivateDomains: false })
  // A recognized public suffix is a registration policy, not a DNS lookup
  // or proof that the domain or inbox exists. Verification email is still needed.
  return result.isIcann === true && !result.isIp
}

export const accountEmailSchema = z.string()
  .transform(normalizeEmail)
  .pipe(z.string()
    .min(1, "Email is required")
    .max(REGISTRATION_EMAIL_MAX_LENGTH, "Email must be 254 characters or fewer")
    .refine(email => isEmail(email, { allow_utf8_local_part: false, allow_ip_domain: false }), "Invalid email address")
    .refine(email => email.slice(0, email.lastIndexOf("@")).length <= 64, "Email local part is too long"))

export const registrationEmailSchema = accountEmailSchema
  .refine(hasPublicEmailDomain, "Enter an email address with a valid public domain")

export const RegistrationIdentitySchema = z.object({
  name: registrationNameSchema,
  email: registrationEmailSchema,
})
