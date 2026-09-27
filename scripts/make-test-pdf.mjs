/**
 * Builds a synthetic vendor-style PDF: a real product photo placed on a page
 * with a spec table, which is how EDM flyers and dealer sheets are produced.
 * Used to exercise the PDF image-extraction path. Manual test helper.
 */
import axios from "axios"
import fs from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const OUT = path.join(process.cwd(), ".scrape-probe", "pdfs")

const PHOTOS = [
  "https://media3.bsh-group.com/Product_Shots/23139045_CST22U14PI_STP_def.jpg",
  "https://media3.bsh-group.com/Product_Shots/20834985_KGN56LB42I_STP_def.jpg",
]

const SPECS = [
  ["Model Name", "CST22U14PI"],
  ["Brand", "Bosch"],
  ["Capacity", "220 Litres"],
  ["Star Rating", "4 Star"],
  ["Colour", "Dark Lake"],
  ["Compressor Type", "VarioInverter"],
  ["Warranty", "2 Years Comprehensive"],
  ["In the Box", "Refrigerator, User Manual, Warranty Card"],
]

async function fetchJpeg(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 40000,
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0" },
  })
  if (res.status !== 200) return null
  const bytes = new Uint8Array(res.data)
  // pdf-lib can only embed raw JPEG or PNG.
  return bytes[0] === 0xff && bytes[1] === 0xd8 ? bytes : null
}

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)
const page = doc.addPage([595, 842])

page.drawText("Bosch Series 4 Free-Standing Fridge", { x: 40, y: 790, size: 18, font: bold })
page.drawText("Model CST22U14PI  |  MRP Rs. 30,490", { x: 40, y: 768, size: 11, font })

let embedded = 0
let y = 700
for (const url of PHOTOS) {
  const jpeg = await fetchJpeg(url)
  if (!jpeg) {
    console.log("skipped (not a JPEG):", url)
    continue
  }
  const img = await doc.embedJpg(jpeg)
  const scaled = img.scaleToFit(220, 220)
  page.drawImage(img, { x: 40 + embedded * 250, y: y - scaled.height, width: scaled.width, height: scaled.height })
  embedded++
}

y -= 260
page.drawText("Product Specification", { x: 40, y, size: 13, font: bold })
y -= 22
for (const [k, v] of SPECS) {
  page.drawText(k, { x: 40, y, size: 10, font })
  page.drawText(v, { x: 260, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) })
  y -= 18
}

await fs.mkdir(OUT, { recursive: true })
const file = path.join(OUT, "vendor-edm-sample.pdf")
await fs.writeFile(file, await doc.save())
console.log(`wrote ${file} with ${embedded} embedded photo(s)`)
