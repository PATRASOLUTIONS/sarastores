import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import LuckyDrawClient from "./LuckyDrawClient"

export const dynamic = "force-dynamic"

// The declared contest period is historical. Never show an entry form after it ends.
const campaignEndsAt = Date.parse("2026-02-28T23:59:59+05:30")

export default function LuckyDrawPage() {
  if (Date.now() <= campaignEndsAt) return <LuckyDrawClient />
  return <div className="flex min-h-screen flex-col bg-slate-950 text-white">
    <Header />
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 md:py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Archived campaign</p>
      <h1 className="mt-4 text-3xl font-bold md:text-5xl">Shubham Lucky Draw ? Campaign Closed</h1>
      <p className="mt-6 text-lg leading-relaxed text-slate-200">The advertised campaign period was 15 January to 28 February 2026. That period has ended, and entries are closed.</p>
      <p className="mt-4 leading-relaxed text-slate-300">For questions about a previous entry or published results, contact our team. This archive does not offer a current prize promotion.</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/contact" className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950">Contact our team</Link>
        <Link href="/products" className="rounded-lg border border-slate-500 px-5 py-3 font-semibold text-white">Browse current products</Link>
      </div>
    </main>
    <Footer />
  </div>
}
