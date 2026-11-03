import { requireUser } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { addStock, authorize, getConfig, COLLECTIONS } from '@/lib/diwali/service'
import { getCollection, normalizeId } from '@/lib/db-service'
import { StockSchema } from '@/lib/diwali/schemas'
export async function GET() { try { const guard = await requireUser(); if (!guard.ok) return guard.response; authorize(guard.user, await getConfig(), 'view'); return json({ items: (await (await getCollection(COLLECTIONS.stock)).find({}).toArray()).map(normalizeId) }) } catch (error) { return errorResponse(error) } }
export async function POST(request: Request) { try { requireSameOrigin(request); const guard = await requireUser(); if (!guard.ok) return guard.response; const input = await body(request, StockSchema); await addStock(guard.user, input.giftCode, input.quantity, input.note); return json({ saved: true }) } catch (error) { return errorResponse(error) } }
