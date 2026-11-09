import assert from 'node:assert/strict'
import test from 'node:test'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server.js'
import { sourceLoader } from './source-loader.mjs'

const env={GOOGLE_GA4_PROPERTY_ID:'123456789',GOOGLE_GA4_CLIENT_ID:'fixture-client',GOOGLE_GA4_CLIENT_SECRET:'fixture-secret',GOOGLE_GA4_REFRESH_TOKEN:'fixture-refresh'}
const scope='https://www.googleapis.com/auth/analytics.readonly'
const dimensions=['hostName','pagePath','deviceCategory','sessionSourceMedium','pageReferrer'],metrics=['totalUsers','screenPageViews','sessions','engagementRate']
function report(dims,metricNames,rows,rowCount=rows.length) {
  return {dimensionHeaders:dims.map(name=>({name})),metricHeaders:metricNames.map(name=>({name})),rows:rows.map(([d,m])=>({dimensionValues:d.map(value=>({value})),metricValues:m.map(value=>({value:String(value)}))})),rowCount,metadata:{timeZone:'Asia/Kolkata',currencyCode:'INR'},propertyQuota:{tokensPerHour:{remaining:850}}}
}
function fixture(options={}) {
  const calls=[]
  const fetch=async(url,init={})=>{
    calls.push({url,init})
    if(url==='https://oauth2.googleapis.com/token')return options.tokenFailure || options.oauthError?Response.json({error:options.oauthError || 'secret-provider-body',error_description:'secret-provider-body'}, {status:400}):Response.json({access_token:'fixture-token',expires_in:3600,scope:options.scope || scope})
    if(url.endsWith('/metadata'))return Response.json({dimensions:(options.dimensions || dimensions).map(apiName=>({apiName})),metrics:metrics.map(apiName=>({apiName}))})
    if(url.endsWith(':checkCompatibility')) {
      const body=JSON.parse(init.body)
      return Response.json({dimensionCompatibilities:body.dimensions.map(d=>({dimensionMetadata:{apiName:d.name},compatibility:options.incompatible?'INCOMPATIBLE':'COMPATIBLE'})),metricCompatibilities:body.metrics.map(m=>({metricMetadata:{apiName:m.name},compatibility:'COMPATIBLE'}))})
    }
    assert.ok(url.endsWith(':batchRunReports'))
    if(options.status)return Response.json({error:'private-provider-response'}, {status:options.status})
    const {requests}=JSON.parse(init.body)
    const reports=requests.map(request=>{
      const dims=request.dimensions.map(d=>d.name),names=request.metrics.map(m=>m.name)
      if(!dims.length)return options.emptyOverview?{kind:'analyticsData#runReport',metadata:{timeZone:'Asia/Kolkata',currencyCode:'INR'}}:report(dims,names,[[[],[123,650,145]]])
      if(dims.includes('pageReferrer'))return report(dims,names,[
        [['/products','https://www.sarastores.com/?campaign=a'],[60,100]],
        [['/products','https://www.sarastores.com/?campaign=b'],[40,80]],
        [['/checkout','https://www.sarastores.com/products'],[20,30]],
        [['/products','https://external.example/?private=anything'],[30,40]],
        [['/products','https://www.sarastores.com/admin/users?email=fixture@example.test'],[10,10]],
      ])
      if(dims.includes('deviceCategory'))return report(dims,names,[[['mobile','google / organic'],[45,90]],[['desktop','(direct) / (none)'],[20,40]]])
      return report(dims,names,options.empty?[]:[[['/'],[100,300,120,.6]],[['/products'],[90,200,100,.5]],[['/checkout'],[20,60,24,.8]]],options.empty?0:3)
    })
    if(options.threshold)reports.forEach(r=>{r.metadata.subjectToThresholding=true;r.metadata.dataLossFromOtherRow=true;r.metadata.samplingMetadatas=[{samplesReadCount:'1',samplingSpaceSize:'2'}]})
    if(options.badHeaders)reports[0].metricHeaders[0].name='unexpected'
    return Response.json({reports})
  }
  const loader=sourceLoader({'@/lib/site-origin':{getConfiguredSiteOrigin:()=> options.origin || 'https://www.sarastores.com'}},{env:{...env,...options.env},fetch})
  const lib=loader.load('lib/page-flow-data.ts'),client=loader.load('lib/google-ga4.ts')
  return {calls,lib,client,loader,q:lib.PageFlowQuery.parse({})}
}
test('GA4 connection requires a numeric property, never a Measurement ID or storefront login OAuth',async()=>{
  const f=fixture({env:{GOOGLE_GA4_PROPERTY_ID:'G-WPZC537DQY',GOOGLE_GA4_CLIENT_ID:undefined,GOOGLE_GA4_CLIENT_SECRET:undefined,GOOGLE_GA4_REFRESH_TOKEN:undefined,GOOGLE_CLIENT_ID:'login-client',GOOGLE_CLIENT_SECRET:'login-secret'}})
  assert.equal(f.client.ga4Connection().configured,false)
  await assert.rejects(f.lib.getPageFlow(f.q),e=>e.code==='GA4_NOT_CONFIGURED')
  assert.equal(f.calls.length,0)
})

