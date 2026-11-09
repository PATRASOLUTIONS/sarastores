import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLoader } from './source-loader.mjs'
const params={currency:'INR',value:100,transaction_id:'SARA-TEST-1',email:'private@example.com',phone:'9000000000',items:[{item_id:'synthetic-product',item_name:'Sensitive name must not leave',price:100,quantity:1}]}
function fixture({ready=true,advertising=false,analytics=false,configured=true}={}){
  const events=[],listeners=new Map(),storage=new Map();let allowed=advertising
  const pixel=(...args)=>events.push(args)
  const window={location:{pathname:'/fixture'},addEventListener:(name,fn)=>listeners.set(name,fn),...(ready?{fbq:pixel}:{})}
  const loader=sourceLoader({'@/lib/consent-client':{hasConsent:category=>category==='advertising'?allowed:analytics,CONSENT_CHANGE_EVENT:'consent'}},
    {env:{NEXT_PUBLIC_META_PIXEL_ID:configured?'123456789':undefined},context:{window,sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}}})
  return {events,storage,window,loader,track:loader.load('lib/meta-commerce.ts').trackMetaCommerce,
    setConsent(value){allowed=value;listeners.get('consent')?.()},ready(){window.fbq=pixel;listeners.get('sara:meta-ready')?.()}}
}
test('commerce pixel remains silent without advertising consent or a configured pixel',()=>{
  for(const options of [{advertising:false},{advertising:true,configured:false}]){const f=fixture(options);f.track('purchase',params);assert.equal(f.events.length,0)}
})
test('commerce mapping sends only allowlisted product/value fields and a stable purchase event ID',()=>{
  const f=fixture({advertising:true})
  for(const event of ['view_item','add_to_cart','begin_checkout','add_payment_info','purchase'])f.track(event,params)
  assert.deepEqual(f.events.map(event=>event[1]),['ViewContent','AddToCart','InitiateCheckout','AddPaymentInfo','Purchase'])
  const text=JSON.stringify(f.events)
  assert.equal(text.includes('private@example.com'),false);assert.equal(text.includes('9000000000'),false);assert.equal(text.includes('Sensitive name'),false)
  assert.equal(f.events[4][2].currency,'INR');assert.equal(f.events[4][3].eventID,'order-SARA-TEST-1')
  f.track('purchase',params);assert.equal(f.events.length,5)
})
test('pixel readiness flushes a bounded queue and consent withdrawal clears deferred events',()=>{
  const f=fixture({advertising:true,ready:false})
  f.track('purchase',params);f.track('purchase',params);assert.equal(f.events.length,0)
  f.ready();assert.equal(f.events.length,1)
  const cancelled=fixture({advertising:true,ready:false});cancelled.track('view_item',params);cancelled.setConsent(false);cancelled.ready();cancelled.setConsent(true)
  assert.equal(cancelled.events.length,0)
  const capped=fixture({advertising:true,ready:false});for(let i=0;i<50;i++)capped.track('view_item',params);capped.ready();assert.equal(capped.events.length,30)
})
test('missing purchase identity/value and empty ecommerce items cannot create conversions',()=>{
  const f=fixture({advertising:true})
  for(const bad of [{...params,transaction_id:''},{...params,value:NaN},{...params,value:null},{...params,currency:"USD"},{...params,items:[]},{...params,transaction_id:'bad private id'}])f.track('purchase',bad)
  f.track('begin_checkout',{});f.track('payment_failed',params)
  assert.equal(f.events.length,0)
})
test('advertising-only consent can measure commerce without GA4 or internal event persistence',()=>{
  const f=fixture({advertising:true,analytics:false})
  f.loader.load('lib/analytics.ts').track('view_item',params)
  assert.equal(f.events.length,1);assert.equal(f.window.dataLayer,undefined)
})
