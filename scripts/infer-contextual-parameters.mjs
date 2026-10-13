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
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const signatures = checker.getContextualType(node)?.getCallSignatures() || []
      if (signatures.length === 1) {
        const parameters = signatures[0].getParameters()
        node.parameters.forEach((parameter, index) => {
          if (parameter.type?.kind !== ts.SyntaxKind.AnyKeyword || !ts.isIdentifier(parameter.name) || !parameters[index]) return
          const inferred = checker.getTypeOfSymbolAtLocation(parameters[index], node)
          if (inferred.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.TypeParameter)) return
          if (/\bany\b/.test(checker.typeToString(inferred))) return
          edits.push({ start: parameter.name.end, end: parameter.type.end })
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (apply && edits.length) {
    let output = source.text
    for (const edit of edits.sort((left, right) => right.start - left.start)) {
      output = output.slice(0, edit.start) + output.slice(edit.end)
    }
    fs.writeFileSync(source.fileName, output)
  }
  count += edits.length
}
console.log(`${apply ? "Removed" : "Found"} ${count} redundant any annotations with non-any contextual parameter types.`)
