import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLoader } from './source-loader.mjs'
const env={RAZORPAY_KEY_ID:'synthetic-offer-key',RAZORPAY_KEY_SECRET:'synthetic-offer-secret'}
test('concurrent bank offer reads coalesce and preserve provider paise-to-INR eligibility',async()=>{
  let reads=0
  const loader=sourceLoader({}, {env,fetch:async()=>{reads++;return Response.json({items:[{id:'synthetic-offer',name:'HDFC card offer',active:true,min_amount:3000000,discount_amount:50000,max_discount:100000,starts_at:1,ends_at:9999999999}]})}})
  const {readRazorpayOffers}=loader.load('lib/razorpay-offer-data.ts')
  const [a,b]=await Promise.all([readRazorpayOffers(),readRazorpayOffers()])
  assert.equal(reads,1);assert.equal(a[0].min_amount,30000);assert.equal(a[0].discount_amount,500);assert.equal(a[0].max_discount,1000)
  a[0].min_amount=1;assert.equal(b[0].min_amount,30000)
  const {applicableOffers}=loader.load('lib/razorpay-offers.ts')
  assert.equal(applicableOffers(b,29999).length,0);assert.equal(applicableOffers(b,30000).length,1)
})
test('provider failures are retried rather than cached as an empty successful offer list',async()=>{
  let reads=0
  const {readRazorpayOffers}=sourceLoader({}, {env,fetch:async()=>++reads===1?Response.json({error:'synthetic-private-provider-details'},{status:503}):Response.json({items:[]})}).load('lib/razorpay-offer-data.ts')
  await assert.rejects(readRazorpayOffers(),error=>!error.message.includes('synthetic-private-provider-details'))
  assert.equal((await readRazorpayOffers()).length,0);assert.equal(reads,2)
})
test('missing offer configuration makes the public endpoint unavailable without contacting a provider',async()=>{
  const route=sourceLoader({}, {env:{RAZORPAY_KEY_SECRET:undefined}}).load('app/api/razorpay/offers/route.ts')
  const response=await route.GET()
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store')
})
