import test from 'node:test'
import assert from 'node:assert/strict'
import { Query, Aggregator } from 'mingo'
import { ObjectId } from 'mongodb'
import { sourceLoader } from './source-loader.mjs'
import { NextRequest, NextResponse } from 'next/server.js'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const base=new Date('2026-11-10T05:30:00Z') // 11:00 IST
const ago=(minutes)=>new Date(+base-minutes*60000)
function fixture(){
  let emailCalls=0,waCalls=0,orderReads=0,unknown=false,race=false,price=10000,indexWrites=0,blocked=false,promotionBenefits=[],orderAtRead=Infinity,gatewayHook=null
  const offerSessions=[]
  const sentEmails=[]
  const storedFailures=[]
  const gatewayFailures=[]
  let gatewayChecks=0,gatewayResolved=false,gatewayResolveAt=Infinity
  const row={id:'v:browser1',name:'Asha',email:'asha@example.com',phone:'9876543210',productIds:['p1'],cartProductIds:['p1'],cartAt:ago(60),paymentFailedAt:null}
  const db={products:[],software_products:[],user_addresses:[],analytics_events:[{event:'checkout_contact',visitorId:'browser1',createdAt:ago(50),checkoutContext:{name:'Asha',email:row.email,phone:row.phone},recoveryConsent:{version:'checkout-recovery-2026-11-10',email:true,whatsapp:true,acceptedAt:ago(50)}},{event:'cart_snapshot',visitorId:'browser1',productIds:['p1'],createdAt:ago(30)}],users:[],orders:[],checkout_intents:[],carts:[],customer_profiles:[],recovery_settings:[],recovery_deliveries:[],recovery_locks:[],recovery_suppressions:[]}
  const matches=(doc,filter)=>new Query(filter).test(doc)
  function col(name){
    db[name] ||= []
    const list=()=>db[name]
    const apply=(doc,update)=>{Object.assign(doc,update.$set || {});return doc}
    const cursor=(filter)=>{let sort={},limit=Infinity;return {sort(v){sort=v;return this},limit(v){limit=v;return this},async toArray(){return list().filter(d=>matches(d,filter)).sort((a,b)=>{for(const [k,v] of Object.entries(sort)){if(a[k]<b[k])return -v;if(a[k]>b[k])return v}return 0}).slice(0,limit)}}}
    return {find:cursor,async createIndex(){indexWrites++;return 'fixture-index'},async findOne(filter,options={}){if(name==='orders'){orderReads++;if((race && orderReads===3) || orderReads===orderAtRead)db.orders.push({_id:'o1',journeyVisitorId:'browser1',createdAt:base,items:[{id:'p1'}]})}return (await cursor(filter).sort(options.sort || {}).limit(1).toArray())[0] || null},async insertOne(doc){if(list().some(d=>d._id===doc._id))throw Object.assign(new Error('duplicate'),{code:11000});list().push(structuredClone(doc));return {insertedId:doc._id}},async updateOne(filter,update,options={}){let doc=list().find(d=>matches(d,filter));if(!doc && options.upsert){doc={_id:filter._id};list().push(doc)}if(doc)apply(doc,update);return {modifiedCount:doc?1:0}},async findOneAndUpdate(filter,update,options={}){let doc=list().find(d=>matches(d,filter));if(!doc && options.upsert){if(list().some(d=>d._id===filter._id))throw Object.assign(new Error('duplicate'),{code:11000});doc={_id:filter._id};list().push(doc)}return doc?structuredClone(apply(doc,update)):null}}
  }
  const loader=sourceLoader({
    '@/lib/db-service':{getCollection:async name=>col(name)},
    '@/lib/recovery-payment-data':{getDatabasePaymentFailures:async()=>({rows:storedFailures,total:storedFailures.length}),databaseFailureStillFailed:async()=>true},
    '@/lib/recovery-razorpay':{getRazorpayRecoveryFailures:async()=>({rows:gatewayFailures,total:gatewayFailures.length,gateway:{status:'connected',message:'Fixture Razorpay',fetchedAt:base.toISOString(),hasMore:false}}),razorpayFailureStillFailed:async()=>{gatewayChecks++;gatewayHook?.(gatewayChecks);return !gatewayResolved && gatewayChecks<gatewayResolveAt}},
    '@/lib/auth-credentials':{getAuthenticatedUserById:async id=>db.users.find(u=>u.id===id && !['inactive','deleted'].includes(u.status)) || null},
    '@/lib/diwali/blocklist':{isDiwaliCustomerBlocked:async()=>blocked},
    '@/lib/customer-flow-data':{FlowQuery:{parse:q=>q},getCustomerFlow:async q=>({rows:q.stage==='payment_failed'&&!row.paymentFailedAt?[]:[structuredClone(row)],total:1})},
    '@/lib/order-pricing':{priceCatalogueCart:async()=>({ok:true,items:[{id:'p1',name:'Samsung refrigerator',price,type:'physical'}],catalogue:new Map([['p1',{slug:'samsung-fridge',active:true}]])})},
    '@/lib/product-visibility':{isPublicProduct:()=>true},
    '@/lib/storefront-promotions':{getStorefrontPromotions:async(id,session)=>{offerSessions.push(session);return {products:promotionBenefits.length?[{id,benefits:promotionBenefits}]:[]}}},
    '@/lib/smtp':{getEmailTransport:()=>({sendMail:async mail=>{emailCalls++;sentEmails.push(mail.to);if(unknown)throw new Error('socket closed');return {accepted:[row.email]}}})},
    '@/lib/whatsapp-template':{
      sendWhatsAppTemplate:async(phone,template)=>{
        assert.match(phone,/^\d{10}$/)
        assert.equal(template.components[0].parameters.length,6)
        for(const p of template.components[0].parameters){assert.doesNotMatch(p.text,/[\r\n\t]/);assert.ok(p.text.length<=1024)}
        waCalls++
        return {success:true,data:{messages:[{id:'fixture'}]}}
      },
    },
  },{env:{NEXT_PUBLIC_SITE_URL:'https://sara.example.com',SMTP_HOST:'fixture',SMTP_USER:'fixture',SMTP_PASS:'fixture',EMAIL_FROM:'sara@example.com',CRON_SECRET:'isolated-cron-secret',WHATSAPP_CAMPAIGNS_ENABLED:'true',ASKEVA_API_KEY:'fixture',ASKEVA_API_URL:'https://fixture.invalid'}})
  const policy=loader.load('lib/recovery-policy.ts'),engine=loader.load('lib/recovery-automation.ts'),settings=structuredClone(policy.RECOVERY_DEFAULTS)
  settings.channels=['email'];settings.cart.enabled=true;settings.payment.enabled=true
  db.recovery_settings.push({_id:'settings',settings})
  return {engine,policy,db,row,settings,offerSessions,sentEmails,storedFailures,gatewayFailures,set orderAtRead(value){orderAtRead=value},set gatewayHook(value){gatewayHook=value},get gatewayChecks(){return gatewayChecks},set gatewayResolved(v){gatewayResolved=v},set gatewayResolveAt(v){gatewayResolveAt=v},get indexWrites(){return indexWrites},get calls(){return emailCalls+waCalls},get emailCalls(){return emailCalls},get waCalls(){return waCalls},set unknown(v){unknown=v},set race(v){race=v},set price(v){price=v},set blocked(v){blocked=v},set promotionBenefits(v){promotionBenefits=v}}
}

