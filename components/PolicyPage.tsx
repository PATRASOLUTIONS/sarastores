import type React from "react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export type PolicySection = {
  heading: string
  body?: string
  bullets?: string[]
}

/**
 * Shared shell for the policy and information pages linked from the footer, so
 * they stay visually consistent and none of those links 404.
 */
export default function PolicyPage({
  eyebrow,
  title,
  intro,
  sections,
  footnote,
  children,
}: {
  eyebrow?: string
  title: string
  intro?: string
  sections?: PolicySection[]
  footnote?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-grow bg-gray-50">
        <section className="bg-gradient-to-br from-brand-hero-from via-brand-hero-via to-brand-hero-to text-white">
          <div className="section-container py-12 md:py-16">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">{eyebrow}</p>
            )}
            <h1 className="mt-3 font-heading text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
            {intro && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">{intro}</p>}
          </div>
        </section>

        <div className="section-container py-10 md:py-14">
          <div className="mx-auto max-w-4xl rounded-2xl border border-brand-border bg-white p-6 shadow-sm md:p-10">
            {sections?.map(({ heading, body, bullets }) => (
              <section key={heading} className="mb-8 last:mb-0">
                <h2 className="font-heading text-lg font-bold text-brand-text-primary md:text-xl">{heading}</h2>
                {body && <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary">{body}</p>}
                {bullets && bullets.length > 0 && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-brand-text-secondary">
                    {bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {children}

            {footnote && (
              <p className="mt-8 border-t border-brand-border pt-6 text-sm text-brand-text-secondary">
                {footnote}{" "}
                <Link href="/contact" className="font-semibold text-brand-primary hover:underline">
                  Contact our team
                </Link>{" "}
                or visit your nearest{" "}
                <Link href="/store-locator" className="font-semibold text-brand-primary hover:underline">
                  SARA store
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
