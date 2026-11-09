import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sourceLoader } from './source-loader.mjs'

const engine=sourceLoader().load('lib/catalogue-listing.ts')
const products=Array.from({length:120},(_,i)=>({id:`fixture-${i}`,name:`Synthetic Phone ${i}`,price:10000+i*100,stock:2,brand:i%2?'Samsung':'Apple',description:'Fixture',category:'Phones',images:[]}))
const index=engine.buildListingIndex(products),categories=[{id:'phones',name:'Phones'}]
const initial=engine.queryListing(index,categories,engine.listingQuerySchema.parse({}))
const elements=node=>!node || typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(elements):[node,...elements(node.props?.children)]
function fixture(){
  const slots=[],effects=[],requests=[];let cursor=0,active=false
  const slot=initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return i}
  const hooks={...React,
    useState(initial){if(!active)return [typeof initial==='function'?initial():initial,()=>{}];const i=slot(typeof initial==='function'?initial():initial);return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
    useRef(initial){return active?slots[slot({current:initial})]:{current:initial}},useMemo:fn=>fn(),useCallback:fn=>fn,
    useEffect(fn,deps){if(!active)return;const i=slot({deps:undefined});const before=slots[i];if(!before.deps || deps.some((v,n)=>!Object.is(v,before.deps[n])))effects.push(()=>{before.cleanup?.();slots[i]={deps,cleanup:fn()}})},
  }
  const Component=sourceLoader({
    react:hooks,'next/link':({children,prefetch,...props})=>React.createElement('a',props,children),
    'next/navigation':{usePathname:()=>'/products',useSearchParams:()=>new URLSearchParams()},
    '@/components/Header':()=>null,'@/components/Footer':()=>null,'@/components/SpecFacets':()=>null,
    '@/components/products/ProductListingCard':({product})=>React.createElement('a',{'data-product-id':product.id,href:`/product/${product.id}`},product.name),
    '@/components/products/ListingBanners':{ListingHero:()=>null,ListingPromoRow:()=>null,useListingBanners:()=>[]},
    '@/components/products/OffersPresentation':{OfferTabs:()=>null,OffersHero:()=>null,OffersPromotions:()=>null,OffersTrustStrip:()=>null},
    '@/components/product/RazorpayOffers':()=>null,
    '@/hooks/useRazorpayOffers':{useRazorpayOffers:()=>({offers:[],isLoading:false,retry(){}})},
    '@/hooks/useMarketingContent':{useMarketingContent:()=>({text:()=> 'Fixture',enabled:()=>true})},
    '@/components/marketing/MarketingSections':{MarketingStatus:()=>null},
    '@/lib/api-client':{apiFetch:async url=>{requests.push(url);const q=engine.listingQuerySchema.parse(JSON.parse(new URL(url,'https://fixture.test').searchParams.get('state')));return Response.json(engine.queryListing(index,categories,q))}},
  },{context:{setInterval:()=>1,clearInterval(){},setTimeout:(fn)=>setTimeout(fn,1),clearTimeout,
    window:{addEventListener(){},removeEventListener(){}},document:{hidden:false}}}).load('app/products/ProductsClient.tsx').default
  function render(){cursor=0;active=true;try{return Component({initialListing:initial,initialCategories:categories})}finally{active=false}}
  function flush(){for(const effect of effects.splice(0))effect()}
  async function settle(){render();flush();await new Promise(resolve=>setTimeout(resolve,20));const tree=render();flush();return tree}
  return {render,flush,settle,requests,html:()=>renderToStaticMarkup(render())}
}
test('initial listing has crawlable links, bounded cards and no redundant full-catalogue fetch',()=>{
  const f=fixture(),html=f.html();f.flush()
  assert.equal((html.match(/data-product-id=/g)||[]).length,24)
  assert.match(html,/120 Products/);assert.match(html,/aria-label="Page 2"/);assert.match(html,/href="\/products\?listing=/)
  assert.equal(f.requests.length,0)
})
test('actual listing controls request matching pages, preserve filters and reset page after a filter change',async()=>{
  const f=fixture();f.render();f.flush()
  let tree=f.render()
  elements(tree).find(node=>node.type?.name==='CheckOption' && node.props.label==='Apple').props.onChange()
  tree=await f.settle()
  assert.match(f.html(),/60 Products/)
  assert.equal(JSON.parse(new URL(f.requests.at(-1),'https://fixture.test').searchParams.get('state')).brands[0],'Apple')
  const first=elements(tree).find(node=>node.props?.['aria-label']==='Product results').props.children.map(card=>card.props.product.id)
  elements(tree).find(node=>node.props?.['aria-label']==='Next page').props.onClick()
  tree=await f.settle()
  const second=elements(tree).find(node=>node.props?.['aria-label']==='Product results').props.children.map(card=>card.props.product.id)
  assert.equal(new Set([...first,...second]).size,48)
  elements(tree).find(node=>node.type?.name==='CheckOption' && node.props.label==='Samsung').props.onChange()
  await f.settle();await f.settle()
  const q=JSON.parse(new URL(f.requests.at(-1),'https://fixture.test').searchParams.get('state'))
  assert.equal(q.page,1);assert.equal(q.brands.length,2)
})
