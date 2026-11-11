import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLoader } from './source-loader.mjs'

test('new checkout intents atomically keep the server-priced product IDs for Razorpay recovery',async()=>{
  const inserts=[]
  const loader=sourceLoader({
    'next/headers':{cookies:async()=>({get:()=>undefined})},
    '@/lib/db-service':{getCollection:async()=>({insertOne:async doc=>{inserts.push(doc)}})},
  })
  const {createCheckoutIntent}=loader.load('lib/checkout-payment.ts')
  const token=await createCheckoutIntent('order_Fixture','account1',{amount:1234,fingerprint:'server-fingerprint',pricing:{items:[{id:'product1',name:'Fridge',quantity:2},{id:'product1',name:'Fridge',quantity:1},{id:'product2',name:'Television',quantity:4}]}},'razorpay')
  assert.equal(inserts.length,1)
  assert.deepEqual(Array.from(inserts[0].journeyProductIds),['product1','product2'])
  assert.deepEqual(JSON.parse(JSON.stringify(inserts[0].journeyItems)),[{id:'product1',name:'Fridge',quantity:2},{id:'product1',name:'Fridge',quantity:1},{id:'product2',name:'Television',quantity:4}])
  assert.equal(inserts[0].amount,123400)
  assert.equal(inserts[0].method,'razorpay')
  assert.notEqual(inserts[0].tokenHash,token)
})
