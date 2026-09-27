import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const OUT = join(process.cwd(), "public", "brands")
mkdirSync(OUT, { recursive: true })

// Primary identity colour per brand, used for a typographic wordmark.
const BRANDS = [
  ["haier", "HAIER", "#003DA5"],
  ["bosch", "BOSCH", "#EA0016"],
  ["whirlpool", "WHIRLPOOL", "#002F6C"],
  ["tcl", "TCL", "#E60012"],
  ["hisense", "HISENSE", "#00843D"],
  ["ifb", "IFB", "#ED1C24"],
  ["kenstar", "KENSTAR", "#E4002B"],
  ["sharp", "SHARP", "#E60012"],
  ["aiwa", "AIWA", "#111111"],
  ["sony", "SONY", "#111111"],
  ["symphony", "SYMPHONY", "#0067B1"],
  ["livpure", "LIVPURE", "#00A0E3"],
  ["lloyd", "LLOYD", "#E4002B"],
  ["kaff", "KAFF", "#111111"],
  ["v-guard", "V-GUARD", "#ED1C24"],
  ["godrej", "GODREJ", "#009CDE"],
  ["ivee", "IVEE", "#0072BC"],
  ["voltas", "VOLTAS", "#EE3124"],
  ["itel", "ITEL", "#00AEEF"],
  ["kodak", "KODAK", "#ED0000"],
  ["nvy", "NVY", "#0F2557"],
  ["onida", "ONIDA", "#E4002B"],
  ["visio-world", "VISIO WORLD", "#1560BD"],
]

const FONT_SIZE = 34
const LETTER_SPACING = 1.6
// Bold uppercase Arial averages ~0.64em per glyph; pad so nothing clips.
const CHAR_WIDTH = FONT_SIZE * 0.64 + LETTER_SPACING

for (const [slug, label, colour] of BRANDS) {
  const width = Math.round(label.length * CHAR_WIDTH + 32)
  const height = 64
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + " " + height + '" width="' + width + '" height="' + height + '" role="img" aria-label="' + label + '">',
    "  <title>" + label + "</title>",
    '  <text x="' + width / 2 + '" y="' + (height / 2 + FONT_SIZE * 0.35) + '"',
    '        text-anchor="middle" fill="' + colour + '"',
    '        font-family="Arial, Helvetica, sans-serif" font-size="' + FONT_SIZE + '"',
    '        font-weight="700" letter-spacing="' + LETTER_SPACING + '">' + label + "</text>",
    "</svg>",
    "",
  ].join("\n")

  writeFileSync(join(OUT, slug + ".svg"), svg, "utf8")
}

console.log("generated " + BRANDS.length + " wordmarks in public/brands")
