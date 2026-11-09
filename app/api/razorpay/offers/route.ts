import { NextResponse } from "next/server"
import { readRazorpayOffers } from "@/lib/razorpay-offer-data"
export const dynamic = "force-dynamic"
export async function GET() {
  try {
    const items=await readRazorpayOffers()
    return NextResponse.json({items,count:items.length,source:"razorpay"},{headers:{"Cache-Control":"no-store"}})
  }catch{return NextResponse.json({error:"Bank offers are currently unavailable. Please retry."},{status:503,headers:{"Cache-Control":"no-store"}})}
}
