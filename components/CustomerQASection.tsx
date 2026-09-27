"use client"

import { useState } from "react"
import { MessageCircleQuestion, Plus, ThumbsUp, ChevronDown, Search, Sparkles } from "lucide-react"
import { toast } from "react-hot-toast"

export interface QAItem {
  id: string
  question: string
  answer?: string
  askedBy?: string
  answeredBy?: string
  askedAt?: string
  helpful?: number
}

interface CustomerQASectionProps {
  productId: string
  productName: string
  /** Pre-seeded questions/answers (e.g. from the product's `qa` field). */
  seedItems?: QAItem[] | null
}

// Store-authored answers, attributed to the store. Never invent customer names,
// dates or "helpful" counts — that is fabricated social proof.
const DEFAULT_SEEDS: QAItem[] = [
  {
    id: "q1",
    question: "Is this product original and brand-new (not refurbished)?",
    answer:
      "Yes — every unit we ship is factory-sealed, sourced directly from the brand's authorised distribution channel, and covered by the full manufacturer warranty.",
    answeredBy: "Sara Electronics",
  },
  {
    id: "q2",
    question: "What is the return/replacement policy?",
    answer:
      "You can return or request a replacement within 7 days of delivery if the product is unused and in its original packaging. For defective units, we cover the reverse-pickup shipping.",
    answeredBy: "Sara Electronics",
  },
  {
    id: "q3",
    question: "What payment options are available?",
    answer:
      "You can pay online at checkout by UPI, debit/credit card, Net Banking or EMI. You can also reserve online and complete an in-store purchase at your nearest Sara Electronics showroom.",
    answeredBy: "Sara Electronics",
  },
]

export default function CustomerQASection({ productId, productName, seedItems }: CustomerQASectionProps) {
  const [items, setItems] = useState<QAItem[]>(() => {
    if (Array.isArray(seedItems) && seedItems.length > 0) return seedItems
    return DEFAULT_SEEDS
  })
  const [openAsk, setOpenAsk] = useState(false)
  const [draft, setDraft] = useState("")
  const [askName, setAskName] = useState("")
  const [askEmail, setAskEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [helpfulMap, setHelpfulMap] = useState<Record<string, 0 | 1 | -1>>({})

  const filtered = items.filter((q) =>
    !search.trim() ||
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    (q.answer || "").toLowerCase().includes(search.toLowerCase()),
  )

  const submit = async () => {
    const text = draft.trim()
    if (text.length < 8) {
      toast.error("Please write a longer question (at least 8 characters).")
      return
    }
    if (!askName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(askEmail.trim())) {
      toast.error("Please add your name and a valid email so we can reply.")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: askName.trim(),
          email: askEmail.trim(),
          subject: `Product question: ${productName}`,
          message: `${text}\n\nProduct: ${productName}\nProduct ID: ${productId}`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Could not send your question")
      }

      setDraft("")
      setOpenAsk(false)
      toast.success("Question sent \u2014 our team will reply to you by email.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your question")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageCircleQuestion className="h-6 w-6 text-brand-primary" />
            Customer Questions & Answers
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {items.length > 0
              ? `${items.length} question${items.length === 1 ? "" : "s"} from customers about this product`
              : "No questions yet — be the first to ask!"}
          </p>
        </div>
        <button
          onClick={() => setOpenAsk((s) => !s)}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Ask a question
        </button>
      </div>

      {/* Ask form */}
      {openAsk && (
        <div className="mb-6 p-4 rounded-xl border border-brand-primary/20 bg-brand-primary-subtle">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Have a question about <span className="text-brand-primary">{productName}</span>?
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What would you like to know? Be as specific as possible."
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none resize-y"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={askName}
              onChange={(e) => setAskName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
            />
            <input
              type="email"
              value={askEmail}
              onChange={(e) => setAskEmail(e.target.value)}
              placeholder="Your email"
              className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              <Sparkles className="inline h-3 w-3 mr-1 text-amber-500" />
              Tip: ask about compatibility, sizing, warranty, or installation.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setOpenAsk(false)
                  setDraft("")
                }}
                className="px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={sending}
                className="px-4 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover transition-colors disabled:opacity-60"
              >
                {sending ? "Sending\u2026" : "Send question"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile ask button */}
      <button
        onClick={() => setOpenAsk((s) => !s)}
        className="sm:hidden w-full mb-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold"
      >
        <Plus className="h-4 w-4" />
        Ask a question
      </button>

      {/* Search */}
      {items.length > 3 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions and answers"
            className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
      )}

      {/* Q&A list */}
      {filtered.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {filtered.map((q) => {
            const isOpen = expanded[q.id] ?? true
            return (
              <article key={q.id} className="py-5 first:pt-0 last:pb-0">
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [q.id]: !(s[q.id] ?? true) }))}
                  className="w-full text-left flex items-start gap-3 group"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-1.5 w-12 flex-shrink-0">Q</span>
                  <div className="flex-1">
                    <h3 className="text-sm md:text-base font-semibold text-gray-900 group-hover:text-brand-primary transition-colors">
                      {q.question}
                    </h3>
                    {q.askedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Asked by <span className="font-semibold text-gray-700">{q.askedBy || "Customer"}</span>{" "}
                        · {new Date(q.askedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-3 pl-[3rem]">
                    {q.answer ? (
                      <>
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 w-6 flex-shrink-0">A</span>
                          <p className="text-sm text-gray-800 leading-relaxed flex-1">{q.answer}</p>
                        </div>
                        <div className="mt-2 pl-9 flex items-center gap-2 text-xs text-gray-500">
                          <span>By {q.answeredBy || "Sara Electronics Team"}</span>
                          <span>·</span>
                          <button
                            onClick={() => setHelpfulMap((s) => ({ ...s, [q.id]: s[q.id] === 1 ? 0 : 1 }))}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
                              helpfulMap[q.id] === 1
                                ? "border-brand-primary bg-brand-primary-subtle text-brand-primary"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            Helpful <span className="tabular-nums">{(q.helpful || 0) + (helpfulMap[q.id] === 1 ? 1 : 0)}</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                        This question is awaiting an answer. Our team typically responds within 24 hours.
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <MessageCircleQuestion className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No matching questions</h3>
          <p className="text-sm text-gray-500">Try a different keyword, or ask a new question above.</p>
        </div>
      )}
    </section>
  )
}
