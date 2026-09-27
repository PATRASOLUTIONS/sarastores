import { redirect } from "next/navigation"

// Search is served by the catalogue page; this route only exists as a legacy entry point.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  redirect(q ? `/products?search=${encodeURIComponent(q)}` : "/products")
}