test('cart queue fetches account email and mobile by ObjectId, string ID or legacy ID without granting messaging permission',async()=>{
  for(const account of [
    {_id:new ObjectId('507f1f77bcf86cd799439011')},
    {_id:'customer-string'},
    {id:'customer-legacy'},
  ]){
    const f=fixture(),id=String(account._id || account.id)
    f.row.id=`u:${id}`
    f.row.email='';f.row.phone=''
    f.db.analytics_events=[]
    f.db.users.push({...account,name:'Database customer',email:'account@example.com',mobile:'9876543212',password:'never-export',resetToken:'never-export'})
    const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
    assert.equal(q.name,'Database customer')
    assert.equal(q.email,'account@example.com')
    assert.equal(q.phone,'9876543212')
    assert.equal(q.channel,null)
    assert.match(q.reason,/opt-in/)
    assert.doesNotMatch(JSON.stringify(q),/never-export|password|resetToken/)
    assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  }
})

test('displaying current account contact does not redirect a consented reminder to a different email',async()=>{
  const f=fixture()
  f.row.id='u:account1'
  f.db.analytics_events.forEach(e=>{e.userId='account1'})
  f.db.carts.push({userId:'account1',items:[{id:'p1'}]})
  f.db.users.push({id:'account1',name:'Current account',email:'current@example.com',phone:'9876543212',role:'user'})
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.email,'current@example.com')
  assert.equal(q.phone,'9876543212')
  assert.equal(q.channel,'email')
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,1)
  assert.deepEqual(f.sentEmails,['asha@example.com'])
})

