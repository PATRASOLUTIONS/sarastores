'use client'

import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { z } from 'zod'
import { apiFetchJson } from '@/lib/api-client'
import { onlineCampaignOpen, onlineGift, type OnlineGift } from '@/lib/diwali/online-rules'

const CampaignSchema = z.object({ enabled: z.boolean(), campaignStart: z.string(), campaignEnd: z.string(), registrationStart: z.string(), registrationEnd: z.string(), consentVersion: z.string() })
const loadCampaign = (url: string) => apiFetchJson(url, {}, value => CampaignSchema.parse(value))
export default function CartDiwaliGift({ total, shipping = 0, checkout = false, confirmedGift }: {
  total: number; shipping?: number; checkout?: boolean; confirmedGift?: OnlineGift | null;
}) {
  const { data: config } = useSWR('/api/diwali/config', loadCampaign, { refreshInterval: 30_000, revalidateOnFocus: true })
  if (!config || !onlineCampaignOpen(config)) return null
  const gift = confirmedGift === undefined ? onlineGift(config, total, shipping) : confirmedGift
  const eligibleValue = Math.max(0, Math.round((total - shipping) * 100) / 100)
  return <section aria-label="Diwali gift" className="overflow-hidden rounded-xl border border-amber-200 bg-[#fff8e8]">
    <Image src="/images/diwali-2026.webp" alt="SARA Diwali Dhamaka" width={1600} height={625} className="h-auto w-full" />
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-red-900">Your Diwali gift</h2>{gift && <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">{checkout ? 'Auto applied' : 'Included at checkout'}</span>}</div>
      <p className="text-lg font-bold text-[#8d5500]">{gift ? gift.label : eligibleValue < 15000 ? `Add ₹${(15000 - eligibleValue).toLocaleString('en-IN', { maximumFractionDigits: 2 })} to qualify` : 'Whole-rupee invoice value required'}</p>
      <p className="text-xs leading-5 text-stone-600">{gift ? 'Your order and delivery details register automatically. No separate gift form is needed. Gift approval follows payment confirmation and SARA verification.' : 'Eligible purchases start at ₹15,000. Gift eligibility uses the amount after discounts, including GST and excluding delivery charges.'}</p>
      <p className="text-xs text-stone-600"><Link className="underline" href="/diwali-gift/terms" target="_blank">Campaign terms</Link> · <Link className="underline" href="/diwali-gift/privacy" target="_blank">Privacy notice</Link></p>
    </div>
  </section>
}
