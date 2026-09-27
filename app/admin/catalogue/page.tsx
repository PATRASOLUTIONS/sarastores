import CatalogueManager, { type CatalogueTab } from "@/components/admin/CatalogueManager"

const isTab = (value?: string): value is CatalogueTab =>
  value === "categories" || value === "subcategories" || value === "brands"

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return <CatalogueManager initialTab={isTab(tab) ? tab : "categories"} />
}