import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

/**
 * A `<button>` inside a `<Link>` or `<a>` is invalid HTML. Browsers recover by
 * splitting the nesting, which is why these were reachable in a real browser at
 * all — but screen readers announce two overlapping controls, keyboard users
 * land on a focus target that may not navigate, and Playwright's click sweep
 * hits whichever one the parser happened to leave on top.
 *
 * 55 of these existed across 29 files. This test exists so they do not come
 * back the next time somebody copies a nearby block.
 */

const ROOTS = ["app", "components"]
const REPO = path.resolve(import.meta.dirname, "..")

function tsxFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...tsxFiles(full))
    else if (entry.name.endsWith(".tsx")) out.push(full)
  }
  return out
}

/** Blank out `//` line comments so dead commented-out JSX is not reported. */
function stripLineComments(source) {
  return source
    .split("\n")
    .map(line => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n")
}

test("no button is nested inside a link", () => {
  const offenders = []

  for (const file of ROOTS.map(root => path.join(REPO, root)).flatMap(tsxFiles)) {
    const source = stripLineComments(fs.readFileSync(file, "utf8"))
    const nesting = /<(Link|a)\b[^>]*>([\s\S]{0,1500}?)<\/\1>/g
    let match
    while ((match = nesting.exec(source))) {
      if (!/<button\b/.test(match[2])) continue
      const line = source.slice(0, match.index).split("\n").length
      offenders.push(`${path.relative(REPO, file)}:${line}`)
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Interactive elements must not nest. Collapse the button into the link and move its ` +
      `classes across:\n  ${offenders.join("\n  ")}`,
  )
})
