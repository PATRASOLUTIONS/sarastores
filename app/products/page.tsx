import { getPublicPageCategories } from "@/lib/public-page-data"
import { listingQueryFromUrl } from '@/lib/catalogue-listing'
import { readCatalogueListing } from '@/lib/catalogue-listing-data'
import ProductsClient from "./ProductsClient"

export const dynamic = "force-dynamic"

export default async function ProductsPage({searchParams,offersPage=false}:{searchParams?:Promise<Record<string,string|string[]|undefined>>;offersPage?:boolean}={}) {
  const params=new URLSearchParams()
  for(const [key,value] of Object.entries(await searchParams || {}))for(const entry of Array.isArray(value)?value:value?[value]:[])params.append(key,entry)
  let query
  try {query=listingQueryFromUrl(params,offersPage)}catch{query=listingQueryFromUrl(new URLSearchParams(),offersPage)}
  const [listing,categories]=await Promise.all([readCatalogueListing(query),getPublicPageCategories()])
  return <ProductsClient initialListing={listing} initialCategories={categories} />
}
