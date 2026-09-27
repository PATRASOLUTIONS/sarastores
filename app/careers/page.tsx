"use client"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import Link from "next/link"
import toast from "react-hot-toast"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Store,
  Truck,
  Wrench,
  Laptop,
  TrendingUp,
} from "lucide-react"

const TEAMS = [
  {
    icon: Store,
    title: "Retail & Store Sales",
    blurb: "Sales advisors, store managers and cashiers across our Karnataka showrooms.",
  },
  {
    icon: Wrench,
    title: "Service & Installation",
    blurb: "Technicians and installation engineers for appliances, panels and home setups.",
  },
  {
    icon: Truck,
    title: "Warehouse & Logistics",
    blurb: "Inventory, dispatch and last-mile delivery roles that keep orders moving.",
  },
  {
    icon: Laptop,
    title: "Digital & E-commerce",
    blurb: "Catalogue, marketing, customer support and engineering for saraelectronics.in.",
  },
]

const BENEFITS = [
  { icon: TrendingUp, title: "Grow with us", text: "Most of our store managers started on the shop floor." },
  { icon: GraduationCap, title: "Learn on the job", text: "Brand-led product training from LG, Bosch, Haier and more." },
  { icon: HeartHandshake, title: "Look after your family", text: "Staff pricing on appliances and festival bonuses." },
]

export default function CareersPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", pincode: "", team: TEAMS[0].title })
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const lock = useSubmitLock()

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.name.trim().length < 3) return toast.error("Please enter your full name")
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
          email: form.email.trim(),
          pincode: form.pincode.trim(),
          category: "Careers",
          source: `Careers page — ${form.team}`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Something went wrong")
      setStatus("done")
      toast.success("Thanks! Our hiring team will be in touch.")
    } catch (err: any) {
      setStatus("idle")
      toast.error(err.message || "Could not submit right now. Please try again.")
    } finally {
      lock.release()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-grow">
        <section className="bg-gradient-to-br from-brand-hero-from via-brand-hero-via to-brand-hero-to text-white">
          <div className="section-container py-16 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Careers</p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight md:text-5xl">
              Work with the people
              <br />
              Karnataka buys from.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300">
              We are a retail and service business first — which means the people on the floor, in the
              vans and on the phones are the product. If you like solving real problems for real
              customers, we would like to hear from you.
            </p>
            <a
              href="#apply"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-primary transition-colors hover:bg-slate-100"
            >
              Register your interest
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="section-container py-14 md:py-16">
          <h2 className="heading-2">Where you could fit</h2>
          <p className="mt-2 max-w-2xl text-brand-text-secondary">
            We hire year-round across four areas. Tell us which one sounds like you and we will contact
            you when something opens near your location.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TEAMS.map(({ icon: Icon, title, blurb }) => (
              <div
                key={title}
                className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary-light text-brand-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-heading text-base font-bold text-brand-text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-text-secondary">{blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-brand-surface py-14 md:py-16">
          <div className="section-container">
            <h2 className="heading-2">Why people stay</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-accent shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-brand-text-primary">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-brand-text-secondary">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="apply" className="section-container scroll-mt-24 py-14 md:py-16">
          <div className="mx-auto max-w-2xl rounded-3xl border border-brand-border bg-white p-6 shadow-sm md:p-9">
            <h2 className="heading-2">Register your interest</h2>
            <p className="mt-2 text-sm text-brand-text-secondary">
              No vacancy list to scroll — leave your details and the hiring team will reach out when a
              role opens near you.
            </p>

            {status === "done" ? (
              <div className="mt-8 rounded-2xl bg-brand-primary-subtle p-6 text-center">
                <p className="font-heading text-lg font-bold text-brand-primary">Thanks, {form.name.split(" ")[0]}!</p>
                <p className="mt-2 text-sm text-brand-text-secondary">
                  We have your details. Meanwhile, have a look at{" "}
                  <Link href="/about" className="font-semibold text-brand-primary underline">
                    our story
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-brand-text-primary">Full name</span>
                  <input
                    value={form.name}
                    onChange={update("name")}
                    required
                    className="mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Mobile number</span>
                  <input
                    value={form.phone}
                    onChange={update("phone")}
                    inputMode="numeric"
                    required
                    className="mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Email (optional)</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    className="mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Your pincode</span>
                  <input
                    value={form.pincode}
                    onChange={update("pincode")}
                    inputMode="numeric"
                    required
                    className="mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Area of interest</span>
                  <select
                    value={form.team}
                    onChange={update("team")}
                    className="mt-1.5 h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    {TEAMS.map((t) => (
                      <option key={t.title}>{t.title}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-60 sm:col-span-2"
                >
                  {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
