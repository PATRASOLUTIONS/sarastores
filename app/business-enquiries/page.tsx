"use client"

import { useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import toast from "react-hot-toast"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Building2, FileText, Loader2, Package, Truck, Wrench } from "lucide-react"

const REQUIREMENTS = [
  { icon: Building2, title: "Corporate & office fit-out", text: "Televisions, air conditioners, refrigerators and appliances for new or refurbished premises." },
  { icon: Package, title: "Bulk & repeat orders", text: "Volume pricing on mobiles, laptops and appliances for teams, gifting and rollouts." },
  { icon: Wrench, title: "Installation at scale", text: "Our own engineers, scheduled site by site so your operations are not disrupted." },
  { icon: FileText, title: "GST invoicing & records", text: "Proper tax invoices, purchase orders and documentation your finance team can file." },
  { icon: Truck, title: "Karnataka-wide delivery", text: "Coordinated delivery across branches and sites from our own store network." },
]

const SEGMENTS = [
  "Corporate / office",
  "Hotel / hospitality",
  "Hospital / healthcare",
  "Education / institution",
  "Builder / real estate",
  "Retail / reseller",
  "Other",
]

export default function BusinessEnquiriesPage() {
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    pincode: "",
    segment: SEGMENTS[0],
    requirement: "",
  })
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const lock = useSubmitLock()

  const update =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
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
          category: "Business Enquiry",
          source: `Business enquiries — ${form.segment}${form.company ? ` — ${form.company.trim()}` : ""}${
            form.requirement ? ` — ${form.requirement.trim().slice(0, 160)}` : ""
          }`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Something went wrong")
      setStatus("done")
      toast.success("Thanks — our business team will call you shortly.")
    } catch (err: any) {
      setStatus("idle")
      toast.error(err.message || "Could not submit right now. Please try again.")
    } finally {
      lock.release()
    }
  }

  const inputClass =
    "mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-grow bg-gray-50">
        <section className="bg-gradient-to-br from-brand-hero-from via-brand-hero-via to-brand-hero-to text-white">
          <div className="section-container py-14 md:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">About SARA</p>
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight md:text-4xl">
              Business &amp; Bulk Enquiries
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
              Buying for an office, a hotel, a hospital or a whole building? A dedicated team handles volume
              pricing, coordinated delivery and installation across Karnataka — separate from the retail queue.
            </p>
          </div>
        </section>

        <div className="section-container grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <div>
            <h2 className="heading-2">What we handle</h2>
            <ul className="mt-6 space-y-5">
              {REQUIREMENTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-primary shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-brand-text-primary">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-brand-text-secondary">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-brand-border bg-white p-6 shadow-sm md:p-8">
            <h2 className="heading-3">Tell us what you need</h2>
            <p className="mt-2 text-sm text-brand-text-secondary">
              Share the requirement and our business team will come back with pricing and a delivery plan.
            </p>

            {status === "done" ? (
              <div className="mt-8 rounded-2xl bg-brand-primary-subtle p-6 text-center">
                <p className="font-heading text-lg font-bold text-brand-primary">Enquiry received</p>
                <p className="mt-2 text-sm text-brand-text-secondary">
                  We have your details and will call you on the number you provided.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Your name</span>
                  <input value={form.name} onChange={update("name")} required className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Company / organisation</span>
                  <input value={form.company} onChange={update("company")} className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Mobile number</span>
                  <input value={form.phone} onChange={update("phone")} inputMode="numeric" required className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Work email</span>
                  <input type="email" value={form.email} onChange={update("email")} className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Delivery pincode</span>
                  <input value={form.pincode} onChange={update("pincode")} inputMode="numeric" required className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-text-primary">Segment</span>
                  <select value={form.segment} onChange={update("segment")} className={`${inputClass} bg-white`}>
                    {SEGMENTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-brand-text-primary">Requirement</span>
                  <textarea
                    value={form.requirement}
                    onChange={update("requirement")}
                    rows={3}
                    placeholder="e.g. 40 split ACs and 12 refrigerators for a new office in Whitefield"
                    className="mt-1.5 w-full rounded-xl border border-brand-border px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-60 sm:col-span-2"
                >
                  {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send enquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
