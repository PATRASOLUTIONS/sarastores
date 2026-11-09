import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server.js'
import { sourceLoader } from './source-loader.mjs'

const loader=sourceLoader(),lib=loader.load('lib/catalogue-listing.ts')
const {productListingResponseSchema}=loader.load('lib/product-card-response.ts')
const products=Array.from({length:240},(_,i)=>productListingResponseSchema.parse({
  id:`p-${i}`,name:`Phone ${i} ${i%2?'128GB':'256GB'}`,price:10000+i*100,mrp:50000,
  stock:i%4?5:0,category:'Phones',division:'Mobiles',segment:'Smartphones',brand:i%2?'Samsung':'Apple',
  taxonomySource:'metadata-sheet',description:'Verified product specification '.repeat(100),
  raw:{Brand:i%2?'Samsung':'Apple',privateNote:'must-never-leave-server'},technical_details:{detail:'x'.repeat(1000)},
  specifications:{'Internal Storage':i%2?'128GB':'256GB',RAM:'8GB'},
  vendorSecret:'must-never-leave-server',image:'/phone.webp'}))
const index=lib.buildListingIndex(products),categories=[{id:'phones',name:'Phones'}]
const q=lib.listingQuerySchema.parse({})

test('listing pages are bounded while counts and later pages cover the full catalogue',()=>{
  const first=lib.queryListing(index,categories,q),second=lib.queryListing(index,categories,{...q,page:2})
  assert.equal(first.products.length,24);assert.equal(first.total,180);assert.equal(first.totalPages,8)
  assert.equal(new Set([...first.products,...second.products].map(p=>p.id)).size,48)
  assert.equal(first.availabilityCounts.out,60)
  assert.equal(first.brandCounts.reduce((n,[,count])=>n+count,0),180)
})
test('server payload drops detail/private blobs and is substantially smaller than the full catalogue',()=>{
  const result=lib.queryListing(index,categories,q),text=JSON.stringify(result)
  assert.equal(text.includes('must-never-leave-server'),false)
  assert.equal(result.products.some(p=>p.raw || p.technical_details || p.vendorSecret),false)
  const before=Buffer.byteLength(JSON.stringify(products)),after=Buffer.byteLength(text)
  assert.ok(after<before/20,`${after} vs ${before}`)
})
test('cross-filter counts exclude their own dimension and retain selected zero-count labels',()=>{
  const result=lib.queryListing(index,categories,{...q,brands:['Apple']})
  assert.equal(result.total,60)
  assert.deepEqual(Array.from(result.brandCounts,([name])=>name).sort(),['Apple','Samsung'])
  const missing=lib.queryListing(index,categories,{...q,brands:['Missing Brand']})
  assert.equal(missing.total,0);assert.ok(missing.brandCounts.some(([name,count])=>name==='Missing Brand' && count===0))
})
test('bounded cards retain genuine review summaries without exposing full reviews',()=>{
  const product=productListingResponseSchema.parse({id:'reviewed',name:'Reviewed phone',price:5000,stock:1,reviews:{average:4.5,count:7}})
  const result=lib.queryListing(lib.buildListingIndex([product]),[],q)
  assert.equal(result.products[0].rating,4.5);assert.equal(result.products[0].reviewsCount,7)
  assert.equal(result.products[0].reviews,undefined)
})
test('price/stock sorting, description search and high-price products remain available',()=>{
  const result=lib.queryListing(index,categories,{...q,availability:'out',sort:'price-desc',search:'specification'})
  assert.equal(result.total,60);assert.equal(result.products[0].id,'p-236')
  const expensive=productListingResponseSchema.parse({id:'expensive',name:'Expensive TV',price:350000,stock:2})
  const broad=lib.queryListing(lib.buildListingIndex([expensive]),categories,q)
  assert.equal(broad.products[0].price,350000)
})
test('URL taxonomy, price and numbered page entry points survive server rendering',()=>{
  const url=lib.listingQueryFromUrl(new URLSearchParams('division=Mobiles&category=phones&brand=Samsung&page=2&minPrice=12000'))
  const result=lib.queryListing(index,categories,url)
  assert.equal(result.page,2);assert.ok(result.products.every(p=>p.brand==='Samsung' && p.price>=12000))
  const roundtrip=lib.listingQueryFromUrl(new URLSearchParams({listing:JSON.stringify(url)}))
  assert.equal(JSON.stringify(roundtrip),JSON.stringify(url))
})
test('specification filters operate across pages and unavailable offer categories remain empty',()=>{
  const entry=index.find(p=>Object.values(p.mobileFacetValues).some(v=>v.length))
  assert.ok(entry,'fixture must exercise specification facets')
  {const [key,v]=Object.entries(entry.mobileFacetValues).find(([,v])=>v.length)
    const result=lib.queryListing(index,categories,{...q,facets:{[key]:[v[0]]}})
    assert.ok(result.products.every(p=>index.find(e=>e.product.id===p.id).mobileFacetValues[key].includes(v[0])))
  }
  assert.equal(lib.queryListing(index,categories,{...q,offerTab:'festival'}).total,0)
})
test('public server index coalesces reads and bank offer filters use server-supplied offers',async()=>{
  let reads=0,bankReads=0
  const data=sourceLoader({
    '@/lib/public-page-data':{getPublicListingIndexProducts:async()=>{reads++;return products},getPublicPageCategories:async()=>categories},
    '@/lib/razorpay-offer-data':{readRazorpayOffers:async()=>{bankReads++;return [{id:'bank',name:'Bank discount',description:'Verified',bank:'BANK',payment_method:'card',active:true,min_amount:30000,starts_at:null,ends_at:null,type:'instant'}]}},
  }).load('lib/catalogue-listing-data.ts')
  await Promise.all([data.readCatalogueListing(q),data.readCatalogueListing({...q,page:2})])
  assert.equal(reads,1);assert.equal(bankReads,0)
  const bank=await data.readCatalogueListing({...q,offerTab:'bank'})
  assert.equal(bankReads,1);assert.ok(bank.products.every(p=>p.price>=30000))
})
test('invalid query ranges and overlarge filter lists cannot reach the public reader',async()=>{
  let reads=0
  const route=sourceLoader({'@/lib/catalogue-listing-data':{readCatalogueListing:async()=>{reads++;throw new Error('secret database error')}}}).load('app/api/products/listing/route.ts')
  for(const state of ['{bad',JSON.stringify({page:-1}),JSON.stringify({minPrice:200,maxPrice:100}),'x'.repeat(12001)]){
    const response=await route.GET(new NextRequest(`https://fixture.test/api/products/listing?state=${encodeURIComponent(state)}`))
    assert.equal(response.status,400)
  }
  assert.equal(reads,0)
  const error=await route.GET(new NextRequest('https://fixture.test/api/products/listing'))
  assert.equal(error.status,503);assert.equal(JSON.stringify(await error.json()).includes('secret database error'),false)
})
test('legacy product endpoint does not expose database exception details',async()=>{
  const route=sourceLoader({'@/lib/mongodb':{connectToDatabase:async()=>{throw new Error('synthetic-private-connection')}}},
    {context:{console:{...console,error(){}}}}).load('app/api/products/route.ts')
  const response=await route.GET(new NextRequest('https://fixture.test/api/products'))
  assert.equal(response.status,500)
  assert.equal((await response.text()).includes('synthetic-private-connection'),false)
})
test('server page sends a filtered page and categories rather than all product records',async()=>{
  let requested
  const sample=lib.queryListing(index,categories,q)
  const page=sourceLoader({
    '@/lib/catalogue-listing-data':{readCatalogueListing:async q=>{requested=q;return sample}},
    '@/lib/public-page-data':{getPublicPageCategories:async()=>categories},
    './ProductsClient':()=>null,
  }).load('app/products/page.tsx').default
  const element=await page({searchParams:Promise.resolve({brand:'Apple'})})
  assert.deepEqual(Array.from(requested.brands),['Apple'])
  assert.equal(element.props.initialListing.products.length,24)
  assert.equal(element.props.initialProducts,undefined)
})
