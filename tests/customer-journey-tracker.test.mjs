import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLoader } from './source-loader.mjs'
function fixture(){
  let path='/products',user=null,consent=false,loading=false
  const seen=[],last={current:''},listeners=new Map()
  const Component=sourceLoader({
    react:{useRef:()=>last,useEffect:fn=>fn()},'next/navigation':{usePathname:()=>path},
    '@/contexts/AuthContext':{useAuth:()=>({user,isLoading:loading})},
    '@/lib/consent-client':{hasConsent:()=>consent,CONSENT_CHANGE_EVENT:'consent'},
    '@/lib/analytics':{track:event=>seen.push(event)},
  },{context:{window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}}}).load('components/CustomerJourneyTracker.tsx').default
  return {seen,render:Component,set(values){if('path'in values)path=values.path;if('user'in values)user=values.user;if('consent'in values)consent=values.consent;if('loading'in values)loading=values.loading},changeConsent(){listeners.get('consent')?.()}}
}
test('route milestones respect consent and do not count an auth refresh as another visit',()=>{
  const f=fixture();f.render();assert.equal(f.seen.length,0)
  f.set({consent:true});f.changeConsent();assert.deepEqual(f.seen,['page_view','browse_products'])
  f.set({user:{id:'synthetic-user'}});f.render();assert.equal(f.seen.length,2)
  f.set({path:'/admin/page-flow'});f.render();assert.equal(f.seen.length,2)
  f.set({consent:false});f.changeConsent();f.set({path:'/products',consent:true});f.render();assert.equal(f.seen.length,4)
})
test('checkout route observes entry without emitting an empty ecommerce begin_checkout',()=>{
  const f=fixture();f.set({path:'/checkout',consent:true});f.render()
  assert.deepEqual(f.seen,['page_view','guest_checkout','checkout_started'])
  const {FLOW_EVENT_STAGES}=sourceLoader().load('lib/customer-flow.ts')
  assert.equal(FLOW_EVENT_STAGES.checkout_started[0],'checkout');assert.equal(FLOW_EVENT_STAGES.begin_checkout[0],'checkout')
})
