/**
 * Tax-invoice PDF generation.
 *
 * Drawn with jsPDF's native text and shape API rather than `doc.html()`.
 * `doc.html()` needs a DOM and html2canvas, is asynchronous, and its callback
 * calls `doc.save()` — a browser download API. None of that works inside a
 * serverless function, so the previous HTML-based implementation produced its
 * output purely from the native calls that followed it.
 *
 * Two encoding constraints shape the output:
 *
 *  - jsPDF's built-in Helvetica is WinAnsi-encoded and has no U+20B9 (₹), so
 *    amounts are prefixed "Rs." Printing "₹" yields a wrong glyph or nothing.
 *  - Text drawn here is PDF content, not HTML, so it must NOT be HTML-escaped.
 *    Escaping turned a customer named O'Brien into "O&#39;Brien" on the invoice.
 *
 * Catalogue prices are GST-inclusive (see lib/order-pricing.ts), so GST is
 * presented as a breakdown of the amount charged, never added on top.
 */

import jsPDF from "jspdf"

export type InvoiceItem = {
  name: string
  quantity: number
  /** GST-inclusive unit price, as charged. */
  price: number
}

export type InvoiceCustomer = {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export type InvoiceInput = {
  id: string
  createdAt: string | Date
  status: string
  items: InvoiceItem[]
  customer: InvoiceCustomer
  /** Taxable value, excluding GST. */
  subtotal: number
  /** GST on the taxable value. */
  taxAmount: number
  shipping: number
  total: number
  paymentMethod: string
}

/** Seller identity. Overridable per deployment; these are business details, not secrets. */
const SELLER = {
  name: process.env.COMPANY_NAME || "Sara Mobiles and Electronics",
  address: process.env.COMPANY_ADDRESS || "Bhubaneswar, Odisha",
  state: process.env.COMPANY_STATE || "Odisha",
  gstin: process.env.COMPANY_GSTIN || "",
  phone: process.env.COMPANY_PHONE || "+91 78920 51553",
  email: process.env.COMPANY_EMAIL || process.env.CONTACT_ADMIN_EMAIL || "",
}

const PAGE_MARGIN = 14
const GST_RATE = 0.18

/**
 * PDF text is not markup. This only removes control characters that would
 * corrupt the content stream, and normalises whitespace.
 */
function plain(value: unknown): string {
  if (value === null || value === undefined) return ""
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
}

/** Indian-format currency. "Rs." because the built-in font has no rupee glyph. */
function money(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return `Rs. ${safe.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = TENS[Math.floor(n / 10)]
  const o = ONES[n % 10]
  return o ? `${t} ${o}` : t
}

/**
 * Amount in words using the Indian numbering system, which a tax invoice is
 * conventionally expected to carry.
 */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)

  if (rupees === 0 && paise === 0) return "Zero Rupees Only"

  const parts: string[] = []
  const push = (value: number, label: string) => {
    if (value > 0) parts.push(`${twoDigits(value)} ${label}`)
  }

  push(Math.floor(rupees / 10000000), "Crore")
  push(Math.floor((rupees % 10000000) / 100000), "Lakh")
  push(Math.floor((rupees % 100000) / 1000), "Thousand")
  push(Math.floor((rupees % 1000) / 100), "Hundred")

  const tail = rupees % 100
  if (tail > 0) parts.push(twoDigits(tail))

  let words = parts.join(" ").replace(/\s+/g, " ").trim()
  words = words ? `${words} Rupees` : ""
  if (paise > 0) words += `${words ? " and " : ""}${twoDigits(paise)} Paise`
  return `${words} Only`
}

/**
 * Intra-state supply is split CGST/SGST; inter-state is IGST. Comparison is
 * loose because stored addresses are free text, and the safe default for an
 * unrecognised address is the inter-state treatment.
 */
function isIntraState(customerState: string | undefined): boolean {
  if (!customerState) return false
  return plain(customerState).toLowerCase() === SELLER.state.toLowerCase()
}

export function generateInvoicePDF(order: InvoiceInput): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const right = pageWidth - PAGE_MARGIN
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  let y = PAGE_MARGIN

  const setFont = (size: number, weight: "normal" | "bold" = "normal") => {
    doc.setFontSize(size)
    doc.setFont("helvetica", weight)
  }

  // ---- Header -------------------------------------------------------------
  doc.setFillColor(15, 37, 87) // brand primary
  doc.rect(0, 0, pageWidth, 28, "F")
  doc.setTextColor(255, 255, 255)
  setFont(16, "bold")
  doc.text(plain(SELLER.name), PAGE_MARGIN, 13)
  setFont(9)
  doc.text(plain(SELLER.address), PAGE_MARGIN, 19)
  const contact = [SELLER.phone, SELLER.email].filter(Boolean).map(plain).join("  |  ")
  if (contact) doc.text(contact, PAGE_MARGIN, 24)

  setFont(14, "bold")
  doc.text("TAX INVOICE", right, 15, { align: "right" })
  if (SELLER.gstin) {
    setFont(8)
    doc.text(`GSTIN: ${plain(SELLER.gstin)}`, right, 21, { align: "right" })
  }

  doc.setTextColor(30, 30, 30)
  y = 38

  // ---- Invoice meta and bill-to, side by side -----------------------------
  const billToX = PAGE_MARGIN
  const metaX = PAGE_MARGIN + contentWidth * 0.58

  setFont(10, "bold")
  doc.text("Bill To", billToX, y)
  doc.text("Invoice Details", metaX, y)
  y += 5

  setFont(9)
  const name = plain(`${order.customer.firstName} ${order.customer.lastName}`) || "Customer"
  const addressLines = [
    name,
    plain(order.customer.email),
    order.customer.phone ? `Phone: ${plain(order.customer.phone)}` : "",
    plain(order.customer.address),
    plain([order.customer.city, order.customer.state, order.customer.zipCode].filter(Boolean).join(", ")),
    plain(order.customer.country),
  ].filter(Boolean)

  const metaLines = [
    `Invoice No: ${plain(order.id)}`,
    `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
    `Status: ${plain(order.status)}`,
    `Payment: ${plain(order.paymentMethod)}`,
    `Place of Supply: ${plain(order.customer.state) || "Not specified"}`,
  ]

  const blockTop = y
  // Wrap long address lines inside the left column rather than overrunning.
  let leftY = blockTop
  for (const line of addressLines) {
    for (const wrapped of doc.splitTextToSize(line, contentWidth * 0.54) as string[]) {
      doc.text(wrapped, billToX, leftY)
      leftY += 4.6
    }
  }
  let rightY = blockTop
  for (const line of metaLines) {
    doc.text(line, metaX, rightY)
    rightY += 4.6
  }

  y = Math.max(leftY, rightY) + 6

  // ---- Items table --------------------------------------------------------
  const col = {
    sn: PAGE_MARGIN + 2,
    item: PAGE_MARGIN + 12,
    qty: PAGE_MARGIN + contentWidth * 0.62,
    rate: PAGE_MARGIN + contentWidth * 0.78,
    amount: right - 2,
  }

  const drawTableHeader = () => {
    doc.setFillColor(237, 242, 247)
    doc.rect(PAGE_MARGIN, y - 5, contentWidth, 8, "F")
    setFont(9, "bold")
    doc.text("#", col.sn, y)
    doc.text("Item", col.item, y)
    doc.text("Qty", col.qty, y, { align: "right" })
    doc.text("Rate", col.rate, y, { align: "right" })
    doc.text("Amount", col.amount, y, { align: "right" })
    y += 7
    setFont(9)
  }

  drawTableHeader()

  order.items.forEach((item, index) => {
    const lineTotal = item.price * item.quantity
    const nameLines = doc.splitTextToSize(
      plain(item.name) || "Item",
      col.qty - col.item - 8,
    ) as string[]
    const rowHeight = Math.max(nameLines.length * 4.4, 6)

    // Start a new page before a row would cross the footer area.
    if (y + rowHeight > pageHeight - 60) {
      doc.addPage()
      y = PAGE_MARGIN + 6
      drawTableHeader()
    }

    doc.text(String(index + 1), col.sn, y)
    nameLines.forEach((line, i) => doc.text(line, col.item, y + i * 4.4))
    doc.text(String(item.quantity), col.qty, y, { align: "right" })
    doc.text(money(item.price), col.rate, y, { align: "right" })
    doc.text(money(lineTotal), col.amount, y, { align: "right" })

    y += rowHeight
    doc.setDrawColor(226, 232, 240)
    doc.line(PAGE_MARGIN, y - 2, right, y - 2)
    y += 2
  })

  // ---- Totals -------------------------------------------------------------
  if (y > pageHeight - 70) {
    doc.addPage()
    y = PAGE_MARGIN + 6
  }

  y += 4
  const labelX = right - 60
  const row = (label: string, value: string, bold = false) => {
    setFont(9, bold ? "bold" : "normal")
    doc.text(label, labelX, y)
    doc.text(value, col.amount, y, { align: "right" })
    y += 5.4
  }

  row("Taxable Value", money(order.subtotal))

  // GST is inclusive in the catalogue price, so it is shown as a breakdown.
  if (isIntraState(order.customer.state)) {
    const half = order.taxAmount / 2
    row(`CGST @ ${(GST_RATE * 50).toFixed(0)}%`, money(half))
    row(`SGST @ ${(GST_RATE * 50).toFixed(0)}%`, money(half))
  } else {
    row(`IGST @ ${(GST_RATE * 100).toFixed(0)}%`, money(order.taxAmount))
  }

  row("Shipping", order.shipping > 0 ? money(order.shipping) : "Free")

  y += 1
  doc.setFillColor(15, 37, 87)
  doc.rect(labelX - 4, y - 4.5, right - labelX + 4, 9, "F")
  doc.setTextColor(255, 255, 255)
  setFont(10, "bold")
  doc.text("Total", labelX, y)
  doc.text(money(order.total), col.amount, y, { align: "right" })
  doc.setTextColor(30, 30, 30)
  y += 10

  setFont(8.5)
  const words = doc.splitTextToSize(
    `Amount in words: ${amountInWords(order.total)}`,
    contentWidth,
  ) as string[]
  words.forEach((line) => {
    doc.text(line, PAGE_MARGIN, y)
    y += 4.4
  })

  // ---- Footer -------------------------------------------------------------
  const footerY = pageHeight - 20
  doc.setDrawColor(226, 232, 240)
  doc.line(PAGE_MARGIN, footerY - 6, right, footerY - 6)
  doc.setTextColor(100, 116, 139)
  setFont(8)
  doc.text("This is a computer-generated invoice and does not require a signature.", PAGE_MARGIN, footerY)
  if (SELLER.email) {
    doc.text(`Queries: ${plain(SELLER.email)}`, PAGE_MARGIN, footerY + 4)
  }

  // Page numbers, added last so the total count is known.
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    setFont(8)
    doc.setTextColor(100, 116, 139)
    doc.text(`Page ${page} of ${pages}`, right, pageHeight - 8, { align: "right" })
  }

  return Buffer.from(doc.output("arraybuffer"))
}
