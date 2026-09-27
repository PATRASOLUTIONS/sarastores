#!/usr/bin/env node
/**
 * Verifies the SheetJS upgrade (0.18.5 -> 0.20.3, installed from the vendor CDN)
 * did not break Excel generation.
 *
 * READ-ONLY: only GET export endpoints are called, plus an in-process round-trip
 * through the library. Nothing is written to the database.
 *
 * Usage: MOBILE_TEST_EMAIL=.. MOBILE_TEST_PASSWORD=.. node scripts/verify-xlsx.mjs <url>
 */
import * as XLSX from "xlsx"

const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")
const EMAIL = process.env.MOBILE_TEST_EMAIL
const PASSWORD = process.env.MOBILE_TEST_PASSWORD

let pass = 0
let fail = 0
const report = (ok, label, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${detail}`)
  ok ? pass++ : fail++
}

console.log(`\n  SHEETJS VERIFICATION  (version ${XLSX.version})\n`)

// 1. Library round-trip: write a sheet, read it back.
try {
  const rows = [
    { sku: "T001", name: "Test Product", price: 1999 },
    { sku: "T002", name: "Another, with comma", price: 24999 },
  ]
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Products")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  report(Buffer.isBuffer(buf) && buf.length > 0, "write xlsx to buffer", `${buf.length} bytes`)

  const back = XLSX.read(buf, { type: "buffer" })
  const parsed = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]])
  report(parsed.length === 2, "read the buffer back", `${parsed.length} rows`)
  report(parsed[0].sku === "T001" && parsed[1].price === 24999, "values survive the round-trip")
  report(back.SheetNames[0] === "Products", "sheet name preserved", back.SheetNames[0])
} catch (e) {
  report(false, "library round-trip", e.message)
}

// 2. CSV parsing, which the bulk-upload routes rely on.
try {
  const csv = "sku,price\nT100,1500\nT101,2500"
  const wb = XLSX.read(csv, { type: "string" })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
  report(rows.length === 2 && rows[1].price === 2501 - 1, "parse CSV input", `${rows.length} rows`)
} catch (e) {
  report(false, "parse CSV input", e.message)
}

// 3. Live export endpoints (GET only).
if (EMAIL && PASSWORD) {
  try {
    const login = await fetch(`${BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    const auth = await login.json()
    if (!auth?.accessToken) {
      report(false, "admin login", JSON.stringify(auth).slice(0, 60))
    } else {
      const headers = { authorization: `Bearer ${auth.accessToken}` }
      for (const path of ["/api/products/export", "/api/leads/export", "/api/products/specifications/export"]) {
        try {
          const res = await fetch(BASE + path, { headers, signal: AbortSignal.timeout(120_000) })
          const buf = Buffer.from(await res.arrayBuffer())
          // A real xlsx file starts with the ZIP magic bytes "PK".
          const isXlsx = buf.length > 100 && buf[0] === 0x50 && buf[1] === 0x4b
          report(res.ok && isXlsx, `GET ${path}`, `${res.status}  ${buf.length} bytes${isXlsx ? "  (valid zip)" : ""}`)
          if (isXlsx) {
            const wb = XLSX.read(buf, { type: "buffer" })
            report(wb.SheetNames.length > 0, `  parse ${path}`, wb.SheetNames.join(", "))
          }
        } catch (e) {
          report(false, `GET ${path}`, e.message)
        }
      }
    }
  } catch (e) {
    report(false, "live export checks", e.message)
  }
} else {
  console.log("\n  (set MOBILE_TEST_EMAIL/PASSWORD to also check the live export endpoints)")
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
