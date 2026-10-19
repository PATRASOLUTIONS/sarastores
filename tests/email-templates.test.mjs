import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

/**
 * Covers the template layer: HTML escaping of customer data, the plain-text
 * alternative every message must carry, preheader injection, and tax-invoice
 * rendering. No SMTP transport is constructed and no mail is sent.
 */

const ORDER = {
  orderNumber: "SARAECOM-00100001",
  customerName: 'Ravi <img src=x onerror="alert(1)">',
  orderDetails: {
    total: 24999,
    items: [{ name: 'TV <script>alert("x")</script>', quantity: 1, price: 24999 }],
    shippingAddress: "12 MG Road, Bhubaneswar",
  },
}

test("order emails escape customer-supplied data", () => {
  const templates = sourceLoader().load("lib/emailTemplates.ts")
  const html = templates.getEmailTemplate("ORDER_PENDING", ORDER)

  assert.ok(html.includes("&lt;img src=x"), "the customer name was not escaped")
  assert.ok(!html.includes("<img src=x"), "a raw <img> tag reached the email body")
  assert.ok(!/<script>alert/.test(html), "a raw <script> tag reached the email body")
  // The real order number must still be readable.
  assert.ok(html.includes("SARAECOM-00100001"), "the order number went missing")
})

test("every email template id renders without throwing", () => {
  const templates = sourceLoader().load("lib/emailTemplates.ts")
  for (const id of ["ORDER_PENDING", "ORDER_PROCESSING", "ORDER_SHIPPED", "ORDER_DELIVERED", "ORDER_CANCELLED"]) {
    const html = templates.getEmailTemplate(id, ORDER)
    assert.ok(html.startsWith("\n      <!DOCTYPE html>") || html.includes("<!DOCTYPE html>"), `${id} produced no document`)
    assert.ok(html.includes("<body"), `${id} produced no body`)
  }
})

test("plain text is derived from HTML, keeping link targets and dropping markup", () => {
  const email = sourceLoader().load("lib/email.ts")
  const text = email.htmlToPlainText(
    `<html><head><style>p{color:red}</style></head><body>` +
      `<h1>Order confirmed</h1><p>Hello Ravi,</p>` +
      `<a href="https://sarastores.com/track">Track your order</a>` +
      `<script>alert(1)</script></body></html>`,
  )

  assert.ok(!text.includes("<"), "markup survived into the text part")
  assert.ok(!text.includes("alert(1)"), "script contents leaked into the text part")
  assert.ok(!text.includes("color:red"), "stylesheet contents leaked into the text part")
  assert.ok(text.includes("Order confirmed"), "headline missing from the text part")
  assert.ok(
    text.includes("https://sarastores.com/track"),
    "link target was lost, leaving the text part unusable",
  )
})

test("preheader is injected hidden, escaped, and only once", () => {
  const email = sourceLoader().load("lib/email.ts")
  const html = email.withPreheader("<html><body><h1>Hi</h1></body></html>", 'Your order <is> "confirmed"')

  assert.ok(html.includes("display:none"), "preheader was not hidden")
  assert.ok(html.includes("&lt;is&gt;"), "preheader was not escaped")
  assert.ok(!html.includes("<is>"), "raw markup in the preheader reached the body")
  assert.equal(html.indexOf("display:none"), html.lastIndexOf("display:none"), "preheader injected twice")
  // It must sit immediately after <body> so clients pick it up as the preview.
  assert.ok(/<body[^>]*><div style="display:none/.test(html), "preheader is not the first body node")
})

test("amount in words uses the Indian numbering system", () => {
  const invoice = sourceLoader().load("lib/invoice-pdf.ts")
  assert.equal(invoice.amountInWords(0), "Zero Rupees Only")
  assert.equal(invoice.amountInWords(1), "One Rupees Only")
  assert.equal(invoice.amountInWords(24999), "Twenty Four Thousand Nine Hundred Ninety Nine Rupees Only")
  assert.equal(invoice.amountInWords(100000), "One Lakh Rupees Only")
  assert.equal(invoice.amountInWords(12500000), "One Crore Twenty Five Lakh Rupees Only")
  assert.ok(invoice.amountInWords(99.5).includes("Fifty Paise"), "paise were dropped")
})

test("the tax invoice renders to a real PDF without a DOM", () => {
  const invoice = sourceLoader().load("lib/invoice-pdf.ts")
  const pdf = invoice.generateInvoicePDF({
    id: "SARAECOM-00100001",
    createdAt: "2026-10-18T00:00:00.000Z",
    status: "processing",
    paymentMethod: "razorpay",
    items: [
      { name: "LG OLED 77in C4", quantity: 1, price: 299999 },
      { name: "Wall mount bracket", quantity: 2, price: 2499 },
    ],
    customer: {
      firstName: "Ravi",
      lastName: "O'Brien",
      email: "ravi@example.invalid",
      phone: "9999999999",
      address: "12 MG Road",
      city: "Bhubaneswar",
      state: "Odisha",
      zipCode: "751001",
      country: "India",
    },
    subtotal: 258472.03,
    taxAmount: 46524.97,
    shipping: 0,
    total: 304997,
  })

  assert.ok(Buffer.isBuffer(pdf), "no buffer was produced")
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-", "output is not a PDF")
  assert.ok(pdf.length > 2000, `PDF is implausibly small (${pdf.length} bytes)`)

  // An apostrophe in a name must not arrive HTML-escaped in a PDF.
  const body = pdf.toString("latin1")
  assert.ok(!body.includes("&#39;"), "HTML escaping leaked into the PDF text")
})

test("an invoice with many items paginates instead of overflowing", () => {
  const invoice = sourceLoader().load("lib/invoice-pdf.ts")
  const items = Array.from({ length: 60 }, (_, i) => ({
    name: `Accessory number ${i + 1} with a deliberately long product title`,
    quantity: 1,
    price: 999,
  }))
  const pdf = invoice.generateInvoicePDF({
    id: "SARAECOM-00100002",
    createdAt: "2026-10-18T00:00:00.000Z",
    status: "processing",
    paymentMethod: "cod",
    items,
    customer: { firstName: "Bulk", lastName: "Buyer", email: "bulk@example.invalid", state: "Kerala" },
    subtotal: 50788.14,
    taxAmount: 9141.86,
    shipping: 99,
    total: 60029,
  })

  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-")
  // More than one page object means the table broke across pages.
  const pageCount = (pdf.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length
  assert.ok(pageCount > 1, `expected multiple pages, got ${pageCount}`)
})
