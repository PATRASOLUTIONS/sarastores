import { catalogueBrand } from '@/lib/product-metadata-sheet'
import { normalizeProductForSchema } from '@/lib/product-schema'
import { calculateDiscount, getCatalogMRP, getCatalogRatingInfo } from '@/lib/product-display'
import { categoryOf, isInStock } from '@/utils/catalog'
import { applicableOffers, isEmiOffer, isNoCostEmiOffer, type LiveRazorpayOffer } from '@/lib/razorpay-offers'
import { buildMobileFacets, buildSelectionAwareFacets, facetValuesFor, mobileFacetValuesFor, matchesFacetValues, type Facet } from '@/lib/product-facets'
import { productListingResponseSchema, type ProductListingResponse as Product } from '@/lib/product-card-response'

export * from '@/lib/catalogue-listing-contract'
import { LISTING_PAGE_SIZE, type ListingCategory, type ListingQuery, type ListingResult } from '@/lib/catalogue-listing-contract'
const equal=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase()
type Dimension='search'|'division'|'category'|'segment'|'subCategory'|'brand'|'price'|'discount'|'rating'|'availability'

/** Read-time normalized index stays on the server; never serialize it to the browser. */
export function buildListingIndex(products:Product[]) {
  return products.map(product=>{
    const meta=normalizeProductForSchema(product)
    const sub=String(product.subCategory || meta.subCategoryProdDesc || '')
    const normalizedSub=sub.toLowerCase().startsWith('tv ') || sub.toLowerCase()==='tv'?'TV':sub
    return {product,division:String(product.division ?? ''),segment:String(product.segment ?? ''),
      category:String(product.groupName || product.category || meta.categoryGroupName || ''),sub,normalizedSub,
      shopperCategory:categoryOf({...product,subCategory:sub}) || normalizedSub,brand:catalogueBrand(product),
      price:Number(product.price),mrp:getCatalogMRP(product),rating:getCatalogRatingInfo(product).rating,
      inStock:isInStock(product),search:`${product.name}\n${product.description || ''}`.toLowerCase(),
      facetValues:facetValuesFor(product),mobileFacetValues:mobileFacetValuesFor(product)}
  })
}
export type ListingIndex=ReturnType<typeof buildListingIndex>
type Entry=ListingIndex[number]

/** Bounded public card DTO: detail blobs and raw imports remain on product pages. */
function card(product:Product):Product {
  const allowed=['id','slug','name','price','image','stock','category','division','segment','brand','taxonomySource',
    'mrp','sku','subCategory','groupName','manufacturer','manufacturerName','manufacturer_name','rating','reviewsCount',
    'reviewCount','createdAt','updatedAt','active','trusted']
  const rating=getCatalogRatingInfo(product)
  const fields=Object.fromEntries(allowed.filter(k=>product[k]!==undefined).map(k=>[k,product[k]]))
  const features=[product.features,product.characteristics].flatMap(v=>Array.isArray(v)?v:typeof v==='string'?[v]:[])
    .filter((v):v is string=>typeof v==='string').slice(0,5).map(v=>v.slice(0,300))
  return productListingResponseSchema.parse({...fields,rating:rating.rating,reviewsCount:rating.count,description:product.description.slice(0,240),
    images:product.images?.slice(0,2),features,characteristics:features})
}