test('local preview traffic requires the public hostname and rejects URL-shaped overrides',async()=>{
  const local=fixture({origin:'http://localhost:3000'})
  await assert.rejects(local.lib.getPageFlow(local.q),e=>e.code==='GA4_SITE_MISSING')
  assert.equal(local.calls.length,0)
  const override=fixture({origin:'http://localhost:3000',env:{GOOGLE_GA4_HOSTNAME:'www.sarastores.com'}})
  const result=await override.lib.getPageFlow(override.q)
  assert.equal(result.summary.users,123)
  for(const host of ['https://www.sarastores.com','www.sarastores.com/private','www.sarastores.com:443']) {
    const invalid=fixture({env:{GOOGLE_GA4_HOSTNAME:host}})
    await assert.rejects(invalid.lib.getPageFlow(invalid.q),e=>e.code==='GA4_SITE_INVALID')
    assert.equal(invalid.calls.length,0)
  }
})
test('page graph uses real GA4 report totals instead of adding non-additive per-page users',async()=>{
  const f=fixture(),result=await f.lib.getPageFlow(f.q)
  assert.equal(result.summary.users,123);assert.equal(result.pages[0].users,100);assert.equal(result.pages[1].users,90)
  assert.equal(result.timeZone,'Asia/Kolkata');assert.equal(result.currency,'INR')
  assert.equal(result.summary.users===result.pages.reduce((n,p)=>n+p.users,0),false)
  assert.ok(f.calls.find(c=>c.url.endsWith('/metadata')))
  assert.ok(f.calls.findIndex(c=>c.url.endsWith(':checkCompatibility'))<f.calls.findIndex(c=>c.url.endsWith(':batchRunReports')))
})
test('referrer variants sum views while distinct user counts become unavailable, and private/external URLs are excluded',async()=>{
  const f=fixture(),result=await f.lib.getPageFlow(f.q)
  const edge=result.referrals.find(e=>e.source==='/' && e.target==='/products')
  assert.equal(edge.views,180);assert.equal(edge.users,null);assert.equal(edge.groups,2)
  assert.equal(result.referrals.length,2)
  assert.equal(JSON.stringify(result).includes('campaign='),false);assert.equal(JSON.stringify(result).includes('fixture@example'),false)
})
test('site, private-page, device, source and literal page-search filters are sent consistently',async()=>{
  const f=fixture(),q={...f.q,device:'mobile',source:'google / organic',search:'/products'}
  await f.lib.getPageFlow(q)
  const batch=JSON.parse(f.calls.find(c=>c.url.endsWith(':batchRunReports')).init.body)
  for(const r of batch.requests) {
    const text=JSON.stringify(r.dimensionFilter)
    assert.ok(text.includes('hostName'));assert.ok(text.includes('www.sarastores.com'));assert.ok(text.includes('notExpression'))
    assert.ok(text.includes('deviceCategory'));assert.ok(text.includes('sessionSourceMedium'));assert.ok(text.includes('CONTAINS'))
    const regex=r.dimensionFilter.andGroup.expressions[1].notExpression.filter.stringFilter.value
    assert.ok(new RegExp(regex).test('/admin/customer-flow'));assert.equal(new RegExp(regex).test('/products'),false)
  }
})
test('GA4 pages are paginated remotely, sort fields are allowlisted, and path sort does not duplicate ordering',async()=>{
  const f=fixture()
  await f.lib.getPageFlow({...f.q,mode:'pages',page:3,limit:25,sort:'path',direction:'asc'})
  const r=JSON.parse(f.calls.find(c=>c.url.endsWith(':batchRunReports')).init.body).requests[0]
  assert.equal(r.offset,'50');assert.equal(r.limit,'25');assert.equal(r.orderBys.filter(o=>o.dimension?.dimensionName==='pagePath').length,1)
  assert.equal(f.lib.PageFlowQuery.safeParse({sort:'arbitraryMetric'}).success,false)
})
test('page details query the selected public page and return anonymous device/source aggregates',async()=>{
  const f=fixture(),result=await f.lib.getPageFlow({...f.q,mode:'detail',path:'/products'})
  assert.equal(result.path,'/products');assert.equal(result.breakdown[0].device,'mobile');assert.equal(result.breakdown[0].users,45)
  const batch=JSON.parse(f.calls.find(c=>c.url.endsWith(':batchRunReports')).init.body)
  assert.ok(batch.requests.every(r=>JSON.stringify(r.dimensionFilter).includes('"value":"/products"')))
  assert.equal('customers' in result,false);assert.equal('email' in result,false)
})
test('missing metadata or incompatible fields cannot produce fabricated zeros',async()=>{
  for(const options of [{dimensions:['hostName']},{incompatible:true}]) {
    const f=fixture(options)
    await assert.rejects(f.lib.getPageFlow(f.q),e=>e.code==='GA4_METADATA_UNSUPPORTED' || e.code==='GA4_REPORT_INCOMPATIBLE')
    assert.equal(f.calls.some(c=>c.url.endsWith(':batchRunReports')),false)
  }
})
test('invalid GA4 report headers fail rather than assigning metrics to the wrong counts',async()=>{
  const f=fixture({badHeaders:true})
  await assert.rejects(f.lib.getPageFlow(f.q),e=>e.code==='GA4_RESPONSE_INVALID')
})
test('valid empty page reports remain distinguishable from missing reporting access',async()=>{
  const f=fixture({empty:true}),result=await f.lib.getPageFlow(f.q)
  assert.equal(result.pages.length,0);assert.equal(result.pageCount,0)
  assert.ok(result.propertyId);assert.equal(result.timeZone,'Asia/Kolkata')
})

