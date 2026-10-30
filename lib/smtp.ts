import nodemailer from "nodemailer"

export class EmailConfigurationError extends Error {}

function smtpOptions() {
  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"].filter(key => !process.env[key]?.trim())
  if (missing.length) throw new EmailConfigurationError(`Missing email settings: ${missing.join(", ")}`)
  const port = Number(process.env.SMTP_PORT || "587")
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new EmailConfigurationError("SMTP_PORT must be a valid port number")
  const flag = process.env.SMTP_SECURE?.trim().toLowerCase()
  if (flag && flag !== "true" && flag !== "false") throw new EmailConfigurationError("SMTP_SECURE must be true or false")
  const secure = flag ? flag === "true" : port === 465
  if (port === 465 && !secure) throw new EmailConfigurationError("SMTP port 465 requires SMTP_SECURE=true")
  return { host: process.env.SMTP_HOST!.trim(), port, secure, requireTLS: !secure,
    auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASS! },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 }
}

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined
let verifiedUntil = 0
let pendingVerification: Promise<void> | undefined

export function getEmailTransport() {
  // Validate before attempting a network connection; never silently use localhost.
  const options = smtpOptions()
  return transporter ||= nodemailer.createTransport(options)
}

/** Same availability check for every reset request, before looking up an account. */
export async function verifyEmailTransport() {
  const transport = getEmailTransport()
  if (Date.now() < verifiedUntil) return
  if (!pendingVerification) pendingVerification = transport.verify().then(() => {
    verifiedUntil = Date.now() + 60000
  }).finally(() => { pendingVerification = undefined })
  await pendingVerification
}
