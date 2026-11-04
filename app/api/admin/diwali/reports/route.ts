import { requireUser } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { reports, exportClaims } from '@/lib/diwali/service'
import * as XLSX from 'xlsx'
export async function GET(request: Request) { try { const guard = await requireUser(); if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams, format = params.get('format');
  if (format === 'csv' || format === 'xlsx') {
    const csv = await exportClaims(guard.user, params);
    if (format === 'csv') return new Response('\uFEFF' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="sara-diwali-claims.csv"', 'Cache-Control': 'private, no-store' } });
    const workbook = XLSX.read(csv, { type: 'string', raw: true });
    return new Response(new Uint8Array(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="sara-diwali-claims.xlsx"', 'Cache-Control': 'private, no-store' } });
  }
  return json(await reports(guard.user, new URL(request.url).searchParams)) } catch (error) { return errorResponse(error) } }
