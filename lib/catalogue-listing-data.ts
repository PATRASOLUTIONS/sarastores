import { getPublicListingIndexProducts, getPublicPageCategories } from '@/lib/public-page-data'
import { buildListingIndex, queryListing, type ListingQuery } from '@/lib/catalogue-listing'
import { readRazorpayOffers } from '@/lib/razorpay-offer-data'

// Full records and precomputed specifications stay in a bounded-lifetime server
// cache. Only the chosen 24 cards and aggregate filter options leave this layer.
type IndexData={index:ReturnType<typeof buildListingIndex>;categories:Awaited<ReturnType<typeof getPublicPageCategories>>}
let pending:Promise<IndexData>|undefined,expires=0
function index():Promise<IndexData> {
  if(!pending || Date.now()>=expires){
    expires=Infinity
    pending=Promise.all([getPublicListingIndexProducts(),getPublicPageCategories()]).then(([products,categories])=>{
      expires=Date.now()+60000;return {index:buildListingIndex(products),categories}
    }).catch(error=>{pending=undefined;expires=0;throw error})
  }
  // queryListing is pure: the immutable private snapshot is not cloned into
  // every request, and its full records are never returned to a client.
  return pending
}
export async function readCatalogueListing(query:ListingQuery) {
  const [data,offers]=await Promise.all([index(),['bank','no-cost-emi'].includes(query.offerTab)?readRazorpayOffers():Promise.resolve([])])
  return queryListing(data.index,data.categories,query,offers)
}
