import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { Query } from 'mingo'
import { sourceLoader } from './source-loader.mjs'

const end=new Date('2026-11-10T12:00:00Z'),start=new Date('2026-10-27T12:00:00Z')
const payment=(extra={})=>({id:'pay_Fixture',order_id:'order_Fixture',status:'failed',amount:120000,currency:'INR',created_at:+end/1000-60,email:'payer@example.com',contact:'+919876543210',...extra})
function fixture(){
  const db={checkout_intents:[{_id:'order_Fixture',method:'razorpay',amount:120000,currency:'INR',userId:'account1',journeyVisitorId:'visitor1',journeyProductIds:['product1'],status:'created',tokenHash:'never-export'}]}
  const state={items:[payment({notes:{userId:'attacker'},card:{number:'never-export'}})],entity:payment(),siblings:[payment()],status:200,requests:[],throwNetwork:false}
  const env={RAZORPAY_KEY_ID:crypto.randomUUID(),RAZORPAY_KEY_SECRET:crypto.randomBytes(32).toString('hex')}
  const loader=sourceLoader({'@/lib/db-service':{getCollection:async name=>({find(filter){return {limit(){return this},toArray:async()=>db[name].filter(d=>new Query(filter).test(d))}},findOne:async filter=>db[name].find(d=>new Query(filter).test(d)) || null})}},
    {env,fetch:async(url,options)=>{state.requests.push({url:String(url),options});if(state.throwNetwork)throw new Error('never-export');const path=new URL(url).pathname;if(path.endsWith('/orders/order_Fixture')){if(state.throwOrder)throw Error('unavailable');return Response.json(state.orderEntity || {})}return Response.json(path.endsWith('/order_Fixture/payments')?{items:state.siblings}:path.endsWith('/pay_Fixture')?state.entity:{items:state.items},{status:state.status})}})
  return {db,state,env,lib:loader.load('lib/recovery-razorpay.ts'),loader}
}

