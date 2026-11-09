import { z } from 'zod'
import { productListingResponseSchema } from '@/lib/product-card-response'

const labels = z.array(z.string().min(1).max(160)).max(30)
const listingSortSchema=z.enum(['relevance','price-asc','price-desc','discount','rating','newest','name-asc'])
export const listingQuerySchema = z.object({
  search: z.string().max(200).default(''), divisions: labels.default([]), categories: labels.default([]),
  segments: labels.default([]), subCategories: labels.default([]), brands: labels.default([]),
  minPrice: z.number().finite().min(0).max(100000000).default(0), maxPrice: z.number().finite().positive().max(100000000).nullable().default(null),
  minDiscount: z.number().min(0).max(100).default(0), minRating: z.number().min(0).max(5).default(0),
  availability: z.enum(['all','in','out']).default('in'),
  facets: z.record(labels).refine(v=>Object.keys(v).length<=30,'Too many facets').default({}),
  sort: listingSortSchema.default('relevance'),
  offerTab: z.enum(['all-products','all-offers','brand','bank','no-cost-emi','festival','exchange','bundle','online']).default('all-products'),
  offersPage: z.boolean().default(false), page: z.number().int().min(1).max(10000).default(1),
}).superRefine((q,ctx)=>{if(q.maxPrice!==null && q.maxPrice<q.minPrice)ctx.addIssue({code:'custom',message:'Invalid price range'})})
export type ListingQuery = z.infer<typeof listingQuerySchema>
export interface ListingCategory { id:string; name:string; icon?:string }
const counts = z.array(z.tuple([z.string(),z.number().int().nonnegative()]))
export const listingResultSchema = z.object({
  query:listingQuerySchema, products:z.array(productListingResponseSchema).max(24), total:z.number().int().nonnegative(),
  page:z.number().int().positive(), totalPages:z.number().int().positive(),
  divisionCounts:counts, segmentCounts:counts, categoryCounts:counts, subCategoryCounts:counts, brandCounts:counts,
  availabilityCounts:z.object({in:z.number(),out:z.number()}), priceBounds:z.object({min:z.number(),max:z.number()}),
  priceBandCounts:z.array(z.number()), discountBandCounts:z.array(z.number()), ratingBandCounts:z.array(z.number()),
  facets:z.array(z.object({key:z.string(),label:z.string(),values:z.array(z.object({value:z.string(),count:z.number()}))})),
})
export type ListingResult = z.infer<typeof listingResultSchema>
export const LISTING_PAGE_SIZE=24
export function listingQueryFromUrl(params:URLSearchParams,offersPage=false):ListingQuery {
  const encoded=params.get('listing')
  if(encoded){if(encoded.length>12000)throw new Error('Listing filters are too large');return listingQuerySchema.parse({...JSON.parse(encoded),offersPage})}
  const list=(...keys:string[])=>{const v=keys.map(k=>params.get(k)).find(Boolean);return v?v.split(',').map(s=>s.trim()).filter(Boolean):[]}
  const number=(key:string,fallback:number)=>{const n=Number(params.get(key));return params.has(key) && Number.isFinite(n)?n:fallback}
  const facets:Record<string,string[]>={}
  if(params.get('size'))facets.screenSize=[`${params.get('size')}"`]
  if(params.get('star'))facets.energyRating=[`${params.get('star')} Star`]
  if(params.getAll('feature').length)facets.smartFeatures=params.getAll('feature').map(f=>f.replace(/\b\w/g,c=>c.toUpperCase()))
  const sort=params.get('sort') || 'relevance'
  const availability=params.get('availability') || (offersPage?'all':'in')
  return listingQuerySchema.parse({search:params.get('search') || params.get('q') || '',
    divisions:list('division','divisions'),segments:list('segment','segments'),categories:list('category'),
    subCategories:[...list('subCategory'),...list('subCategories')],brands:list('brand','brands'),
    minPrice:Math.max(0,number('minPrice',0)),maxPrice:number('maxPrice',0)>0?number('maxPrice',0):null,
    sort:listingSortSchema.safeParse(sort).success?sort:'relevance',
    availability:['all','in','out'].includes(availability)?availability:(offersPage?'all':'in'),
    facets,offersPage,offerTab:offersPage && params.size===0?'all-offers':'all-products',page:Math.max(1,number('page',1)),
  })
}