test('Google empty dimensionless reports may omit headers and rows without becoming a connection error',async()=>{
  const f=fixture({empty:true,emptyOverview:true}),result=await f.lib.getPageFlow(f.q)
  assert.deepEqual({...result.summary},{users:0,views:0,sessions:0})
  assert.equal(result.pages.length,0)
  assert.equal(result.pageCount,0)
  assert.equal(result.timeZone,'Asia/Kolkata')
  assert.equal(result.propertyId,env.GOOGLE_GA4_PROPERTY_ID)
  const detail=await f.lib.getPageFlow({...f.q,mode:'detail',path:'/products'})
  assert.equal(detail.summary.users,0)
  const route=sourceLoader({
    '@/lib/auth':{requireFullAdmin:async()=>({ok:true})},
    '@/lib/google-ga4':f.client,'@/lib/page-flow-data':f.lib,
  }).load('app/api/admin/page-flow/route.ts')
  const response=await route.GET(new NextRequest('http://localhost/api/admin/page-flow'))
  assert.equal(response.status,200)
  assert.equal((await response.json()).summary.users,0)
})
test('thresholding, sampling and data loss are reported explicitly',async()=>{
  const f=fixture({threshold:true}),r=await f.lib.getPageFlow(f.q)
  assert.ok(r.notes.some(n=>n.includes('thresholds')));assert.ok(r.notes.some(n=>n.includes('sampled')));assert.ok(r.notes.some(n=>n.includes('data loss')))
})
test('read-only OAuth permission is checked and provider secrets are never returned in errors',async()=>{
  for(const options of [{scope:'openid email'},{status:403},{status:429},{tokenFailure:true}]) {
    const f=fixture(options)
    await assert.rejects(f.lib.getPageFlow(f.q),e=>{assert.equal(e.message.includes('private-provider-response'),false);assert.equal(e.message.includes('secret-provider-body'),false);return e instanceof Error || e.name==='Ga4Error'})
  }
})

