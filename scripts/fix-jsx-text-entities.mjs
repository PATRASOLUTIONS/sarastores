import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const reportPath = process.argv[2]
if (!reportPath) throw new Error("Pass the current ESLint JSON report")
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
const escapes = { "'": "&apos;", '"': "&quot;", ">": "&gt;", "}": "&#125;" }
let replacements = 0
for (const entry of report) {
  const messages = entry.messages.filter((message) => message.ruleId === "react/no-unescaped-entities" && message.severity === 2)
  if (!messages.length) continue
  const relative = path.relative(process.cwd(), entry.filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative) || !/\.[jt]sx$/.test(relative)) {
    throw new Error("Refusing a file outside the workspace JSX scope")
  }
  const text = fs.readFileSync(entry.filePath, "utf8")
  const source = ts.createSourceFile(entry.filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const textRanges = []
  function visit(node) {
    if (ts.isJsxText(node)) textRanges.push([node.getStart(source), node.end])
    ts.forEachChild(node, visit)
  }
  visit(source)
  const positions = [...new Set(messages.map((message) => source.getPositionOfLineAndCharacter(message.line - 1, message.column - 1)))]
  let output = text
  for (const position of positions.sort((left, right) => right - left)) {
    if (!textRanges.some(([start, end]) => position >= start && position < end) || !escapes[text[position]]) {
      throw new Error("Lint report is stale or points outside an escapable JSX text node")
    }
    output = output.slice(0, position) + escapes[text[position]] + output.slice(position + 1)
    replacements++
  }
  fs.writeFileSync(entry.filePath, output)
}
console.log(`Escaped ${replacements} JSX text characters; rendered text is unchanged.`)
