import { mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))
const documents = join(root, "documents")
const output = join(documents, "index.html")
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const filename = join(directory, entry.name)
  return entry.isDirectory() ? entry.name === "private-artifacts" ? [] : walk(filename) : filename === output ? [] : [filename]
})
const files = walk(documents).sort((a, b) => a.localeCompare(b))
const groups = new Map()
for (const filename of files) {
  const folder = relative(documents, dirname(filename)).split(sep).join("/") || "Guides & overview"
  if (!groups.has(folder)) groups.set(folder, [])
  groups.get(folder).push(relative(documents, filename).split(sep).join("/"))
}
const sections = [...groups].map(([folder, names], index) => `<section aria-labelledby="folder-${index}">
<h2 id="folder-${index}">${escape(folder)} <small>${names.length} files</small></h2>
<ul>${names.map(name => `<li><a href="${name.split("/").map(encodeURIComponent).join("/")}">${escape(name.split("/").at(-1))}</a><span>${escape(name.split(".").at(-1).toUpperCase())}</span></li>`).join("\n")}</ul>
</section>`).join("\n")
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SARA Internal Documents - Folder Catalogue</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#1e293b;font:16px/1.6 "Segoe UI",Arial,sans-serif}
header{background:#0f2557;color:#fff;padding:38px max(20px,calc((100vw - 1100px)/2))}
h1{font-size:clamp(28px,4vw,42px);line-height:1.2;margin:0 0 15px}header p{max-width:850px;color:#e2edff}
main{max-width:1140px;margin:auto;padding:24px 20px}a{color:#1553a3;text-underline-offset:3px}
a:focus-visible{outline:3px solid #b45309;outline-offset:4px}
.notice{padding:18px;background:#fff7ed;color:#713b0b;border:1px solid #edc18e;border-radius:10px;margin-bottom:24px}
nav{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}nav a{display:inline-block;padding:8px 12px;background:#fff;border:1px solid #dbe3ee;border-radius:7px;font-weight:600}
.folders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}
section{min-width:0;background:#fff;border:1px solid #dbe3ee;border-radius:12px;padding:20px}
h2{margin:0 0 12px;font-size:19px;color:#0f2557;overflow-wrap:anywhere}small{display:block;font-size:13px;color:#475569;font-weight:400}
ul{list-style:none;padding:0;margin:0}li{display:flex;gap:12px;align-items:baseline;justify-content:space-between;padding:8px 0;border-top:1px solid #edf1f7}
li a{min-width:0;overflow-wrap:anywhere}li span{flex-shrink:0;color:#475569;font-size:11px;border:1px solid #dbe3ee;padding:1px 5px;border-radius:4px}
code{font-size:.87em;overflow-wrap:anywhere}footer{padding:20px 0;color:#475569;font-size:13px}
@media(max-width:700px){.folders{grid-template-columns:1fr}main{padding:18px 12px}header{padding:28px 20px}}
</style></head><body>
<header><h1>SARA internal documents</h1><p>Folder-by-folder catalogue of guides, reports, proposals and design references. ${files.length} files in ${groups.size} groups, plus this index.</p></header>
<main>
<div class="notice"><strong>Offline/internal catalogue, not a public application page.</strong> Open this HTML file locally. Next.js does not serve the <code>documents\\</code> directory, and it is excluded from Vercel uploads. Private logs/dumps under <code>private-artifacts\\</code> are deliberately omitted. Historical documents may contain superseded claims; use the current source and dated audit evidence. Do not copy internal material into <code>public\\</code>.</div>
<nav aria-label="Highlighted documents">
<a href="marketing-poster-guide.html">Poster creation &amp; display</a><a href="marketing-campaign-guide.html">Customer campaigns</a>
<a href="customer-journey.html">Customer journey</a><a href="production-readiness-audit.md">Readiness audit</a>
<a href="operations/WORKSPACE_ORGANIZATION.md">Public-access notes</a><a href="../README.md">Project folder map</a>
</nav>
<div class="folders">${sections}</div>
<footer>Regenerate after changing document files: <code>node scripts\\utilities\\generate-document-index.mjs</code> from the project root. Keep each guide's asset folder with its HTML when sharing. Markdown/PDF links use your browser's normal local-file handling.</footer>
</main></body></html>
`
mkdirSync(documents, { recursive: true })
writeFileSync(output, html)
console.log(JSON.stringify({ output: relative(root, output), indexedFiles: files.length, groups: groups.size }))
