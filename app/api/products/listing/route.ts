import { type NextRequest, NextResponse } from 'next/server'
import { listingQuerySchema } from '@/lib/catalogue-listing'
import { readCatalogueListing } from '@/lib/catalogue-listing-data'
export const dynamic='force-dynamic'

/** Intentionally public, read-only storefront endpoint; no account/admin fields. */
export async function GET(request:NextRequest) {
  const state=request.nextUrl.searchParams.get('state') || '{}'
  if(state.length>12000)return NextResponse.json({error:'Listing filters are too large'},{status:400})
  let value:unknown
  try {value=JSON.parse(state)}catch{return NextResponse.json({error:'Invalid listing filters'},{status:400})}
  const parsed=listingQuerySchema.safeParse(value)
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message || 'Invalid listing filters'},{status:400})
  try {
    return NextResponse.json(await readCatalogueListing(parsed.data),{headers:{'Cache-Control':
      ['bank','no-cost-emi'].includes(parsed.data.offerTab)?'no-store':'public, max-age=0, s-maxage=30'}})
  }catch{return NextResponse.json({error:'Products could not be loaded. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
