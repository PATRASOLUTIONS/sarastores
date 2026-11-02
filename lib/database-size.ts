export interface DatabaseSize {
  database: string
  dataBytes: number | null
  storageBytes: number | null
  indexBytes: number | null
  allocatedBytes: number | null
  collections: number | null
  documents: number | null
}

const statistic = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function databaseSizeFromStats(database: string, stats: Record<string, unknown>): DatabaseSize {
  const storageBytes = statistic(stats.storageSize)
  const indexBytes = statistic(stats.indexSize)
  return { database, dataBytes: statistic(stats.dataSize), storageBytes, indexBytes,
    allocatedBytes: storageBytes !== null && indexBytes !== null ? storageBytes + indexBytes : null,
    collections: statistic(stats.collections), documents: statistic(stats.objects) }
}

export function formatDatabaseBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "Unavailable"
  if (value < 1024) return `${value.toLocaleString("en-IN")} B`
  const units = ["KiB", "MiB", "GiB", "TiB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)) - 1)
  return `${(value / 1024 ** (index + 1)).toFixed(2)} ${units[index]}`
}
