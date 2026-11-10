import test from 'node:test'
import assert from 'node:assert/strict'
import { Aggregator, Query } from 'mingo'
import { sourceLoader } from './source-loader.mjs'
const now=new Date('2026-11-10T12:00:00Z'),start=new Date('2026-10-27T12:00:00Z')
function fixture(){
  const db={orders:[
    {_id:'order-db',orderId:'SAR-1',customer:{name:'Asha',email:'asha@example.com',phone:'9876543210'},items:[{id:'p1',name:'Fridge'}],paymentMethod:'paytm',paymentDetails:{status:'failed'},total:12500,createdAt:new Date(+now-86400000),updatedAt:new Date(+now-3600000),password:'never-return',guestAccessTokenHash:'never-return'},
    {_id:'paid',orderId:'SAR-PAID',userId:'paid-user',customer:{name:'Paid customer'},items:[{id:'p2'}],paymentDetails:{status:'completed'},paymentVerification:{verified:true},createdAt:new Date(+now-3600000)},
  ],payments:[
    {_id:'legacy-payment',orderId:'SAR-1',status:'FAILED',amount:12500,method:'paytm',createdAt:new Date(+now-7200000),providerPayload:{card:'never-return'}},
    {_id:'standalone',status:'failed',customer:{name:'Guest without tracking',email:'guest@example.com',phone:'9876543211'},items:[{productId:'p3',name:'Television'}],amount:20000,createdAt:new Date(+now-1800000),method:'razorpay'},
    {_id:'stale-failure',orderId:'SAR-PAID',status:'failed',createdAt:new Date(+now-1800000)},
    {_id:'successful',status:'COMPLETED',paymentStatus:'failed',createdAt:new Date(+now-1800000)},
    {_id:'too-old',status:'failed',createdAt:new Date(+start-1)},
  ],checkout_intents:[{_id:'intent-failure',userId:'account1',status:'declined',journeyProductIds:['p4'],amount:990000,method:'razorpay',createdAt:new Date(+now-600000),tokenHash:'never-return'}]}
  const loader=sourceLoader({'@/lib/db-service':{getCollection:async name=>({
    aggregate:pipeline=>({toArray:async()=>new Aggregator(pipeline,{collectionResolver:n=>db[n] || []}).run(db[name])}),
    findOne:async filter=>db[name].find(d=>new Query(filter).test(d)) || null,
  })}})
  return {db,lib:loader.load('lib/recovery-payment-data.ts')}
}
test('reads current database failures without browser events, joins orders and returns safe customer/product DTOs',async()=>{
  const {lib}=fixture(),result=await lib.getDatabasePaymentFailures(start,now)
  assert.equal(result.total,3)
  const order=result.rows.find(r=>r.email==='asha@example.com')
  assert.equal(order.failureSource,'orders');assert.equal(order.failureReference,'order-db')
  assert.deepEqual(Array.from(order.productIds),['p1']);assert.equal(order.failureProductName,'Fridge')
  const guest=result.rows.find(r=>r.email==='guest@example.com')
  assert.equal(guest.name,'Guest without tracking');assert.match(guest.id,/^f:[a-f0-9]{64}$/)
  assert.equal(guest.paymentAmount,20000)
  assert.equal(result.rows.find(r=>r.id==='u:account1').paymentAmount,9900)
  assert.doesNotMatch(JSON.stringify(result),/never-return|providerPayload|tokenHash|password|guestAccessTokenHash/)
  assert.ok(result.rows.every(r=>!r.id.includes('@')))
})
test('stored failure product names and quantities survive order joins and intent snapshots safely',async()=>{
  const {db,lib}=fixture()
  db.orders[0].items[0].quantity=2
  db.payments.find(p=>p._id==='standalone').items[0].quantity='4'
  db.checkout_intents[0].journeyItems=[{id:'p4',name:'Saved washer',quantity:3,privateNote:'never-return'}]
  const rows=(await lib.getDatabasePaymentFailures(start,now)).rows
  assert.equal(rows.find(r=>r.email==='asha@example.com').recoveryItems[0].quantity,2)
  assert.equal(rows.find(r=>r.email==='guest@example.com').recoveryItems[0].quantity,4)
  assert.deepEqual(JSON.parse(JSON.stringify(rows.find(r=>r.id==='u:account1').recoveryItems)),[{id:'p4',name:'Saved washer',quantity:3}])
  assert.doesNotMatch(JSON.stringify(rows),/never-return|privateNote/)
})

test('database failure pagination reports complete count and returns distinct latest failures',async()=>{
  const {lib}=fixture()
  const first=await lib.getDatabasePaymentFailures(start,now,1,1),second=await lib.getDatabasePaymentFailures(start,now,2,1)
  assert.equal(first.total,3);assert.equal(second.total,3);assert.notEqual(first.rows[0].id,second.rows[0].id)
  assert.equal(first.rows[0].id,'u:account1')
})
test('successful status in any payment field wins over stale failure data, including linked orders',async()=>{
  const {db,lib}=fixture()
  db.orders.push({_id:'paid-status',orderId:'SAR-STATUS',status:'paid',paymentDetails:{status:'failed'},updatedAt:now})
  db.payments.push({_id:'linked-paid-status',orderId:'SAR-STATUS',status:'failed',createdAt:now})
  db.payments.push({_id:'paid-field',paymentStatus:'captured',paymentDetails:{status:'failed'},createdAt:now})
  assert.equal((await lib.getDatabasePaymentFailures(start,new Date(+now+1))).total,3)
})
test('gateway is available from paymentDetails and stored ISO timestamps are accepted',async()=>{
  const {db,lib}=fixture()
  delete db.orders[0].paymentMethod
  db.orders[0].paymentDetails.method='paytm'
  db.orders[0].updatedAt=new Date(+now-3600000).toISOString()
  const row=(await lib.getDatabasePaymentFailures(start,now)).rows.find(r=>r.failureReference==='order-db')
  assert.equal(row.paymentGateway,'paytm')
  assert.equal(row.paymentFailedAt,db.orders[0].updatedAt)
})
test('rechecks stored failure status and stops after resolution, including uppercase success',async()=>{
  const {db,lib}=fixture()
  assert.equal(await lib.databaseFailureStillFailed('payments','standalone'),true)
  db.payments.find(p=>p._id==='standalone').status='COMPLETED'
  assert.equal(await lib.databaseFailureStillFailed('payments','standalone'),false)
  assert.equal(await lib.databaseFailureStillFailed('users','anything'),false)
})
