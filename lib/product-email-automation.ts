import { createHash } from "crypto"
import type { Document } from "mongodb"
import * as XLSX from "xlsx"
import { z } from "zod"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getEmailTransport, EmailConfigurationError } from "@/lib/smtp"
import { buildActiveProductPriceSheet } from "@/lib/product-price-template"
import { buildStockCheckTemplateRows } from "@/lib/stock-check-template"
import type { AdminProductResponse } from "@/lib/admin-products-client"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"
import { escapeHtml } from "@/lib/html"

const SETTINGS = "product_email_automation"
const DELIVERIES = "product_email_deliveries"
type Row = Document & { _id: string }
export const productEmailSettingsSchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(z.string().trim().email().max(254).transform(value => value.toLowerCase()))
    .max(10).transform(values => [...new Set(values)]),
}).strict().refine(value => !value.enabled || value.recipients.length > 0, {
  message: "Add at least one recipient before enabling daily emails", path: ["recipients"],
})
type Settings = z.infer<typeof productEmailSettingsSchema>

export function productEmailSchedule(now = new Date()) {
  const india = new Date(now.getTime() + 330 * 60_000)
  return { date: india.toISOString().slice(0, 10), due: india.getUTCHours() * 60 + india.getUTCMinutes() >= 690 }
}

function smtpStatus() {
  try { getEmailTransport(); return { ready: true, error: "" } }
  catch (error) { return { ready: false, error: error instanceof EmailConfigurationError ? error.message : "Email configuration is unavailable" } }
}

async function readSettings(): Promise<Settings> {
  const row = await (await getCollection<Row>(SETTINGS)).findOne({ _id: "daily" })
  const parsed = productEmailSettingsSchema.safeParse({ enabled: row?.enabled ?? false, recipients: row?.recipients ?? [] })
  return parsed.success ? parsed.data : { enabled: false, recipients: [] }
}