test('cart phone falls back to the same customer saved address, skipping blank fields and unrelated customers',async()=>{
  const f=fixture()
  f.row.id='u:address-customer';f.row.email='';f.row.phone='';f.db.analytics_events=[]
  f.db.users.push({_id:'address-customer',name:'Address customer',email:'address@example.com',phone:'  ',mobile:'  '})
  f.db.user_addresses=[
    {userId:'someone-else',phone:'9876543219',updatedAt:base,isDefault:true,address:'never-export'},
    {userId:'address-customer',phone:' ',updatedAt:base,isDefault:true},
    {userId:'address-customer',phone:'9876543213',updatedAt:ago(10),address:'never-export'},
  ]
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.phone,'9876543213')
  assert.equal(q.channel,null)
  assert.doesNotMatch(JSON.stringify(q),/never-export|9876543219/)
})

test('saved address mobile supports ObjectId ownership and canonical account IDs behind a legacy customer ID',async()=>{
  const f=fixture(),accountId=new ObjectId('507f1f77bcf86cd799439033')
  f.row.id='u:legacy-address-owner';f.row.phone='';f.db.analytics_events=[]
  f.db.users.push({_id:accountId,id:'legacy-address-owner',email:'owner@example.com',phone:null})
  f.db.user_addresses=[
    {userId:new ObjectId('507f1f77bcf86cd799439034'),mobile:'9876543219',isDefault:true},
    {userId:accountId,phone:' ',mobile:9876543215,updatedAt:base,address:'never-export'},
  ]
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.phone,'9876543215')
  assert.doesNotMatch(JSON.stringify(q),/never-export|9876543219|507f1f77bcf86cd799439033/)
  assert.equal(q.channel,null)
})

test('legacy embedded saved addresses provide a phone without exposing address contents',async()=>{
  for(const fields of [
    {address:{mobile:'9876543216',street:'never-export'}},
    {addresses:[{phone:'9876543217'},{mobile:'9876543216',isDefault:true,street:'never-export'}]},
  ]){
    const f=fixture()
    f.row.id='u:embedded-address-owner';f.row.phone='';f.db.analytics_events=[]
    f.db.users.push({_id:'embedded-address-owner',email:'embedded@example.com',...fields})
    const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
    assert.equal(q.phone,'9876543216')
    assert.doesNotMatch(JSON.stringify(q),/never-export|street/)
    assert.equal(q.channel,null)
  }
})

test('cart phone can come from checkout details without a reminder opt-in or from the same account shipping phone',async()=>{
  const guest=fixture()
  guest.row.email='';guest.row.phone=''
  delete guest.db.analytics_events[0].recoveryConsent
  let q=(await guest.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.phone,'9876543210')
  assert.equal(q.email,'asha@example.com')
  assert.equal(q.channel,null)
  assert.equal((await guest.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  const account=fixture()
  account.row.id='u:shipping-customer';account.row.phone='';account.db.analytics_events=[]
  account.db.users.push({_id:'shipping-customer',email:'shipping@example.com'})
  account.db.orders.push({_id:'shipping-order',userId:'shipping-customer',shippingAddress:{phone:'9876543214'},createdAt:base})
  q=(await account.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.phone,'9876543214')
  assert.match(q.reason,/order was created/)
})

test('blocked cart rows still show all database products and item numbers without an active cart or approved channel',async()=>{
  const f=fixture(),secondId=new ObjectId('507f1f77bcf86cd799439022')
  f.row.id='u:no-consent-customer'
  f.row.productIds=['p1',String(secondId),'software1'];f.row.cartProductIds=[...f.row.productIds]
  f.db.analytics_events=[]
  f.db.products=[
    {_id:'p1',name:'First product',active:false,raw:{itemno:'SARA-1001',privateNotes:'never-export'}},
    {_id:secondId,name:'Second product',raw:{'Item No.':'00042'}},
  ]
  f.db.software_products=[{_id:'software1',name:'Software product',sku:'SOFT-003'}]
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.product,null)
  assert.equal(q.message,null)
  assert.match(q.reason,/opt-in/)
  assert.deepEqual(Array.from(q.queueProducts,p=>p.itemno),['SARA-1001','00042','SOFT-003'])
  assert.deepEqual(Array.from(q.queueProducts,p=>p.name),['First product','Second product','Software product'])
  assert.doesNotMatch(JSON.stringify(q),/never-export|privateNotes|raw/)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
})

test('queue product quantities come from owned carts, aggregate lines and preserve missing catalogue names',async()=>{
  const f=fixture()
  f.row.id='u:quantity-owner';f.db.analytics_events=[]
  f.db.products=[{_id:'p1',name:'Catalogue fridge',itemno:'FR-1'}]
  f.db.carts=[{userId:'other-owner',items:[{id:'p1',quantity:99}]},{userId:'quantity-owner',items:[
    {id:'p1',quantity:2},{productId:'p1',quantity:'3'},{id:'archived',name:'Saved television',quantity:4},
  ]}]
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.deepEqual(JSON.parse(JSON.stringify(q.queueProducts)),[
    {id:'p1',name:'Catalogue fridge',itemno:'FR-1',quantity:5},{id:'archived',name:'Saved television',itemno:'',quantity:4},
  ])
})

test('payment product quantities use the failed checkout snapshot instead of a later cart',async()=>{
  const f=fixture()
  f.row.id='u:quantity-owner';f.row.cartAt=null;f.row.paymentFailedAt=ago(30)
  f.row.recoveryItems=[{id:'p1',name:'Checkout fridge',quantity:2}]
  f.db.analytics_events=[]
  f.db.carts=[{userId:'quantity-owner',items:[{id:'p1',quantity:99}]}]
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.queueProducts[0].name,'Checkout fridge')
  assert.equal(q.queueProducts[0].quantity,2)
})

