/**
 * Collapse `<Link><button>…</button></Link>` into a single `<Link>`.
 *
 * Nesting one interactive element inside another is invalid HTML. Browsers
 * recover from it, so clicks still navigate, but the accessibility tree ends up
 * with a link containing a button and screen readers announce the pair
 * inconsistently — some read only the inner control, some read both, some
 * neither. Keyboard users get two stops where there is one action.
 *
 * The transform is deliberately conservative. A button is only absorbed when it
 * is purely presentational: no event handlers, no `disabled`, no `type`, and no
 * siblings inside the link. Anything else is reported for a human to look at,
 * because a button carrying behaviour inside a link is a real design question,
 * not a formatting one.
 *
 * Usage:
 *   node scripts/fix-nested-interactive.mjs            # dry run, prints a plan
 *   node scripts/fix-nested-interactive.mjs --apply    # rewrite the files
 */

import fs from "node:fs"
import path from "node:path"

const APPLY = process.argv.includes("--apply")
const ROOTS = ["app", "components"]

/** Attributes that mean the button does something a link cannot. */
const BEHAVIOURAL = /\s(on[A-Z]\w+|disabled|type|form|name|value|formAction)\s*[=}]/

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

/** Pull `className="…"` or `className={…}` out of a tag's attribute text. */
function extractClassName(attrs) {
  const quoted = attrs.match(/\sclassName="([^"]*)"/)
  if (quoted) return { kind: "string", value: quoted[1], rest: attrs.replace(quoted[0], "") }

  const braced = attrs.match(/\sclassName=\{/)
  if (!braced) return { kind: "none", value: "", rest: attrs }

  // Walk braces so nested template literals and ternaries survive intact.
  const start = braced.index + braced[0].length - 1
  let depth = 0
  for (let i = start; i < attrs.length; i++) {
    if (attrs[i] === "{") depth++
    else if (attrs[i] === "}") {
      depth--
      if (depth === 0) {
        const whole = attrs.slice(braced.index, i + 1)
        return { kind: "expression", value: attrs.slice(start + 1, i), rest: attrs.replace(whole, "") }
      }
    }
  }
  return { kind: "unparsed", value: "", rest: attrs }
}

function mergeClassNames(link, button) {
  if (button.kind === "none") return link.kind === "none" ? "" : renderClassName(link)
  if (link.kind === "none") return renderClassName(button)
  if (link.kind === "string" && button.kind === "string") {
    const merged = [link.value, button.value].join(" ").trim().replace(/\s+/g, " ")
    return ` className="${merged}"`
  }
  // One side is an expression: concatenate at runtime rather than guess.
  const l = link.kind === "string" ? JSON.stringify(link.value) : `(${link.value})`
  const b = button.kind === "string" ? JSON.stringify(button.value) : `(${button.value})`
  return ` className={[${l}, ${b}].filter(Boolean).join(" ")}`
}

function renderClassName(parsed) {
  if (parsed.kind === "string") return ` className="${parsed.value}"`
  if (parsed.kind === "expression") return ` className={${parsed.value}}`
  return ""
}

/** Attributes worth keeping from the button (accessibility metadata only). */
function carryOver(buttonAttrs, linkAttrs) {
  const keep = []
  for (const name of ["aria-label", "title", "aria-hidden"]) {
    if (new RegExp(`\\s${name}[=\\s]`).test(linkAttrs)) continue
    const quoted = buttonAttrs.match(new RegExp(`\\s${name}="[^"]*"`))
    if (quoted) {
      keep.push(quoted[0])
      continue
    }
    const braced = buttonAttrs.match(new RegExp(`\\s${name}=\\{[^}]*\\}`))
    if (braced) keep.push(braced[0])
  }
  return keep.join("")
}

const changes = []
const skipped = []

/**
 * Rename a button we are not going to touch so the matcher stops seeing it.
 * The sentinel has to change the tag name itself — marking it with an extra
 * attribute still matches `<button …>` and the loop spins on the same node.
 */
const PARK = "__SkipNestedButton"
const park = (fragment) =>
  fragment.replace(/^<button/, `<${PARK}`).replace(/<\/button>(\s*<\/(?:Link|a)>)$/, `</${PARK}>$1`)

for (const file of ROOTS.flatMap(walk)) {
  let source = fs.readFileSync(file, "utf8")
  const original = source
  let guard = 0

  for (;;) {
    if (guard++ > 100) break

    // A Link/anchor whose entire body is one button.
    const re = /<(Link|a)(\s[^>]*?)?>\s*<button(\s[^>]*?)?>([\s\S]*?)<\/button>\s*<\/\1>/
    const match = re.exec(source)
    if (!match) break

    const [whole, tag, rawLinkAttrs = "", rawButtonAttrs = "", children] = match
    const line = source.slice(0, match.index).split("\n").length

    if (/<button\b/.test(children) || /<\/(Link|a)>/.test(children)) {
      skipped.push({ file, line, why: "nested further inside" })
      source = source.replace(whole, park(whole))
      continue
    }
    if (BEHAVIOURAL.test(rawButtonAttrs)) {
      skipped.push({ file, line, why: "button carries behaviour (handler/disabled/type)" })
      source = source.replace(whole, park(whole))
      continue
    }

    const linkClass = extractClassName(rawLinkAttrs)
    const buttonClass = extractClassName(rawButtonAttrs)
    if (linkClass.kind === "unparsed" || buttonClass.kind === "unparsed") {
      skipped.push({ file, line, why: "could not parse className" })
      source = source.replace(whole, park(whole))
      continue
    }

    const attrs = `${linkClass.rest.trimEnd()}${mergeClassNames(linkClass, buttonClass)}${carryOver(rawButtonAttrs, rawLinkAttrs)}`
    const replacement = `<${tag}${attrs}>${children}</${tag}>`

    source = source.replace(whole, replacement)
    changes.push({ file, line })
  }

  source = source.split(`<${PARK}`).join("<button").split(`</${PARK}>`).join("</button>")

  if (source !== original) {
    if (APPLY) fs.writeFileSync(file, source)
  }
}

const byFile = new Map()
for (const c of changes) byFile.set(c.file, (byFile.get(c.file) ?? 0) + 1)

console.log(`${APPLY ? "Rewrote" : "Would rewrite"} ${changes.length} nested button(s) in ${byFile.size} file(s):`)
for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(2)}  ${file}`)
}

if (skipped.length) {
  console.log(`\nLeft alone for manual review (${skipped.length}):`)
  for (const s of skipped) console.log(`  ${s.file}:${s.line} — ${s.why}`)
}