test('OAuth refresh preserves the granted scope without requesting a new permission',async()=>{
  const f=fixture()
  await f.lib.getPageFlow(f.q)
  const body=new URLSearchParams(f.calls.find(c=>c.url==='https://oauth2.googleapis.com/token').init.body)
  assert.equal(body.get('grant_type'),'refresh_token')
  assert.equal(body.has('scope'),false)
})

test('a login-only refresh token requires new Analytics consent and never reaches report endpoints',async()=>{
  const f=fixture({scope:'https://www.googleapis.com/auth/userinfo.email'})
  await assert.rejects(f.lib.getPageFlow(f.q),e=>e.code==='GA4_SCOPE_MISSING' && e.status===403 && e.message.includes('GOOGLE_GA4_REFRESH_TOKEN'))
  assert.equal(f.calls.length,1)
})

test('OAuth failures give safe, specific remediation without exposing Google response details',async()=>{
  for(const [oauthError,code] of [['invalid_grant','GA4_REAUTHORIZE_REQUIRED'],['invalid_client','GA4_CLIENT_INVALID'],['invalid_scope','GA4_SCOPE_MISSING']]) {
    const f=fixture({oauthError})
    await assert.rejects(f.lib.getPageFlow(f.q),e=>e.code===code && !e.message.includes('secret-provider-body'))
    assert.equal(f.calls.length,1)
  }
})
test('identical reports are cached and concurrent reads coalesce to reduce quota consumption',async()=>{
  const f=fixture()
  await Promise.all([f.lib.getPageFlow(f.q),f.lib.getPageFlow(f.q)])
  assert.equal(f.calls.filter(c=>c.url.endsWith(':batchRunReports')).length,1)
  const cached=await f.lib.getPageFlow(f.q);assert.equal(cached.cached,true)
  await f.lib.getPageFlow({...f.q,refresh:'1'});assert.equal(f.calls.filter(c=>c.url.endsWith(':batchRunReports')).length,2)
})
test('date presets defer to GA4 property timezone and custom dates are bounded and validated',()=>{
  const f=fixture()
  assert.equal(f.lib.ga4Dates({...f.q,preset:'Last 7 Days'}).startDate,'6daysAgo')
  assert.equal(f.lib.ga4Dates({...f.q,preset:'Yesterday'}).endDate,'yesterday')
  for(const fields of [{preset:'Custom',startDate:'2026-02-30',endDate:'2026-03-01'},{preset:'Custom',startDate:'2020-01-01',endDate:'2026-01-01'},{mode:'detail',path:'/account/orders'},{mode:'detail',path:'/products?email=fixture'},{page:-1}])assert.equal(f.lib.PageFlowQuery.safeParse(fields).success,false)
})
test('full admin authorization runs before checking credentials or calling Google',async()=>{
  let reads=0
  const route=sourceLoader({'@/lib/auth':{requireFullAdmin:async()=>({ok:false,response:new Response('Denied',{status:403})})},'@/lib/google-ga4':{ga4Connection:()=>{reads++}},'@/lib/page-flow-data':{PageFlowQuery:{safeParse:()=>{throw new Error('Must not parse first')}}}}).load('app/api/admin/page-flow/route.ts')
  assert.equal((await route.GET(new NextRequest('http://localhost/api/admin/page-flow'))).status,403);assert.equal(reads,0)
})
test('service-account authentication signs a readonly JWT from an external credential file',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sara-ga4-test-')),file=path.join(temp,'credential.json')
  try {
    const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}})
    fs.writeFileSync(file,JSON.stringify({type:'service_account',client_email:'reporting@example.test',private_key:privateKey}))
    let assertion
    const loader=sourceLoader({}, {env:{GOOGLE_GA4_PROPERTY_ID:'123456789',GOOGLE_GA4_CREDENTIALS_FILE:file},fetch:async(url,init)=>{
      assert.equal(url,'https://oauth2.googleapis.com/token');assertion=new URLSearchParams(init.body).get('assertion')
      return Response.json({access_token:'fixture-token',expires_in:3600,scope})
    }})
    const ctx=await loader.load('lib/google-ga4.ts').ga4Context();await ctx.token()
    const payload=JSON.parse(Buffer.from(assertion.split('.')[1],'base64url').toString())
    assert.equal(payload.scope,scope);assert.equal(payload.aud,'https://oauth2.googleapis.com/token');assert.equal(payload.iss,'reporting@example.test')
  }finally {fs.unlinkSync(file);fs.rmdirSync(temp)}
})
