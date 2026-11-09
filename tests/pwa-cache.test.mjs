import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { sourceLoader } from './source-loader.mjs'

function worker({fetch:network=async()=>Response.json({ok:true},{headers:{'Cache-Control':'public, max-age=60'}}),failPut=false,failOpen=false}={}) {
  const handlers={},stores=new Map(),deleted=[];let now=100000,fetches=0
  const key=r=>typeof r==='string'?r:r.url
  const caches={
    keys:async()=>[...stores.keys()],delete:async name=>{deleted.push(name);return stores.delete(name)},
    open:async name=>{if(failOpen)throw new Error('storage unavailable');if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name)
      return {match:async r=>map.get(key(r))?.clone(),put:async(r,response)=>{if(failPut)throw new Error('quota');map.set(key(r),response.clone())},
        delete:async r=>map.delete(key(r)),keys:async()=>[...map.keys()].map(url=>({url}))}},
  }
  class Clock extends Date {static now(){return now}}
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
    self:{location:{origin:'https://fixture.test'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}},
    caches,Headers,Response,URL,Date:Clock,fetch:async request=>{fetches++;return network(request)},
  })
  return {stores,deleted,fetches:()=>fetches,advance:ms=>now+=ms,
    async activate(){let pending;handlers.activate({waitUntil:p=>pending=p});await pending},
    async request(url,options={}){let response;const waits=[]
      handlers.fetch({request:{url,method:'GET',mode:'cors',headers:new Headers(),cache:'default',...options},respondWith:p=>response=p,waitUntil:p=>waits.push(p)})
      const result=await response;await Promise.all(waits);return result},
  }
}
test('worker never handles private/detail, cross-origin, navigation or mutation requests',async()=>{
  const w=worker()
  for(const [url,options] of [
    ['https://fixture.test/api/products/customer-history',{}],['https://fixture.test/api/products/listing?fields=admin',{}],
    ['https://fixture.test/api/settings',{}],['https://fixture.test/api/orders',{}],['https://outside.test/_next/static/a.js',{}],
    ['https://fixture.test/_next/static/a.js',{method:'POST'}],['https://fixture.test/_next/static/a.js',{mode:'navigate'}],
    ['https://fixture.test/api/categories',{headers:new Headers({authorization:'Bearer fixture'})}],
    ['https://fixture.test/api/categories',{cache:'no-store'}],
  ])assert.equal(await w.request(url,options),undefined)
  assert.equal(w.fetches(),0)
})
test('API caching requires explicit public, freshable responses and respects upstream Age',async()=>{
  for(const control of ['private, max-age=60','public, no-store','public, no-cache','public, max-age=0','max-age=60','']){
    const w=worker({fetch:async()=>Response.json({ok:true},{headers:{'Cache-Control':control}})})
    assert.equal((await w.request('https://fixture.test/api/categories')).status,200)
    assert.equal(w.stores.get('sara-public-v5').size,0)
  }
  const aged=worker({fetch:async()=>Response.json({ok:true},{headers:{'Cache-Control':'public, max-age=60',Age:'50'}})})
  await aged.request('https://fixture.test/api/categories')
  assert.equal([...aged.stores.get('sara-public-v5').values()][0].headers.get('sara-cache-ttl'),'10000')
})
test('expired public data is removed and cannot be served as an offline success',async()=>{
  let offline=false
  const w=worker({fetch:async()=>{if(offline)throw new Error('offline');return Response.json({fresh:true},{headers:{'Cache-Control':'public, max-age=60'}})}})
  await w.request('https://fixture.test/api/categories');w.advance(60001);offline=true
  assert.equal((await w.request('https://fixture.test/api/categories')).status,503)
  assert.equal(w.stores.get('sara-public-v5').size,0)
})
test('fresh hashed static assets avoid network requests and cache write failures preserve network success',async()=>{
  const w=worker()
  await w.request('https://fixture.test/_next/static/chunks/fixture.js')
  const fetched=w.fetches();assert.equal((await w.request('https://fixture.test/_next/static/chunks/fixture.js')).status,200)
  assert.equal(w.fetches(),fetched)
  const quota=worker({failPut:true})
  assert.equal((await quota.request('https://fixture.test/api/categories')).status,200)
})
test('API cache is bounded and activation removes only explicitly owned old caches',async()=>{
  const w=worker()
  for(let i=0;i<65;i++)await w.request(`https://fixture.test/api/categories?page=${i}`)
  assert.equal(w.stores.get('sara-public-v5').size,60)
  w.stores.set('app-cache-v4',new Map());w.stores.set('api-cache-v4',new Map());w.stores.set('another-app',new Map())
  await w.activate()
  assert.ok(w.deleted.includes('app-cache-v4'));assert.ok(w.stores.has('another-app'));assert.ok(w.stores.has('sara-public-v5'))
})
test('disabled browser cache storage cannot prevent a successful network response',async()=>{
  const w=worker({failOpen:true})
  assert.equal((await w.request('https://fixture.test/api/categories')).status,200)
  assert.equal(w.fetches(),1)
})
test('enabled registration preserves existing caches and disabled cleanup preserves unrelated workers/caches',async()=>{
  const {pwaRegistrationScript}=sourceLoader().load('lib/pwa-registration.ts')
  for(const enabled of [true,false]){
    const registrations=[],removed=[],deleted=[]
    const caches={keys:async()=>['app-cache-v4','sara-public-v5','another-app'],delete:async key=>deleted.push(key)}
    const globals={URL,document:{readyState:'complete'},location:{origin:'https://fixture.test'},window:{caches,addEventListener(){}},caches,
      navigator:{serviceWorker:{register:async(...args)=>registrations.push(args),getRegistrations:async()=>[
        {active:{scriptURL:'https://fixture.test/sw.js'},unregister:async()=>removed.push('sara')},
        {active:{scriptURL:'https://fixture.test/other-worker.js'},unregister:async()=>removed.push('other')},
      ]}}}
    vm.runInNewContext(pwaRegistrationScript(enabled),globals)
    await new Promise(resolve=>setTimeout(resolve,0))
    if(enabled){assert.equal(registrations.length,1);assert.equal(deleted.length,0);assert.equal(removed.length,0)}
    else{assert.deepEqual(removed,['sara']);assert.deepEqual(deleted,['app-cache-v4','sara-public-v5'])}
  }
})
