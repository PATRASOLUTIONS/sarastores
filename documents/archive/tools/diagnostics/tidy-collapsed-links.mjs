/**
 * Clean up after scripts/fix-nested-interactive.mjs.
 *
 * Removing the inner `<button>` wrapper leaves its children sitting at the old,
 * deeper indentation, which is how we recognise a collapsed link: the closing
 * tag is indented further than the opening one. That fingerprint lets us touch
 * only the links the codemod produced and leave hand-written ones alone.
 *
 * Two things get fixed per match:
 *   1. Indentation, so the block reads like the rest of the file.
 *   2. A missing display utility. `<button>` is `inline-block`; `<a>` is plain
 *      `inline`, so a padded link with no display utility paints its padding
 *      over the neighbouring lines instead of reserving space.
 *
 * Usage:
 *   node scripts/tidy-collapsed-links.mjs           # report
 *   node scripts/tidy-collapsed-links.mjs --apply
 */

import fs from "node:fs"
import path from "node:path"

const APPLY = process.argv.includes("--apply")
const ROOTS = ["app", "components"]

const DISPLAY =
  /\b(?:inline-)?(?:block|flex|grid|table)\b|\binline\b|\bhidden\b|\bcontents\b|\bflow-root\b/
const PADDING = /\bp[xy]?-\[?[\d.]/

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith(".tsx")) out.push(full)
  }
  return out
}

const indentOf = (line) => line.match(/^[ \t]*/)[0]

function addDisplay(openTag) {
  const className = openTag.match(/className="([^"]*)"/)
  if (!className) return { openTag, changed: false }
  const classes = className[1]
  if (!PADDING.test(classes) || DISPLAY.test(classes)) return { openTag, changed: false }
  return {
    openTag: openTag.replace(`className="${classes}"`, `className="inline-block ${classes}"`),
    changed: true,
  }
}

let tidied = 0
let displayed = 0
const report = []

for (const file of ROOTS.flatMap(walk)) {
  const source = fs.readFileSync(file, "utf8")
  const lines = source.split("\n")
  let touched = false

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^([ \t]*)<(Link|a)\b/)
    if (!open) continue
    const [, baseIndent, tag] = open

    // Find this element's closing tag, tracking nesting of the same tag name.
    let depth = 0
    let close = -1
    for (let j = i; j < lines.length; j++) {
      const opens = lines[j].match(new RegExp(`<${tag}\\b`, "g"))
      const closes = lines[j].match(new RegExp(`</${tag}>`, "g"))
      depth += (opens?.length ?? 0) - (closes?.length ?? 0)
      if (j > i && depth <= 0 && closes) {
        close = j
        break
      }
      if (depth <= 0 && j > i) break
    }
    if (close === -1 || close === i) continue

    const closeIndent = indentOf(lines[close])
    if (closeIndent.length <= baseIndent.length) continue

    // Shift the whole block back by however far the removed wrapper pushed it.
    const shift = closeIndent.length - baseIndent.length
    for (let j = i + 1; j <= close; j++) {
      const current = indentOf(lines[j])
      lines[j] = current.slice(0, Math.max(0, current.length - shift)) + lines[j].slice(current.length)
    }

    const fixed = addDisplay(lines[i])
    lines[i] = fixed.openTag
    if (fixed.changed) displayed++

    tidied++
    touched = true
    report.push(`  ${file}:${i + 1}${fixed.changed ? "  +inline-block" : ""}`)
    i = close
  }

  if (touched && APPLY) fs.writeFileSync(file, lines.join("\n"))
}

console.log(`${APPLY ? "Tidied" : "Would tidy"} ${tidied} collapsed link(s); ${displayed} needed a display utility.`)
for (const line of report) console.log(line)