test('guest product quantities come from snapshot items and absent quantities remain unknown',async()=>{
  const f=fixture()
  f.db.analytics_events[1].params={items:[{item_id:'p1',item_name:'Guest fridge',quantity:3},{item_id:'p2',item_name:'Guest television'}]}
  const products=(await f.engine.getRecoveryDashboard(base)).queue[0].queueProducts
  assert.equal(products[0].name,'Guest fridge');assert.equal(products[0].quantity,3)
  assert.equal(products[1].name,'Guest television');assert.equal(products[1].quantity,null)
})

test('Razorpay note details populate display columns while unlinked reminders remain blocked',async()=>{
  const f=fixture()
  f.row.cartAt=null;f.row.paymentFailedAt=ago(30);f.row.failureSource='razorpay';f.row.failureCheckoutBound=false
  f.row.email='';f.row.phone='';f.row.productIds=[];f.row.cartProductIds=[]
  f.row.failureProductName='Fixture phone'
  f.row.gatewayDisplay={name:'Fixture customer',email:'notes@example.com',phone:'9876543215',address:'Fixture address',itemCount:1}
  f.db.analytics_events=[]
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.name,'Fixture customer');assert.equal(q.email,'notes@example.com');assert.equal(q.phone,'9876543215')
  assert.equal(q.customerAddress,'Fixture address');assert.equal(q.failureItemCount,1);assert.equal(q.failureProductName,'Fixture phone')
  assert.deepEqual(Array.from(q.queueProducts),[]);assert.equal(q.message,null)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
})

