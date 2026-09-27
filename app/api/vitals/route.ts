import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, value, rating, delta, id, navigationType, page } = body

    // Persisted so per-route INP/LCP can actually be queried later.
    const vitals = await getCollection("web_vitals")
    await vitals.insertOne({
      name: String(name || "").slice(0, 20),
      value: Number(value) || 0,
      rating: String(rating || "").slice(0, 20),
      delta: Number(delta) || 0,
      metricId: String(id || "").slice(0, 60),
      navigationType: String(navigationType || "").slice(0, 30),
      page: String(page || "").slice(0, 300),
      createdAt: new Date(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
