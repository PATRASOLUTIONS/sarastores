import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile)
if (config.error) throw new Error("Cannot read TypeScript configuration")
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()
const apply = process.argv.includes("--apply")
let count = 0
for (const source of program.getSourceFiles()) {
  const relative = path.relative(process.cwd(), path.resolve(source.fileName))
  if (source.isDeclarationFile || relative.startsWith("..") || relative.split(path.sep).includes("node_modules")) continue
  const edits = []
  function visit(node) {
    if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.AnyKeyword) {
      const actual = checker.getTypeAtLocation(node.expression)
      const expected = checker.getContextualType(node)
      const unsafeFlags = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.TypeParameter
      if (expected && !(actual.flags & unsafeFlags) && !(expected.flags & unsafeFlags) &&
          !/\bany\b/.test(checker.typeToString(actual)) &&
          checker.isTypeAssignableTo(actual, expected)) {
        edits.push({ start: node.expression.end, end: node.end })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (edits.length) console.log(`${relative}: ${edits.length}`)
  if (apply && edits.length) {
    let output = source.text
    for (const edit of edits.sort((left, right) => right.start - left.start)) {
      output = output.slice(0, edit.start) + output.slice(edit.end)
    }
    fs.writeFileSync(source.fileName, output)
  }
  count += edits.length
}
console.log(`${apply ? "Removed" : "Found"} ${count} redundant any assertions with assignable contextual types.`)
