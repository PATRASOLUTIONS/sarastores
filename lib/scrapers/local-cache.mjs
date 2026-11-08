import fs from "node:fs/promises"
import { randomUUID } from "node:crypto"

/** Serialize local exports without poisoning later saves after a transient filesystem failure. */
export function localCacheWriter(filename, io = fs) {
  let pending = Promise.resolve()
  return data => {
    const snapshot = structuredClone(data)
    pending = pending.catch(() => {}).then(async () => {
      const existing = JSON.parse(await io.readFile(filename, "utf8").catch(error => {
        if (error.code === "ENOENT") return "{}"
        throw error
      }))
      const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`
      try {
        await io.writeFile(temporary, JSON.stringify({ ...existing, ...snapshot }, null, 2))
        for (let attempt = 0; ; attempt++) {
          try { await io.rename(temporary, filename); break }
          catch (error) {
            if (attempt >= 3 || !["EPERM", "EBUSY", "EACCES"].includes(error.code)) throw error
            await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)))
          }
        }
      } finally { await io.rm(temporary, { force: true }).catch(() => {}) }
    })
    return pending
  }
}