test('authenticated Razorpay failures are bound to local checkouts, use paise correctly and never expose raw payment or token data',async()=>{
  const f=fixture(),result=await f.lib.getRazorpayRecoveryFailures(start,end)
  assert.equal(result.gateway.status,'connected');assert.equal(result.rows.length,1)
  assert.equal(result.rows[0].id,'u:account1');assert.equal(result.rows[0].failureReference,'pay_Fixture')
  assert.equal(result.rows[0].failureOrderId,'order_Fixture');assert.equal(result.rows[0].paymentAmount,1200)
  assert.deepEqual(Array.from(result.rows[0].productIds),['product1'])
  assert.equal(result.rows[0].email,'payer@example.com');assert.equal(result.rows[0].phone,'+919876543210')
  assert.doesNotMatch(JSON.stringify(result),/never-export|attacker|card|notes|tokenHash/)
  const request=f.state.requests[0]
  assert.equal(new URL(request.url).origin,'https://api.razorpay.com')
  assert.equal(request.options.headers.Authorization,`Basic ${Buffer.from(`${f.env.RAZORPAY_KEY_ID}:${f.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`)
  assert.equal(request.options.cache,'no-store')
})

test('Razorpay products retain safe names and quantities from the exact checkout intent',async()=>{
  const f=fixture()
  f.db.checkout_intents[0].journeyItems=[{id:'product1',name:'Fridge',quantity:3,privateNote:'never-export'}]
  const row=(await f.lib.getRazorpayRecoveryFailures(start,end)).rows[0]
  assert.deepEqual(JSON.parse(JSON.stringify(row.recoveryItems)),[{id:'product1',name:'Fridge',quantity:3}])
  assert.doesNotMatch(JSON.stringify(row),/never-export|privateNote/)
})

test('allowlisted payment notes supply display details without establishing identity, quantity, price or permission',async()=>{
  const f=fixture()
  f.db.checkout_intents=[]
  f.state.items=[payment({email:'',contact:'',notes:{customer_name:'Fixture shopper',customer_email:'display@example.com',customer_phone:'9876543212',
    customer_address:'Fixture address',customer_city:'Fixture city',customer_zipcode:'000000',item_names:'Fixture phone (8GB+256GB)',order_items_count:'1',
    order_amount:'999999',userId:'attacker',recoveryConsent:true,privateToken:'never-export'}})]
  const row=(await f.lib.getRazorpayRecoveryFailures(start,end)).rows[0]
  assert.equal(row.gatewayDisplay.name,'Fixture shopper');assert.equal(row.gatewayDisplay.email,'display@example.com')
  assert.equal(row.gatewayDisplay.phone,'9876543212');assert.equal(row.gatewayDisplay.itemCount,1)
  assert.match(row.gatewayDisplay.address,/Fixture address/)
  assert.equal(row.failureProductName,'Fixture phone (8GB+256GB)')
  assert.equal(row.email,'');assert.equal(row.phone,'');assert.equal(row.paymentAmount,1200)
  assert.equal(row.failureCheckoutBound,false);assert.deepEqual(Array.from(row.recoveryItems),[])
  assert.doesNotMatch(JSON.stringify(row),/attacker|999999|never-export|privateToken|recoveryConsent/)
})

test('gateway order notes are fetched when payment notes have no item name, and lookup failures preserve the payment',async()=>{
  const f=fixture()
  f.state.orderEntity={id:'order_Fixture',notes:{item_names:'Order fixture phone',customer_name:'Order fixture shopper',order_items_count:2}}
  const row=(await f.lib.getRazorpayRecoveryFailures(start,end)).rows[0]
  assert.equal(row.failureProductName,'Order fixture phone');assert.equal(row.gatewayDisplay.itemCount,2)
  f.state.throwOrder=true
  assert.equal((await f.lib.getRazorpayRecoveryFailures(start,end)).rows.length,1)
})

test('successful payments, foreign currency, consumed intents and active sibling payments never enter Razorpay recovery',async()=>{
  for(const alter of [
    f=>{f.state.items=[payment({status:'captured'})]},
    f=>{f.state.items=[payment({currency:'USD'})]},
    f=>{f.db.checkout_intents[0].status='consumed'},
    f=>{f.state.items.push(payment({id:'pay_Success',status:'authorized'}))},
    f=>{f.state.items.push(payment({id:'pay_Pending',status:'created'}))},
  ]){
    const f=fixture();alter(f)
    assert.equal((await f.lib.getRazorpayRecoveryFailures(start,end)).rows.length,0)
  }
})

test('gateway failures remain visible without local checkout records, while unlinked cases are explicitly blocked from automation',async()=>{
  for(const alter of [
    f=>{f.db.checkout_intents=[]},
    f=>{f.db.checkout_intents[0].method='paytm'},
    f=>{f.db.checkout_intents[0].amount=1},
    f=>{f.state.items=[payment({order_id:null})]},
  ]){
    const f=fixture();alter(f)
    const result=await f.lib.getRazorpayRecoveryFailures(start,end)
    assert.equal(result.rows.length,1)
    assert.equal(result.rows[0].failureCheckoutBound,false)
    assert.equal(result.rows[0].email,'payer@example.com')
    assert.equal(result.rows[0].phone,'+919876543210')
    assert.deepEqual(Array.from(result.rows[0].productIds),[])
    assert.equal(await f.lib.razorpayFailureStillFailed(result.rows[0].failureReference,result.rows[0].failureOrderId),false)
  }
})

test('admin scan finds failed payments beyond the first 25 successful transactions',async()=>{
  const f=fixture()
  f.state.items=[...Array.from({length:30},(_,i)=>payment({id:`pay_Success${i}`,order_id:`order_Other${i}`,status:'captured'})),payment()]
  const result=await f.lib.getRazorpayRecoveryFailures(start,end,1,25,100)
  assert.equal(new URL(f.state.requests[0].url).searchParams.get('count'),'100')
  assert.equal(result.rows.length,1)
  assert.equal(result.gateway.scanned,31)
  assert.equal(result.gateway.failed,1)
})

test('dedicated recovery credentials can read live reports without changing test-mode checkout credentials',async()=>{
  const f=fixture()
  f.loader.env.RAZORPAY_KEY_ID='rzp_test_checkoutFixture'
  f.loader.env.RAZORPAY_RECOVERY_KEY_ID='rzp_live_reportingFixture'
  f.loader.env.RAZORPAY_RECOVERY_KEY_SECRET=crypto.randomBytes(32).toString('hex')
  const result=await f.lib.getRazorpayRecoveryFailures(start,end)
  assert.match(result.gateway.message,/live mode/)
  assert.equal(f.loader.env.RAZORPAY_KEY_ID,'rzp_test_checkoutFixture')
  assert.equal(f.state.requests[0].options.headers.Authorization,`Basic ${Buffer.from(`${f.loader.env.RAZORPAY_RECOVERY_KEY_ID}:${f.loader.env.RAZORPAY_RECOVERY_KEY_SECRET}`).toString('base64')}`)
  delete f.loader.env.RAZORPAY_RECOVERY_KEY_SECRET
  const requests=f.state.requests.length
  assert.equal((await f.lib.getRazorpayRecoveryFailures(start,end)).gateway.status,'not_configured')
  assert.equal(f.state.requests.length,requests)
})

test('Razorpay pagination includes all payment statuses and exposes further pages without a false total claim',async()=>{
  const f=fixture()
  f.state.items=[payment(),payment({id:'pay_Second',status:'captured',order_id:'order_Unrelated'})]
  const result=await f.lib.getRazorpayRecoveryFailures(start,end,3,2)
  const params=new URL(f.state.requests[0].url).searchParams
  assert.equal(params.get('skip'),'4');assert.equal(params.get('count'),'2')
  assert.equal(result.gateway.hasMore,true)
  assert.ok(result.total>3*2)
})

test('missing credentials and gateway/network/schema errors are explicit and never disclose credentials or provider errors',async()=>{
  const f=fixture();delete f.loader.env.RAZORPAY_KEY_ID
  assert.equal((await f.lib.getRazorpayRecoveryFailures(start,end)).gateway.status,'not_configured')
  assert.equal(f.state.requests.length,0)
  for(const mutate of [f=>{f.state.status=401},f=>{f.state.throwNetwork=true},f=>{f.state.items=[{secret:'never-export'}]}]){
    const f=fixture();mutate(f)
    const result=await f.lib.getRazorpayRecoveryFailures(start,end)
    assert.equal(result.gateway.status,'error');assert.equal(result.rows.length,0)
    assert.doesNotMatch(JSON.stringify(result),/never-export/)
  }
})

test('dispatch rechecks the exact failed payment and all sibling payments, and fails closed on resolution or lookup errors',async()=>{
  const f=fixture()
  assert.equal(await f.lib.razorpayFailureStillFailed('pay_Fixture','order_Fixture'),true)
  f.state.siblings.push(payment({id:'pay_Captured',status:'captured'}))
  assert.equal(await f.lib.razorpayFailureStillFailed('pay_Fixture','order_Fixture'),false)
  f.state.siblings=[payment(),payment({id:'pay_Pending',status:'created'})]
  assert.equal(await f.lib.razorpayFailureStillFailed('pay_Fixture','order_Fixture'),false)
  f.state.siblings=[payment()];f.state.entity=payment({order_id:'order_Other'})
  assert.equal(await f.lib.razorpayFailureStillFailed('pay_Fixture','order_Fixture'),false)
  f.state.throwNetwork=true
  assert.equal(await f.lib.razorpayFailureStillFailed('pay_Fixture','order_Fixture'),false)
  assert.equal(await f.lib.razorpayFailureStillFailed('../secret','order_Fixture'),false)
})
