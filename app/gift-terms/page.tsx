import Link from "next/link"
import type { Metadata } from "next"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductGiftTerms from "@/components/promotions/ProductGiftTerms"

export const metadata: Metadata = { title: "Gift Terms | SARA", robots: { index: false, follow: true } }

export default async function Page({ searchParams }: { searchParams: Promise<{ productId?: string | string[] }> }) {
  const { productId } = await searchParams
  const valid = typeof productId === "string" && !!productId.trim() && productId.length <= 200 && !/[\x00-\x1f]/.test(productId)
  return <><Header /><main className="mx-auto min-h-[50vh] max-w-3xl px-5 py-10">
    <h1 className="text-2xl font-bold text-gray-900">Gift Terms*</h1>
    {valid ? <ProductGiftTerms productId={productId} /> : <p className="mt-5">Open Gift Terms from an eligible <Link href="/products" className="text-[#1560BD] underline">product page</Link>.</p>}
  </main><Footer /></>
}
