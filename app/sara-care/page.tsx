import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { loadSaraCareConfig } from "@/lib/sara-care"

export const dynamic = "force-dynamic"
export default async function SaraCarePage() {
  const config = await loadSaraCareConfig()
  return <><Header /><main className="mx-auto max-w-3xl space-y-5 px-5 py-12">
    <h1 className="text-3xl font-bold text-maroon-800">Sara Care</h1>
    <p>Optional protection for eligible devices purchased from Sara. Choose from the protection durations available for your product, including six-month and multi-year plans. Available durations and prices depend on the product.</p>
    <p>Sara Care appears as a separate product beside the device it protects. You can change the duration or remove it before paying. Its quantity follows the covered device.</p>
    <section id="coverage-terms" className="scroll-mt-32 space-y-5">
      <h2 className="text-xl font-semibold">Coverage terms</h2>
      {config.enabled ? <><p className="whitespace-pre-wrap">{config.terms}</p><p>Coverage begins on {config.coverageStarts === "delivery" ? "delivery / collection" : "purchase after payment"}, according to these terms.</p></> : <p>Sara Care is currently unavailable. Your device purchase can proceed without it.</p>}
    </section>
  </main><Footer /></>
}
