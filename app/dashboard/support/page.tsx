"use client"

import { useEffect, useState } from "react"
import { Headphones, Send } from "lucide-react"
import { toast } from "react-hot-toast"
import { z } from "zod"
import { useAuth } from "@/contexts/AuthContext"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { apiFetch } from "@/lib/api-client"
import { AccountEnquirySchema } from "@/lib/validation"
import styles from "@/components/account/account-forms.module.css"

const enquirySchema = z.object({ id: z.string(), subject: z.string(), message: z.string(), status: z.string(), createdAt: z.string(), orderNumber: z.string().optional() })
type Enquiry = z.infer<typeof enquirySchema>
const categories = ["general", "order", "product", "shipping", "returns", "payment", "technical", "feedback", "other"] as const

export default function SupportPage() {
  const { user } = useAuth()
  const [draft, setDraft] = useState({ subject: "", phone: "", category: "general", orderNumber: "", message: "" })
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [sending, setSending] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const lock = useSubmitLock()
  useEffect(() => { setDraft(current => ({ ...current, phone: user?.phone || "" })) }, [user?.id, user?.phone])
  useEffect(() => {
    const controller = new AbortController()
    setEnquiries([])
    setLoading(true)
    setError("")
    setConfirmation("")
    const load = async () => {
      try {
        const response = await apiFetch("/api/account/enquiries", { signal: controller.signal })
        if (!response.ok) throw new Error("Your enquiries could not be loaded")
        const data = z.object({ enquiries: z.array(enquirySchema) }).parse(await response.json())
        if (!controller.signal.aborted) setEnquiries(data.enquiries)
      } catch (failure) {
        if (controller.signal.aborted) return
        console.error("[Support] Enquiries failed:", failure)
        setError("Your previous enquiries could not be loaded.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    if (user?.id) void load()
    return () => controller.abort()
  }, [user?.id, attempt])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!lock.acquire()) return
    const parsed = AccountEnquirySchema.safeParse(draft)
    if (!parsed.success) { lock.release(); toast.error(parsed.error.issues[0].message); return }
    setSending(true)
    setConfirmation("")
    try {
      const response = await apiFetch("/api/account/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Your enquiry could not be sent")
      const enquiry = enquirySchema.parse(data.enquiry)
      setEnquiries(current => [enquiry, ...current])
      setConfirmation("Your enquiry has been sent. Our support team will reply using your account email or phone.")
      setDraft(current => ({ ...current, subject: "", message: "", orderNumber: "" }))
      toast.success("Enquiry sent")
    } catch (failure) {
      console.error("[Support] Submission failed:", failure)
      toast.error(failure instanceof Error ? failure.message : "Your enquiry could not be sent")
    } finally { setSending(false); lock.release() }
  }
  return <div className="space-y-5"><section className={styles.panel}>
    <header><Headphones size={26} /><div><h1>Help &amp; Support</h1><p>Send an enquiry without leaving your dashboard.</p></div></header>
    <h2>New Enquiry</h2><p>We will contact {user?.email || "your account email"}. Include your order number when asking about a purchase.</p>
    <form onSubmit={submit}><fieldset disabled={sending}><div className={styles.fields}>
      <label>Enquiry type<select name="category" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>)}</select></label>
      <label>Phone number<input name="phone" type="tel" required maxLength={10} value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} autoComplete="tel" /></label>
      <label>Subject<input name="subject" required minLength={5} maxLength={200} value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} /></label>
      <label>Order number (optional)<input name="orderNumber" maxLength={50} value={draft.orderNumber} onChange={event => setDraft({ ...draft, orderNumber: event.target.value })} placeholder="SARAECOM-..." /></label>
      <label className={styles.wide}>Your message<textarea name="message" required minLength={20} maxLength={2000} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} placeholder="Tell us how we can help (at least 20 characters)." /></label>
    </div><button type="submit" className={styles.primary}><Send size={16} />{sending ? "Sending..." : "Send Enquiry"}</button></fieldset></form>
    {confirmation && <p role="status" className={`${styles.notice} mt-4`}>{confirmation}</p>}
  </section><section className={styles.panel}><h2>My Enquiries</h2>
    {loading ? <p role="status">Loading your enquiries...</p> : error ? <p role="alert" className={styles.notice}>{error}<button type="button" onClick={() => setAttempt(value => value + 1)}>Retry enquiries</button></p> :
      enquiries.length ? <ul className={styles.history}>{enquiries.map(enquiry => <li key={enquiry.id}><div><strong>{enquiry.subject}</strong><span>{enquiry.status === "new" ? "Submitted" : enquiry.status}</span></div>
        <small>{new Date(enquiry.createdAt).toLocaleDateString("en-IN")}{enquiry.orderNumber ? ` · ${enquiry.orderNumber}` : ""}</small><p>{enquiry.message}</p></li>)}</ul> :
        <p>You have no enquiries yet. Use the form above whenever you need help.</p>}
  </section></div>
}
