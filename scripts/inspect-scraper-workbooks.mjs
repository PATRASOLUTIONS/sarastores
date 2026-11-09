import XLSX from "xlsx"
import fs from "node:fs"
const position = process.argv.slice(2).find(value => value.startsWith("--position="))?.slice(11)
for (const filename of process.argv.slice(2).filter(value => !value.startsWith("--"))) {
  const book = XLSX.read(fs.readFileSync(filename), { type: "buffer", cellFormula: true })
  const sheets = book.SheetNames.map(name => {
    const sheet = book.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })
    if (position) {
      const index = rows.findIndex(row => String(row.itemno).trim().toUpperCase() === position.toUpperCase())
      return { name, rows: rows.length, position: index < 0 ? null : index + 1, remainingAfterPosition: index < 0 ? null : rows.length - index - 1 }
    }
    return { name, rows: rows.length, columns: XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })[0] || [], sample: rows.slice(0, 2),
      hyperlinkExamples: Object.entries(sheet).filter(([key, cell]) => !key.startsWith("!") && cell?.l?.Target).slice(0, 2).map(([cell, value]) => ({ cell, target: value.l.Target })) }
  })
  console.log(JSON.stringify({ filename, sheets }, null, 2))
}