test('cart reminders run at 1h, 24h, 48h; latest prices refresh and total is capped',async()=>{
  const f=fixture()
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:new Date(+base-60000)})).sent,0)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,1)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  f.price=9500
  const next=new Date(+base+23*3600000)
  const dashboard=await f.engine.getRecoveryDashboard(next)
  assert.equal(dashboard.queue[0].product.price,9500)
  assert.match(dashboard.queue[0].message.text,/9,500/)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:next})).sent,1)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:new Date(+base+47*3600000)})).sent,1)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:new Date(+base+71*3600000)})).sent,0)
  assert.equal(f.calls,3)
})
test('order creation stops every step, including the first',async()=>{
  for(const prior of [0,1,2]){
    const f=fixture()
    for(let i=0;i<prior;i++)await f.engine.runRecoveryAutomation({dryRun:false,now:new Date(+base+i*24*3600000)})
    f.db.orders.push({_id:'order',journeyVisitorId:'browser1',createdAt:new Date(+base+prior*24*3600000),items:[{id:'p1'}]})
    const result=await f.engine.runRecoveryAutomation({dryRun:false,now:new Date(+base+prior*24*3600000)})
    assert.equal(result.sent,0);assert.equal(f.calls,prior)
  }
})
test('new order after preview/reservation cancels the provider call',async()=>{
  const f=fixture();f.race=true
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  assert.equal(f.calls,0);assert.equal(f.db.recovery_deliveries[0].status,'suppressed')
})
test('a purchase on another browser stops recovery by email or phone',async()=>{
  for(const contact of [{email:'ASHA@example.com'},{phone:'919876543210'}]){
    const f=fixture();f.db.orders.push({_id:'different-device',journeyVisitorId:'other-browser',createdAt:base,customer:contact,items:[{id:'p1'}]})
    assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0);assert.equal(f.calls,0)
  }
})
test('explicit settings save creates supporting indexes and records admin identity',async()=>{
  const f=fixture()
  await f.engine.getRecoveryDashboard(base)
  assert.equal(f.indexWrites,0)
  await f.engine.saveRecoverySettings(f.settings,'owner')
  assert.equal(f.indexWrites,3);assert.equal(f.db.recovery_settings[0].updatedBy,'owner')
})
test('changing checkout email or phone does not reset the customer reminder limit',async()=>{
  const f=fixture()
  await f.engine.runRecoveryAutomation({dryRun:false,now:base})
  f.db.analytics_events[0].checkoutContext.email='updated@example.com'
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  f.db.analytics_events[0].checkoutContext.phone='9876543211'
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  assert.equal(f.calls,1)
})
test('registered offer eligibility uses canonical account identity and stops for inactive accounts',async()=>{
  const f=fixture();f.row.id='u:account1';f.db.analytics_events[0].userId='account1'
  f.db.users.push({id:'account1',name:'Account owner',email:'canonical@example.com',phone:'9876543211',role:'user',status:'active'})
  f.db.carts.push({userId:'account1',items:[{id:'p1'}]})
  const dashboard=await f.engine.getRecoveryDashboard(base)
  assert.ok(dashboard.queue[0].message)
  assert.equal(f.offerSessions[0].user.email,'canonical@example.com')
  assert.equal(f.offerSessions[0].user.phone,'9876543211')
  f.db.users[0].status='inactive'
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
})
test('a blocked guest is not promised a Diwali benefit',async()=>{
  const f=fixture();f.blocked=true;f.promotionBenefits=[{kind:'diwali',name:'Diwali gift',description:'Eligible gift',expiresAt:null}]
  const dashboard=await f.engine.getRecoveryDashboard(base)
  assert.equal(dashboard.queue[0].product.offers.length,0)
  assert.doesNotMatch(dashboard.queue[0].message.offerText,/Diwali gift/)
})
test('payment queue displays database-only guest failures and product details without granting message permission',async()=>{
  const f=fixture()
  f.storedFailures.push({id:'f:'+'a'.repeat(64),name:'Database customer',email:'database@example.com',phone:'9876543212',productIds:['p1'],cartProductIds:[],cartAt:null,paymentFailedAt:ago(15).toISOString(),databaseFailure:true,
    failureReference:'db-payment',failureSource:'payments',failureProductName:'Stored fridge',paymentAmount:12000,paymentGateway:'paytm',recoveryVisitorId:''})
  const queue=(await f.engine.getRecoveryDashboard(base)).queue.filter(q=>q.flow==='payment')
  assert.equal(queue.length,1);assert.equal(queue[0].name,'Database customer');assert.equal(queue[0].email,'database@example.com')
  assert.equal(queue[0].failureReference,'db-payment');assert.equal(queue[0].failureAmount,12000)
  assert.equal(queue[0].product.id,'p1');assert.equal(queue[0].channel,null);assert.match(queue[0].reason,/opt-in/)
  assert.equal(f.calls,0)
})
test('dry runs do not write any database state or call providers',async()=>{
  const f=fixture(),before=JSON.stringify(f.db)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:true,now:base})).due,1)
  assert.equal(JSON.stringify(f.db),before);assert.equal(f.calls,0)
})
test('missing consent, empty cart and opt-out each block recovery',async()=>{
  for(const change of [f=>{f.db.analytics_events[0].recoveryConsent.email=false;f.db.analytics_events[0].recoveryConsent.whatsapp=false},f=>{f.db.analytics_events[1].productIds=[]},async f=>{const p=(await f.engine.getRecoveryDashboard(base)).queue[0];await f.engine.unsubscribeRecovery(new URL(p.message.text.match(/Stop recovery reminders: (.+)/)[1]).searchParams.get('token'))}]){
    const f=fixture();await change(f)
    assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0);assert.equal(f.calls,0)
  }
})
test('ambiguous delivery is reserved and never retried automatically',async()=>{
  const f=fixture();f.unknown=true
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).unknown,1)
  f.unknown=false
  await f.engine.runRecoveryAutomation({dryRun:false,now:new Date(+base+24*3600000)})
  assert.equal(f.calls,1);assert.equal(f.db.recovery_deliveries[0].status,'unknown')
})
test('concurrent workers reserve only one touch',async()=>{
  const f=fixture()
  await Promise.all([f.engine.runRecoveryAutomation({dryRun:false,now:base}),f.engine.runRecoveryAutomation({dryRun:false,now:base})])
  assert.equal(f.calls,1);assert.equal(f.db.recovery_deliveries.length,1)
})
test('WhatsApp uses approved template and local phone; one channel only',async()=>{
  const f=fixture();f.settings.channels=['whatsapp','email'];f.settings.cart.steps[0].templateApproved=true
  await f.engine.runRecoveryAutomation({dryRun:false,now:base})
  assert.equal(f.waCalls,1);assert.equal(f.emailCalls,0)
})
test('unapproved WhatsApp falls back before dispatch to opted-in email',async()=>{
  const f=fixture();f.settings.channels=['whatsapp','email']
  await f.engine.runRecoveryAutomation({dryRun:false,now:base})
  assert.equal(f.waCalls,0);assert.equal(f.emailCalls,1)
})
function razorpayLead(f){
  f.gatewayFailures.push({id:'v:browser1',name:'Razorpay customer',email:'payer@example.com',phone:'+919876543215',productIds:['p1'],cartProductIds:[],cartAt:null,paymentFailedAt:ago(15),
    databaseFailure:true,recoveryVisitorId:'browser1',failureSource:'razorpay',failureReference:'pay_Fixture',failureOrderId:'order_Fixture',paymentGateway:'razorpay',paymentAmount:10000})
}