/** Preserve OR-within / AND-across filters and counts excluding their own dimension. */
export function queryListing(index:ListingIndex,categories:ListingCategory[],q:ListingQuery,offers:LiveRazorpayOffer[]=[]):ListingResult {
  const eligible=index.filter(p=>{
    if(q.offerTab==='all-offers' || q.offerTab==='brand')return p.price>0 && p.mrp>p.price
    if(q.offerTab==='bank')return applicableOffers(offers,p.price).some(o=>!isEmiOffer(o))
    if(q.offerTab==='no-cost-emi')return applicableOffers(offers,p.price).some(isNoCostEmiOffer)
    return !['festival','exchange','bundle','online'].includes(q.offerTab)
  })
  const matches=(p:Entry,skip:Dimension|null)=>{
    if(skip!=='search' && q.search.trim() && !p.search.includes(q.search.trim().toLowerCase()))return false
    for(const [dimension,values,label] of [['division',q.divisions,p.division],['segment',q.segments,p.segment],['brand',q.brands,p.brand]] as const)
      if(skip!==dimension && values.length && !values.some(v=>equal(v,label)))return false
    if(skip!=='category' && q.categories.length){const c=categories.find(c=>c.id===p.category || equal(c.name,p.category));if(!q.categories.some(v=>equal(v,p.category) || v===c?.id || equal(v,c?.name || '')))return false}
    if(skip!=='subCategory' && q.subCategories.length && !q.subCategories.some(v=>[p.sub,p.normalizedSub,p.shopperCategory].some(s=>equal(v,s))))return false
    if(skip!=='price' && (p.price<q.minPrice || p.price>(q.maxPrice??Infinity)))return false
    if(skip!=='discount' && calculateDiscount(p.mrp,p.price)<q.minDiscount)return false
    if(skip!=='rating' && p.rating<q.minRating)return false
    if(skip!=='availability' && (q.availability==='in' && !p.inStock || q.availability==='out' && p.inStock))return false
    return true
  }
  const values=(p:Entry)=>q.offersPage?p.facetValues:p.mobileFacetValues
  const bases=new Map<Dimension,Entry[]>()
  const base=(skip:Dimension)=>{
    let result=bases.get(skip)
    if(!result){result=eligible.filter(p=>matches(p,skip) && matchesFacetValues(values(p),q.facets));bases.set(skip,result)}
    return result
  }
  const labelCounts=(dimension:Dimension,read:(p:Entry)=>string,selected:string[],caseInsensitive=true):[string,number][]=>{
    const result=new Map<string,number>()
    for(const p of base(dimension)){const label=read(p).trim();if(label)result.set(label,(result.get(label)||0)+1)}
    for(const choice of selected)if(![...result.keys()].some(v=>caseInsensitive?equal(v,choice):v===choice))result.set(choice,0)
    return [...result].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
  }
  const filtered=eligible.filter(p=>matches(p,null))
  const facets:Facet[]=q.offersPage?buildSelectionAwareFacets(filtered.map(values),q.facets):buildMobileFacets(filtered.map(values),q.facets)
  const sorted=filtered.filter(p=>matchesFacetValues(values(p),q.facets))
  sorted.sort((a,b)=>{
    if(q.sort==='price-asc')return a.price-b.price
    if(q.sort==='price-desc')return b.price-a.price
    if(q.sort==='discount')return calculateDiscount(b.mrp,b.price)-calculateDiscount(a.mrp,a.price)
    if(q.sort==='rating')return b.rating-a.rating
    if(q.sort==='name-asc')return a.product.name.localeCompare(b.product.name)
    if(q.sort==='newest')return (new Date(b.product.createdAt??b.product.updatedAt??0).getTime()||0)-(new Date(a.product.createdAt??a.product.updatedAt??0).getTime()||0)
    return Number(b.inStock)-Number(a.inStock)
  })
  const totalPages=Math.max(1,Math.ceil(sorted.length/LISTING_PAGE_SIZE)),page=Math.min(q.page,totalPages)
  const availability=base('availability'),prices=eligible.map(p=>p.price).filter(p=>Number.isFinite(p)&&p>0)
  const bounds=prices.reduce((b,p)=>({min:Math.min(b.min,p),max:Math.max(b.max,p)}),{min:Infinity,max:0})
  return {query:{...q,page},products:sorted.slice((page-1)*LISTING_PAGE_SIZE,page*LISTING_PAGE_SIZE).map(p=>card(p.product)),
    total:sorted.length,page,totalPages,facets,
    divisionCounts:labelCounts('division',p=>p.division,q.divisions),segmentCounts:labelCounts('segment',p=>p.segment,q.segments),
    categoryCounts:labelCounts('category',p=>p.category,q.categories),subCategoryCounts:labelCounts('subCategory',p=>p.shopperCategory,q.subCategories,false),
    brandCounts:labelCounts('brand',p=>p.brand,q.brands),availabilityCounts:{in:availability.filter(p=>p.inStock).length,out:availability.filter(p=>!p.inStock).length},
    priceBounds:{min:prices.length?Math.floor(bounds.min):0,max:prices.length?Math.ceil(bounds.max):0},
    priceBandCounts:[[0,10000],[10000,25000],[25000,50000],[50000,100000],[100000,Infinity]].map(([min,max])=>base('price').filter(p=>p.price>=min&&p.price<=max).length),
    discountBandCounts:[10,20,30,40,50].map(v=>base('discount').filter(p=>calculateDiscount(p.mrp,p.price)>=v).length),
    ratingBandCounts:[4,3,2].map(v=>base('rating').filter(p=>p.rating>=v).length)}
}
