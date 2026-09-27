"use client"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Gift, BellRing, CheckCircle2, Loader2, MessageCircle } from "lucide-react"

const perks = [
  "First dibs on sales, 24h before everyone",
  "Price-drop alerts on items you love",
  "Early access to the Sara Rewards Club at launch",
  "A birthday treat, every year",
]

export default function CommunityJoin() {
  const [form, setForm] = useState({ name: "", phone: "", pincode: "" })
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const lock = useSubmitLock()

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 3) return toast.error("Please enter your name")
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) return toast.error("Enter a valid 10-digit mobile number")
    if (!/^\d{6}$/.test(form.pincode.trim())) return toast.error("Enter a valid 6-digit pincode")
    if (!lock.acquire()) return

    setStatus("loading")
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ""),
          pincode: form.pincode.trim(),
          category: "Sara Rewards Club",
          source: "Homepage — Join the family",
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Something went wrong")
      setStatus("done")
      toast.success("Welcome to the Sara family! 🎉")
    } catch (err: any) {
      setStatus("idle")
      toast.error(err.message || "Could not sign you up. Please try again.")
    } finally {
      lock.release()
    }
  }

  return (
    <section
      aria-labelledby="community-heading"
      className="overflow-hidden rounded-3xl border border-brand-border bg-white shadow-sm"
    >
      <div className="grid md:grid-cols-2">
        {/* Pitch */}
        <div className="relative overflow-hidden bg-brand-primary-hover p-6 text-white md:p-9">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Gift className="h-3.5 w-3.5" /> Join the Sara family
          </span>
          <h2 id="community-heading" className="relative mt-3 text-2xl font-extrabold leading-tight md:text-3xl">
            Sign up once. Save on every visit.
          </h2>
          <p className="relative mt-2 max-w-md text-sm text-white/70">
            Join free for early access to sales and price drops. We only message you when it&apos;s worth it —
            real deals, real drops, no spam.
          </p>
          <ul className="relative mt-5 space-y-2">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm text-white/85">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-amber-300" />
                {perk}
              </li>
            ))}
          </ul>
          <div className="relative mt-6 flex flex-wrap gap-3 text-xs text-white/60">
            <Link href="/register" className="inline-flex items-center gap-1.5 font-semibold text-white underline-offset-2 hover:underline">
              Prefer a full account? Register here
            </Link>
          </div>
        </div>

        {/* Capture */}
        <div className="p-6 md:p-9">
          {status === "done" ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-success/10 text-brand-success">
                <CheckCircle2 className="h-9 w-9" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-brand-text-primary">You&apos;re in! 🎉</h3>
              <p className="mt-1 max-w-xs text-sm text-brand-text-secondary">
                Our team will WhatsApp you the best deals for your area — and you&apos;ll be first to know when the Sara Rewards Club opens.
              </p>
              <Link
                href="/products"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex h-full flex-col justify-center">
              <div className="mb-4 flex items-center gap-2 text-brand-primary">
                <BellRing className="h-5 w-5" />
                <p className="text-sm font-bold">Get early access to every deal</p>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="Your name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text-primary outline-none transition-colors focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/20"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="Mobile number"
                    autoComplete="tel"
                    maxLength={10}
                    className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text-primary outline-none transition-colors focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/20"
                    required
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={update("pincode")}
                    placeholder="Pincode"
                    autoComplete="postal-code"
                    maxLength={6}
                    className="w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text-primary outline-none transition-colors focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/20"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-3 text-sm font-bold text-[#3a2606] shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing you up…
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4" /> Join the family
                  </>
                )}
              </button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-brand-text-tertiary">
                <MessageCircle className="h-3 w-3" />
                We&apos;ll only reach out on WhatsApp with deals worth your time.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