test('payment failures leave the queue once any new order matches either gateway email or normalized mobile, including another device',async()=>{
  for(const customer of [
    {email:' PAYER@EXAMPLE.COM ',phone:'9876543219'},
    {email:'other@example.com',phone:'+91 98765-43215'},
    {email:'other@example.com',mobile:919876543215},
  ]){
    const f=fixture();razorpayLead(f)
    assert.equal((await f.engine.getRecoveryDashboard(base)).queue.filter(q=>q.flow==='payment').length,1)
    f.db.orders.push({_id:'new-order',customer,journeyVisitorId:'other-device',createdAt:base.toISOString(),items:[{id:'different-product'}]})
    assert.equal((await f.engine.getRecoveryDashboard(base)).queue.filter(q=>q.flow==='payment').length,0)
    assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
    assert.equal(f.calls,0)
  }
})

test('payment first reminder uses two minutes for existing settings without changing approvals or enabled flows',async()=>{
  const f=fixture()
  f.settings.payment.steps[0].delayMinutes=15
  f.settings.payment.steps[0].templateApproved=true
  f.settings.payment.steps[0].templateName='approved_payment_template'
  const settings=await f.engine.getRecoverySettings()
  assert.equal(settings.payment.steps[0].delayMinutes,2)
  assert.equal(settings.payment.enabled,true)
  assert.equal(settings.payment.steps[0].templateApproved,true)
  assert.equal(settings.payment.steps[0].templateName,'approved_payment_template')
  assert.equal(settings.payment.steps[1].delayMinutes,1440)
  assert.equal(settings.cart.steps[0].delayMinutes,60)
  assert.equal(f.settings.payment.steps[0].delayMinutes,15) // Read does not write the database.
})

test('payment reminder cannot send before two minutes and becomes eligible at the two-minute boundary',async()=>{
  const f=fixture();razorpayLead(f)
  f.gatewayFailures[0].paymentFailedAt=ago(2)
  const early=await f.engine.runRecoveryAutomation({dryRun:false,flow:'payment',now:new Date(+base-1)})
  assert.equal(early.sent,0);assert.equal(f.calls,0)
  const due=await f.engine.runRecoveryAutomation({dryRun:false,flow:'payment',now:base})
  assert.equal(due.sent,1);assert.equal(f.calls,1)
})

