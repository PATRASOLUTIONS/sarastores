import assert from 'node:assert/strict'
import test from 'node:test'
import { Aggregator, Query } from 'mingo'
import { NextRequest } from 'next/server.js'
import { sourceLoader } from './source-loader.mjs'

const at=n=>new Date(Date.now()-n*3600000)
function fixture() {
  const db={
    analytics_events:[
      {event:'page_view',visitorId:'browser1',userId:null,createdAt:at(48),device:'Mobile',trafficSource:'Google'},
      {event:'view_item',visitorId:'browser1',userId:null,createdAt:at(47),productIds:['p1'],device:'Mobile'},
      {event:'add_to_cart',visitorId:'browser1',userId:'account1',createdAt:at(46),productIds:['p1'],params:{value:500},device:'Mobile'},
      {event:'page_view',visitorId:'browser2',userId:null,createdAt:at(48),device:'Desktop',trafficSource:'Direct'},
      {event:'view_item',visitorId:'browser2',userId:null,createdAt:at(47),productIds:['p2'],device:'Desktop'},
      {event:'page_view',userId:null,createdAt:at(45)}, // Unidentifiable legacy telemetry.
    ],
    users:[{_id:'account1',name:'Ada Customer',email:'ada@example.test',phone:'123',password:'never-export',resetPasswordToken:'never-export'}],
    carts:[],checkout_intents:[],orders:[],
  }
  const collections=Object.fromEntries(Object.entries(db).map(([name])=>[name,{
    aggregate:pipeline=>({toArray:async()=>new Aggregator(pipeline,{collectionResolver:n=>db[n] || []}).run(db[name])}),
    countDocuments:async filter=>db[name].filter(d=>new Query(filter).test(d)).length,
  }]))
  const loader=sourceLoader({'@/lib/db-service':{getCollection:async name=>collections[name]}})
  const lib=loader.load('lib/customer-flow-data.ts')
  const q=lib.FlowQuery.parse({start:at(72).toISOString(),end:new Date().toISOString()})
  return {db,lib,q}
}
test('cohorts count unique identities, merge a consented guest to one account, and exclude legacy anonymous records',async()=>{
  const {lib,q}=fixture(),graph=await lib.getCustomerFlow(q)
  assert.equal(graph.total,2);assert.equal(graph.counts.visitor,2);assert.equal(graph.counts.product,2)
  assert.equal(graph.counts.cart,1);assert.equal(graph.counts.cart_abandoned,1);assert.equal(graph.counts.product_abandoned,1)
  assert.equal(graph.coverage.anonymousEventsExcluded,1)
})
test('node table matches its count, uses safe account fields, and preserves original first visit after login',async()=>{
  const {lib,q}=fixture(),table=await lib.getCustomerFlow({...q,mode:'table',stage:'cart'})
  assert.equal(table.total,1);assert.equal(table.rows[0].id,'u:account1');assert.equal(table.rows[0].name,'Ada Customer')
  assert.equal(table.rows[0].productsViewed,1);assert.equal(table.rows[0].cartValue,500)
  assert.ok(table.rows[0].firstVisit);assert.equal('password' in table.rows[0],false);assert.equal('resetPasswordToken' in table.rows[0],false)
})
test('shared browser histories are not attributed to either signed-in account',async()=>{
  const {db,lib,q}=fixture()
  db.analytics_events.push({event:'login',visitorId:'browser1',userId:'account2',createdAt:at(2)})
  const table=await lib.getCustomerFlow({...q,mode:'table',stage:'product'})
  assert.equal(table.rows.find(r=>r.id==='v:browser1')?.kind,'guest')
})
test('search is literal, filters change cohorts and pagination is applied after matching',async()=>{
  const {lib,q}=fixture()
  assert.equal((await lib.getCustomerFlow({...q,mode:'table',stage:'cart',search:'.*'})).total,0)
  assert.equal((await lib.getCustomerFlow({...q,mode:'table',stage:'cart',search:'ADA'})).total,1)
  const table=await lib.getCustomerFlow({...q,mode:'table',stage:'visitor',limit:1,page:2})
  assert.equal(table.total,2);assert.equal(table.rows.length,1)
  const graph=await lib.getCustomerFlow({...q,device:'Desktop',product:'p2'})
  assert.equal(graph.total,1);assert.equal(graph.counts.cart || 0,0)
})
test('delivered records do not manufacture processing or shipping history; guest orders without identity are excluded',async()=>{
  const {db,lib,q}=fixture()
  db.orders.push({_id:'ord1',userId:'account1',createdAt:at(30),updatedAt:at(1),status:'delivered',total:600,customer:{name:'Ada'},items:[{id:'p1'}],paymentVerification:{verified:true,verifiedAt:at(31)}})
  db.orders.push({_id:'unlinked-guest',userId:null,createdAt:at(5),status:'delivered'})
  const graph=await lib.getCustomerFlow(q)
  assert.equal(graph.counts.delivered,1);assert.equal(graph.counts.processing || 0,0);assert.equal(graph.counts.shipped || 0,0)
  assert.equal(graph.counts.cart_abandoned || 0,0);assert.equal(graph.coverage.guestOrdersExcluded,1)
  const table=await lib.getCustomerFlow({...q,mode:'table',stage:'delivered'})
  assert.equal(table.rows[0].orderAmount,600);assert.equal(table.rows[0].paymentStatus,'Verified')
})
test('timeline includes recorded history beyond selected start, remains chronological and paginates',async()=>{
  const {db,lib,q}=fixture()
  db.analytics_events.unshift({event:'page_view',userId:'account1',visitorId:'browser1',createdAt:at(100),device:'Mobile'})
  const detail=await lib.getCustomerFlow({...q,mode:'detail',id:'u:account1',limit:2,page:1})
  assert.equal(detail.events.length,2);assert.ok(+new Date(detail.events[0].at)<+new Date(q.start));assert.ok(detail.total>2)
})
test('edge volumes deduplicate transitions per identity rather than event count',async()=>{
  const {db,lib,q}=fixture()
  db.analytics_events.push({event:'page_view',visitorId:'browser2',userId:null,createdAt:at(46),device:'Desktop'})
  const graph=await lib.getCustomerFlow(q)
  assert.equal(graph.edges['visitor:guest'],2)
})
test('query validation rejects injection, invalid sort, oversized ranges, negative pagination and missing detail identity',()=>{
  const {lib,q}=fixture()
  for(const values of [{sort:'$where'},{kind:'admin'},{page:-1},{stage:'no-such-stage'},{mode:'detail'},{end:q.start},{start:'2000-01-01T00:00:00.000Z'}])assert.equal(lib.FlowQuery.safeParse({...q,...values}).success,false)
})
test('full admin guard runs before any database read',async()=>{
  let reads=0
  const route=sourceLoader({'@/lib/auth':{requireFullAdmin:async()=>({ok:false,response:new Response('Denied',{status:403})})},'@/lib/customer-flow-data':{getCustomerFlow:()=>{reads++},FlowQuery:{safeParse:()=>{throw new Error('Must not parse first')}}}}).load('app/api/admin/customer-flow/route.ts')
  const result=await route.GET(new NextRequest('http://localhost/api/admin/customer-flow'))
  assert.equal(result.status,403);assert.equal(reads,0)
})
test('event sink requires consent, derives account identity from session and keeps only safe product/context data',async()=>{
  const docs=[]
  const loader=sourceLoader({'@/lib/auth':{getSession:async()=>({user:{id:'trusted-account'}})},'@/lib/db-service':{getCollection:async()=>({insertOne:async d=>docs.push(d)})},'@/lib/rate-limit':{withRateLimit:f=>f}})
  const route=loader.load('app/api/events/route.ts'),version=loader.load('lib/dpdp-config.ts').PRIVACY_NOTICE_VERSION
  const body={event:'view_item',userId:'forged',params:{items:[{item_id:'p1'}]},referrer:'https://google.com/?private=value',page:'/product/p1'}
  const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}
  await route.POST(new NextRequest('http://localhost/api/events',options));assert.equal(docs.length,0)
  options.headers.Cookie=`dpdp_tracking_consent=${encodeURIComponent(JSON.stringify({analytics:true,version,anonymousId:'fixture-browser-12345'}))}`
  await route.POST(new NextRequest('http://localhost/api/events',options));assert.equal(docs.length,1)
  assert.equal(docs[0].userId,'trusted-account');assert.match(docs[0].visitorId,/^[a-f0-9]{64}$/)
  assert.equal(docs[0].productIds[0],'p1');assert.equal(docs[0].trafficSource,'Google');assert.equal('referer' in docs[0],false);assert.ok(docs[0].timestamp)
})
test('CSV cells neutralise spreadsheet formulas',()=>{
  const {csvCell}=sourceLoader().load('lib/customer-flow.ts')
  assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('a"b'),'"a""b"')
})
