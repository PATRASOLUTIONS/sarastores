import PublicGift from '@/components/diwali/PublicGift'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Diwali Gift Registration | SARA', description: 'Register your SARA Diwali invoice and follow your gift delivery.', robots: { index: false, follow: false } }
export default function Page() { return <PublicGift mode="terms" /> }