test('a new order during the final Razorpay lookup cancels both WhatsApp and email before provider handoff',async()=>{
  for(const channel of ['whatsapp','email']){
    const f=fixture();razorpayLead(f)
    f.settings.channels=[channel];f.settings.payment.steps[0].templateApproved=true
    f.gatewayHook=count=>{if(count===3)f.db.orders.push({_id:'late-order',customer:{email:'payer@example.com'},createdAt:base,status:'pending',items:[{id:'p1'}]})}
    const report=await f.engine.runRecoveryAutomation({dryRun:false,flow:'payment',now:base})
    assert.equal(report.sent,0);assert.equal(f.calls,0)
    assert.equal(f.db.recovery_deliveries[0].status,'suppressed')
    assert.match(f.db.recovery_deliveries[0].reason,/order was created/)
  }
})

test('cart orders created after reservation stop both channels at the last order check',async()=>{
  for(const channel of ['whatsapp','email']){
    const f=fixture();f.settings.channels=[channel];f.settings.cart.steps[0].templateApproved=true
    f.orderAtRead=4
    const report=await f.engine.runRecoveryAutomation({dryRun:false,flow:'cart',now:base})
    assert.equal(report.sent,0);assert.equal(f.calls,0)
    assert.equal(f.db.recovery_deliveries[0].status,'suppressed')
  }
})

test('orders with ObjectId customer ownership suppress cart reminders for the same session account',async()=>{
  const f=fixture(),id=new ObjectId('507f1f77bcf86cd799439011')
  f.row.id=`u:${id}`;f.db.analytics_events=[]
  f.db.orders.push({_id:'owned-order',userId:id,createdAt:base,items:[{id:'p1'}]})
  const queue=(await f.engine.getRecoveryDashboard(base)).queue
  assert.match(queue[0].reason,/order was created/)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,flow:'cart',now:base})).sent,0)
  assert.equal(f.calls,0)
})

test('unlinked Razorpay failures are visible even with an existing opt-in, but never send a reminder',async()=>{
  const f=fixture();razorpayLead(f)
  f.gatewayFailures[0].failureCheckoutBound=false
  const q=(await f.engine.getRecoveryDashboard(base)).queue[0]
  assert.equal(q.email,'payer@example.com')
  assert.match(q.reason,/no matching local checkout/)
  assert.equal(q.message,null)
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  assert.equal(f.calls,0)
  assert.equal(f.gatewayChecks,0)
})

test('authenticated Razorpay failure displays actual gateway contact, and a failed attempt does not pause for its own created intent',async()=>{
  const f=fixture();razorpayLead(f)
  f.db.checkout_intents.push({_id:'order_Fixture',journeyVisitorId:'browser1',status:'created',expiresAt:new Date(+base+3600000)})
  const dashboard=await f.engine.getRecoveryDashboard(base),q=dashboard.queue[0]
  assert.equal(q.email,'payer@example.com');assert.equal(q.phone,'+919876543215')
  assert.equal(q.status,'due');assert.equal(dashboard.razorpay.status,'connected')
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,1)
  assert.deepEqual(f.sentEmails,['asha@example.com']) // Original opt-in recipient stays bound.
})

test('Razorpay resolution after reservation cancels the provider call and records suppression',async()=>{
  const f=fixture();razorpayLead(f);f.gatewayResolveAt=3
  const report=await f.engine.runRecoveryAutomation({dryRun:false,now:base})
  assert.equal(report.sent,0);assert.equal(f.calls,0)
  assert.equal(f.db.recovery_deliveries[0].status,'suppressed')
})

