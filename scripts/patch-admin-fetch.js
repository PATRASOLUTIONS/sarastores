// scripts/patch-admin-fetch.js
//
// Safe codemod: convert every `fetch("/api/...")` (or `fetch(\`/api/...\`)`)
// call in app/admin, app/dashboard, and app/account to use the shared
// `apiFetch` wrapper from @/lib/api-client. The wrapper guarantees
// `credentials: "include"` so admin API calls always include cookies
// on production.
//
// Strategy (deliberately simple and robust):
//   1. For every candidate file:
//      a. Skip if the file already imports `apiFetch` from
//         `@/lib/api-client` (idempotent).
//      b. Replace `fetch(` → `apiFetch(` (only when not preceded by an
//         identifier character) only if the file contains at least one
//         such call.
//      c. Find the LAST line of contiguous import statements at the top
//         of the file and insert the new import right after it. If no
//         imports exist, insert after the `"use client"` directive (or
//         at the very top).
//
// We never modify anything below line 50 (other than the `fetch(` →
// `apiFetch(` rename), so there's no risk of injecting an `import`
// inside a function body or JSX block.

const fs = require("fs")
const path = require("path")

const ROOTS = [
  path.join(__dirname, "..", "app", "admin"),
  path.join(__dirname, "..", "app", "dashboard"),
  path.join(__dirname, "..", "app", "account"),
]

const IMPORT_LINE = 'import { apiFetch } from "@/lib/api-client"'
const IMPORT_ALREADY = 'from "@/lib/api-client"'

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "out", "scripts"])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full)
    }
  }
  return out
}

function isImportLine(line) {
  const t = line.trim()
  if (!t.startsWith("import")) return false
  // Must end in a `;` or be a multi-line import we don't try to handle.
  // The vast majority of imports in this codebase are single-line, so we
  // restrict to those.
  if (t.includes("\n")) return false
  return /;\s*$/.test(t) || /^import\s+type\s/.test(t)
}

function findInsertLine(lines) {
  // Walk the file from the top and find the LAST line that is part of
  // the contiguous import block. The block ends at the first non-import,
  // non-blank, non-use-client, non-comment line. We then return the
  // index of the line immediately after the last import in that block.
  let lastImportIdx = -1
  let inImportBlock = true

  for (let i = 0; i < lines.length && i < 200; i++) {
    const t = lines[i].trim()
    if (!inImportBlock) break
    if (t === "") continue
    if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) continue
    if (t === '"use client"' || t === "'use client'") continue
    if (isImportLine(lines[i])) {
      lastImportIdx = i
      continue
    }
    inImportBlock = false
  }

  if (lastImportIdx === -1) {
    // No imports — insert after the "use client" directive / leading
    // comments, or at the top.
    let insertAt = 0
    for (let i = 0; i < lines.length && i < 50; i++) {
      const t = lines[i].trim()
      if (
        t === "" ||
        t.startsWith("//") ||
        t.startsWith("/*") ||
        t.startsWith("*") ||
        t === '"use client"' ||
        t === "'use client'"
      ) {
        insertAt = i + 1
      } else {
        break
      }
    }
    return insertAt
  }

  return lastImportIdx + 1
}

function patchFile(file) {
  const original = fs.readFileSync(file, "utf8")

  // The file already has a top-level import of `apiFetch` (e.g.
  // `import { apiFetch } from "@/lib/api-client"`). Skip.
  const alreadyImportsApiFetch = new RegExp(
    '^\\s*import\\s+(?:type\\s+)?\\{[^}]*\\bapiFetch\\b[^}]*\\}\\s+from\\s+[\'"]@/lib/api-client[\'"]\\s*;?\\s*$',
    "m",
  ).test(original)
  if (alreadyImportsApiFetch) {
    return { changed: false, reason: "already imports apiFetch" }
  }

  // The file uses `apiFetch(` but doesn't import it. Add the import.
  // (The first buggy codemod renamed `fetch(` → `apiFetch(` everywhere
  // but failed to insert the import in many files, so this is the common
  // current state.)
  const usesApiFetchWithoutImport = /\bapiFetch\s*\(/.test(original)
  let working = original
  if (usesApiFetchWithoutImport) {
    // already converted; just need to add the import below
  } else {
    // Replace `fetch(` → `apiFetch(` when not preceded by an identifier
    // character, member access, etc.
    working = original.replace(/(?<![\w$.])fetch\(/g, "apiFetch(")
    if (working === original) {
      return { changed: false, reason: "no fetch() / apiFetch() calls" }
    }
  }

  const lines = working.split("\n")
  const insertAt = findInsertLine(lines)
  lines.splice(insertAt, 0, IMPORT_LINE)
  const withImport = lines.join("\n")

  fs.writeFileSync(file, withImport, "utf8")
  return { changed: true }
}

let changed = 0
let skipped = 0
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue
  for (const file of walk(root)) {
    const result = patchFile(file)
    if (result.changed) {
      changed += 1
      console.log(`patched: ${path.relative(process.cwd(), file)}`)
    } else {
      skipped += 1
    }
  }
}

console.log(`\nDone. ${changed} file(s) updated, ${skipped} skipped.`)