export async function getProductEmailAutomation() {
  const [settings, deliveries] = await Promise.all([
    readSettings(),
    (await getCollection<Row>(DELIVERIES)).find({}, { projection: { recipient: 1, date: 1, status: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ createdAt: -1 }).limit(30).toArray(),
  ])
  return { settings, smtp: smtpStatus(), schedule: "Daily at 11:30 AM (Asia/Kolkata)", deliveries: normalizeId(deliveries) }
}

export async function saveProductEmailAutomation(actor: string, settings: Settings) {
  if (settings.enabled) {
    const smtp = smtpStatus()
    if (!smtp.ready) throw new EmailConfigurationError(smtp.error)
  }
  await (await getCollection<Row>(SETTINGS)).updateOne({ _id: "daily" }, {
    $set: { ...settings, updatedBy: actor, updatedAt: new Date() },
  }, { upsert: true })
}

export function buildProductEmailAttachments(products: AdminProductResponse[]) {
  const rows = buildActiveProductPriceSheet(products)
  const priceBook = XLSX.utils.book_new()
  const priceSheet = XLSX.utils.json_to_sheet(rows, { header: ["itemno", "mrp", "price"] })
  priceSheet["!cols"] = [22, 16, 16].map(wch => ({ wch }))
  XLSX.utils.book_append_sheet(priceBook, priceSheet, "Active Products")
  const stockBook = XLSX.utils.book_new()
  const stockSheet = XLSX.utils.json_to_sheet(buildStockCheckTemplateRows(), { header: ["CODE", "WhsCode", "Total"] })
  stockSheet["!cols"] = [18, 15, 12].map(wch => ({ wch }))
  XLSX.utils.book_append_sheet(stockBook, stockSheet, "Store Stock")
  const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  const attachments = [
    { filename: "active-products-price-mrp.xlsx", content: XLSX.write(priceBook, { type: "buffer", bookType: "xlsx" }) as Buffer, contentType },
    { filename: "store_stock_template.xlsx", content: XLSX.write(stockBook, { type: "buffer", bookType: "xlsx" }) as Buffer, contentType },
  ]
  if (attachments.reduce((total, file) => total + file.content.length, 0) > 18 * 1024 * 1024) {
    throw new Error("The Excel attachments exceed the email size limit. Download them from Products instead.")
  }
  return attachments
}

export function buildProductReminderEmail(date: string) {
  const origin = getConfiguredSiteOrigin()
  const links = origin ? `\nUpdate prices: ${origin}/admin/products\nUpload stock: ${origin}/admin/stock-check` : ""
  const text = `Hello,\n\nPlease review and update today's product prices and stock.\n\n1. Open active-products-price-mrp.xlsx, update the mrp and price columns, and upload it using Update Prices in Admin Products. Keep itemno unchanged.\n2. Open store_stock_template.xlsx, replace the example rows with current stock, and upload it in Admin Stock Check. CODE is the item code, WhsCode is the store code, and Total is the quantity.\n\nBoth Excel files are attached. Stock is updated separately from prices.${links}\n\nThank you,\nSara Stores`
  return { subject: `Daily product price and stock update - ${date}`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#1f2937"><h1 style="font-size:22px">Daily product price and stock update</h1><p style="white-space:pre-line">${escapeHtml(text)}</p></div>` }
}

/** Claim each date+recipient with MongoDB's unique _id before SMTP. Never replay an uncertain send. */
export async function runProductEmailAutomation({ now = new Date(), manual = false, dryRun = false, actor = "cron" } = {}) {
  const config = await readSettings()
  const schedule = productEmailSchedule(now)
  if ((!manual && (!config.enabled || !schedule.due)) || !config.recipients.length) {
    return { date: schedule.date, accepted: 0, failed: 0, unknown: 0, skipped: config.recipients.length, reason: "disabled, not due, or no recipients" }
  }
  if (dryRun) return { date: schedule.date, dryRun: true, recipientCount: config.recipients.length }
  const transport = getEmailTransport()
  const records = await (await getCollection("products")).find({ active: true }, { projection: {
    itemno: 1, itemNo: 1, sku: 1, name: 1, raw: 1, mrp: 1, price: 1, active: 1,
  } }).sort({ _id: 1 }).toArray()
  const products = normalizeId(records) as AdminProductResponse[]
  // Match the MRP fallback used by /api/products and the existing manual export.
  for (const product of products) {
    if (product.mrp == null) {
      const candidate = product.raw?.MRP ?? product.raw?.mrp ?? product.raw?.["M.R.P"] ?? product.raw?.["M R P"]
      if (candidate != null && String(candidate).trim()) {
        const value = Number(String(candidate).replace(/[^0-9.-]+/g, ""))
        if (Number.isFinite(value)) product.mrp = value
      }
    }
  }
  const attachments = buildProductEmailAttachments(products)
  const email = buildProductReminderEmail(schedule.date)
  const deliveries = await getCollection<Row>(DELIVERIES)
  await deliveries.updateMany({ status: "sending", createdAt: { $lt: new Date(now.getTime() - 15 * 60_000) } }, {
    $set: { status: "unknown", updatedAt: now },
  })
  const result = { date: schedule.date, accepted: 0, failed: 0, unknown: 0, skipped: 0 }
  await Promise.all(config.recipients.map(async recipient => {
    const current = await readSettings()
    if ((!manual && !current.enabled) || !current.recipients.includes(recipient)) { result.skipped++; return }
    const id = `${schedule.date}:${createHash("sha256").update(recipient).digest("hex")}`
    let claim
    try {
      claim = await deliveries.updateOne({ _id: id }, { $setOnInsert: {
        recipient, date: schedule.date, status: "sending", createdAt: now, actor,
      } }, { upsert: true })
    } catch (error) {
      // A simultaneous first upsert may lose the unique-_id race.
      if ((error as { code?: number })?.code === 11000) { result.skipped++; return }
      throw error
    }
    if (!claim.upsertedCount) { result.skipped++; return }
    let status: "accepted" | "failed" | "unknown" = "unknown"
    try {
      const outcome = await transport.sendMail({ from: process.env.EMAIL_FROM!, to: recipient, ...email, attachments })
      if (outcome.accepted?.some((value: unknown) => String(value).toLowerCase() === recipient)) status = "accepted"
      else if (outcome.rejected?.some((value: unknown) => String(value).toLowerCase() === recipient)) status = "failed"
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (["EAUTH", "ECONNECTION", "EDNS", "ETLS", "ECONNREFUSED", "EENVELOPE", "EMESSAGE"].includes(code || "")) status = "failed"
    }
    await deliveries.updateOne({ _id: id, status: "sending" }, { $set: { status, updatedAt: new Date() } })
    result[status]++
  }))
  return result
}