test('payment recovery waits for pending intents and shares cart cap',async()=>{
  const f=fixture();f.row.paymentFailedAt=ago(15)
  f.db.checkout_intents.push({_id:'payment',journeyVisitorId:'browser1',status:'created',expiresAt:new Date(+base+3600000)})
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,0)
  f.db.checkout_intents=[]
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,now:base})).sent,1)
  assert.equal(f.db.recovery_deliveries[0].flow,'payment')
  assert.equal((await f.engine.runRecoveryAutomation({dryRun:false,flow:'cart',now:base})).sent,0)
})
test('signed opt-out rejects forgery and expiry, and GET verification makes no writes',async()=>{
  const f=fixture(),key='c:'+'a'.repeat(64),token=f.engine.recoveryUnsubscribeToken(key,base)
  assert.equal(f.engine.verifyRecoveryUnsubscribe(token,base),key)
  assert.equal(f.engine.verifyRecoveryUnsubscribe(token+'x',base),null)
  assert.equal(f.engine.verifyRecoveryUnsubscribe(token,new Date(+base+91*86400000)),null)
  assert.equal(f.db.recovery_suppressions.length,0)
})
test('only verified deadlines create urgency, and future deadlines are stated accurately',()=>{
  const f=fixture(),product={id:'p1',name:'Fridge',price:10000,href:'/product/fridge',offers:[{description:'Expired discount',expiresAt:ago(1).toISOString()}]}
  let msg=f.policy.buildRecoveryMessage('cart',3,'Asha',product,'https://sara.example.com','https://sara.example.com/stop',base)
  assert.doesNotMatch(msg.text,/Expired discount|before the listed offer ends/)
  product.offers=[{description:'Save using SAVE',expiresAt:new Date(+base+5*86400000).toISOString()}]
  msg=f.policy.buildRecoveryMessage('cart',3,'Asha',product,'https://sara.example.com','https://sara.example.com/stop',base)
  assert.match(msg.deadlineText,/15 Nov/);assert.doesNotMatch(msg.subject,/ending soon/)
  product.offers[0].expiresAt=new Date(+base+86400000).toISOString()
  msg=f.policy.buildRecoveryMessage('cart',3,'Asha',product,'https://sara.example.com','https://sara.example.com/stop',base)
  assert.match(msg.subject,/ending soon/)
})
test('quiet hours prevent nighttime sends and invalid settings are rejected',async()=>{
  const f=fixture()
  assert.equal(f.policy.recoverySendWindow(new Date('2026-11-10T17:30:00Z'),f.settings),false)
  f.settings.cart.steps[1].delayMinutes=30
  assert.equal(f.policy.recoverySettingsSchema.safeParse(f.settings).success,false)
})
test('admin endpoints guard reads and writes, validate settings, and require explicit real-send confirmation',async()=>{
  let allowed=false,reads=0,saves=0,runs=[]
  const loader=sourceLoader({'@/lib/auth':{requireFullAdmin:async()=>allowed?{ok:true,user:{id:'server-admin'}}:{ok:false,response:NextResponse.json({error:'Forbidden'},{status:403})}},
    '@/lib/recovery-automation':{getRecoveryDashboard:async()=>{reads++;return {}},saveRecoverySettings:async(settings,id)=>{assert.equal(id,'server-admin');saves++;return settings},runRecoveryAutomation:async options=>{runs.push(options);return {sent:0}}}})
  const route=loader.load('app/api/admin/recovery-automation/route.ts')
  const request=body=>new NextRequest('https://sara.example.com/api/admin/recovery-automation',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})
  assert.equal((await route.GET()).status,403)
  assert.equal((await route.POST(request({action:'run',confirm:true}))).status,403)
  assert.equal(reads,0);assert.equal(runs.length,0)
  allowed=true
  assert.equal((await route.POST(request({action:'run'}))).status,400)
  assert.equal((await route.POST(request({action:'settings',settings:{}}))).status,400)
  const defaults=loader.load('lib/recovery-policy.ts').RECOVERY_DEFAULTS
  assert.equal((await route.POST(request({action:'settings',settings:defaults}))).status,200)
  assert.equal(saves,1)
  await route.POST(request({action:'preview'}));await route.POST(request({action:'run',confirm:true}))
  assert.equal(runs[0].dryRun,true);assert.equal(runs[1].dryRun,false)
})
test('signed recovery URLs are excluded from marketing tags and direct Google initialization',()=>{
  for(const pathname of ['/recovery/unsubscribe','/admin/recovery-automation','/admin/customer-flow']){
  const loader=sourceLoader({'next/navigation':{usePathname:()=>pathname},'next/script':{default:()=>React.createElement('script')},
    '@/lib/consent-client':{hasConsent:()=>true},'@/components/ConsentGate':{default:({children})=>children}},
    {env:{NEXT_PUBLIC_GA_ID:'G-FIXTURE',NEXT_PUBLIC_META_PIXEL_ID:'fixture',NEXT_PUBLIC_CLARITY_ID:'fixture'},context:{window:{location:{pathname},dataLayer:[]}}})
  assert.equal(renderToStaticMarkup(React.createElement(loader.load('components/MarketingTags.tsx').default)),'')
  assert.equal(loader.load('lib/google-tag-client.ts').initializeGoogleTag('G-FIXTURE'),false)
  }
})
