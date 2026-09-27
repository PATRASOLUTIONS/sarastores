import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

const QR_COLLECTION = "store_qr_codes"
const STORES_COLLECTION = "store_locations"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "all" // all, 7d, 30d, 90d, 1y
    const storeId = searchParams.get("storeId")

    const qrCol = await getCollection(QR_COLLECTION)
    const storesCol = await getCollection(STORES_COLLECTION)

    // Date filter
    let dateFilter: Date | null = null
    const now = new Date()
    if (range === "7d") dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    else if (range === "30d") dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    else if (range === "90d") dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    else if (range === "1y") dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    // Fetch all QR codes
    const storeFilter: Record<string, any> = {}
    if (storeId) storeFilter.storeId = storeId
    const qrCodes = await qrCol.find(storeFilter).toArray()

    // Fetch all stores for name mapping
    const allStores = await storesCol.find({}).toArray()
    const storeMap = new Map<string, string>()
    for (const s of allStores) {
      storeMap.set(s._id.toString(), s.shopName || "Unknown")
    }

    // Aggregate scan history across all QR codes
    const allScans: Array<{
      timestamp: Date
      storeId: string
      storeName: string
      type: string
      ip: string
      userAgent: string
    }> = []

    let totalScans = 0
    let totalQRCodes = qrCodes.length
    let activeQRCodes = 0
    const storeStats = new Map<
      string,
      { storeName: string; scans: number; qrCount: number; lastScanned: Date | null }
    >()

    for (const qr of qrCodes) {
      if (qr.isActive) activeQRCodes++
      const storeId = qr.storeId || ""
      const storeName = qr.storeName || storeMap.get(storeId) || "Unknown"

      if (!storeStats.has(storeId)) {
        storeStats.set(storeId, { storeName, scans: 0, qrCount: 0, lastScanned: null })
      }
      const stats = storeStats.get(storeId)!
      stats.qrCount++
      stats.scans += qr.scanCount || 0
      totalScans += qr.scanCount || 0

      if (qr.lastScannedAt) {
        const d = new Date(qr.lastScannedAt)
        if (!stats.lastScanned || d > stats.lastScanned) stats.lastScanned = d
      }

      // Process scan history
      for (const scan of qr.scanHistory || []) {
        const ts = new Date(scan.timestamp)
        allScans.push({
          timestamp: ts,
          storeId,
          storeName,
          type: qr.type || "unknown",
          ip: scan.ip || "",
          userAgent: scan.userAgent || "",
        })
      }
    }

    // Filter scans by date range
    const filteredScans = dateFilter
      ? allScans.filter((s) => s.timestamp >= dateFilter!)
      : allScans

    // Daily aggregation (last 30 days or per date)
    const dailyMap = new Map<string, { scans: number; google: number; whatsapp: number; instagram: number }>()
    for (const scan of filteredScans) {
      const day = scan.timestamp.toISOString().split("T")[0]
      if (!dailyMap.has(day)) dailyMap.set(day, { scans: 0, google: 0, whatsapp: 0, instagram: 0 })
      const d = dailyMap.get(day)!
      d.scans++
      if (scan.type === "google_maps") d.google++
      else if (scan.type === "whatsapp") d.whatsapp++
      else if (scan.type === "instagram") d.instagram++
    }

    // Fill missing days
    if (dateFilter) {
      const d = new Date(dateFilter)
      while (d <= now) {
        const key = d.toISOString().split("T")[0]
        if (!dailyMap.has(key)) dailyMap.set(key, { scans: 0, google: 0, whatsapp: 0, instagram: 0 })
        d.setDate(d.getDate() + 1)
      }
    }

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date: date.slice(5), ...data }))

    // Monthly aggregation
    const monthlyMap = new Map<string, { scans: number; google: number; whatsapp: number; instagram: number }>()
    for (const scan of filteredScans) {
      const month = scan.timestamp.toISOString().slice(0, 7)
      if (!monthlyMap.has(month)) monthlyMap.set(month, { scans: 0, google: 0, whatsapp: 0, instagram: 0 })
      const m = monthlyMap.get(month)!
      m.scans++
      if (scan.type === "google_maps") m.google++
      else if (scan.type === "whatsapp") m.whatsapp++
      else if (scan.type === "instagram") m.instagram++
    }

    const monthlyData = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    // Type breakdown
    const typeBreakdown = { google_maps: 0, whatsapp: 0, instagram: 0 }
    for (const scan of filteredScans) {
      if (scan.type in typeBreakdown) typeBreakdown[scan.type as keyof typeof typeBreakdown]++
    }

    // Top stores by scans
    const topStores = Array.from(storeStats.entries())
      .map(([id, stats]) => ({
        storeId: id,
        storeName: stats.storeName,
        totalScans: stats.scans,
        qrCount: stats.qrCount,
        lastScanned: stats.lastScanned?.toISOString() || null,
      }))
      .sort((a, b) => b.totalScans - a.totalScans)

    // Per-store breakdown for individual view
    const storeDetails = topStores.map((store) => {
      const storeQRs = qrCodes.filter((qr) => qr.storeId === store.storeId)
      const storeScans = filteredScans.filter((s) => s.storeId === store.storeId)

      const storeDaily = new Map<string, number>()
      for (const scan of storeScans) {
        const day = scan.timestamp.toISOString().split("T")[0]
        storeDaily.set(day, (storeDaily.get(day) || 0) + 1)
      }

      return {
        ...store,
        dailyScans: Array.from(storeDaily.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date: date.slice(5), count })),
        types: {
          google_maps: storeQRs.filter((q) => q.type === "google_maps")[0] || null,
          whatsapp: storeQRs.filter((q) => q.type === "whatsapp")[0] || null,
          instagram: storeQRs.filter((q) => q.type === "instagram")[0] || null,
        },
      }
    })

    return NextResponse.json({
      success: true,
      overview: {
        totalScans,
        totalQRCodes,
        activeQRCodes,
        totalStores: storeStats.size,
        dateRange: range,
      },
      dailyData,
      monthlyData,
      typeBreakdown,
      topStores,
      storeDetails,
      // Raw data for Excel export
      allScans: filteredScans.map((s) => ({
        timestamp: s.timestamp.toISOString(),
        storeName: s.storeName,
        type: s.type,
        ip: s.ip,
        userAgent: s.userAgent,
      })),
    })
  } catch (error) {
    console.error("Error fetching QR analytics:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
