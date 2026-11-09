import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sourceLoader } from './source-loader.mjs'
import { marketingReadiness } from '../scripts/check-marketing-setup.mjs'
const env={NEXT_PUBLIC_GA_ID:'G-FIXTURE123',NEXT_PUBLIC_GTM_ID:'GTM-FIXTURE123'}
function client(mode){
 let analytics=false,advertising=false
 const listeners=new Map(),window={}
 window.addEventListener=(name,fn)=>listeners.set(name,fn)
 const loader=sourceLoader({'@/lib/consent-client':{hasConsent:category=>category==='analytics'?analytics:advertising,CONSENT_CHANGE_EVENT:'consent'}},
   {env:{...env,...(mode?{NEXT_PUBLIC_GOOGLE_TAG_MODE:mode}:{})},context:{window}})
 return {window,api:loader.load('lib/google-tag-client.ts'),consent(a,b=false){analytics=a;advertising=b;listeners.get('consent')?.()}}
}
const commands=window=>(window.dataLayer||[]).filter(entry=>entry[0]).map(entry=>Array.from(entry))
test('direct GA4 defaults over an empty GTM option and explicit modes choose exactly one installation',()=>{
 const {googleTagMode}=sourceLoader().load('lib/google-tag-mode.ts')
 assert.equal(googleTagMode(env),'direct');assert.equal(googleTagMode({...env,NEXT_PUBLIC_GOOGLE_TAG_MODE:'gtm'}),'gtm')
 assert.equal(googleTagMode({...env,NEXT_PUBLIC_GOOGLE_TAG_MODE:'invalid'}),'none')
 assert.equal(googleTagMode({NEXT_PUBLIC_GTM_ID:env.NEXT_PUBLIC_GTM_ID}),'gtm')
 assert.equal(marketingReadiness(env).checks.find(row=>row.area==='GA4 / GTM').mode,'direct')
})
test('Google configuration and events remain absent before analytics consent',()=>{
 const f=client();assert.equal(f.api.initializeGoogleTag(env.NEXT_PUBLIC_GA_ID),false)
 f.api.sendGoogleTagEvent('add_to_cart',{value:100});assert.equal(f.window.dataLayer,undefined)
})
test('initialization queues Google config once, preserves early ecommerce events and avoids duplicate manual page views',()=>{
 const f=client();f.consent(true)
 f.api.sendGoogleTagEvent('page_view',{})
 f.api.sendGoogleTagEvent('view_item',{items:[{item_id:'synthetic-product'}],value:100,currency:'INR'})
 f.api.initializeGoogleTag(env.NEXT_PUBLIC_GA_ID);f.api.sendGoogleTagEvent('page_view',{})
 const calls=commands(f.window)
 assert.equal(calls.filter(call=>call[0]==='config').length,1)
 assert.equal(calls.filter(call=>call[0]==='js').length,1)
 assert.equal(calls.filter(call=>call[0]==='event').length,1)
 assert.equal(calls.find(call=>call[0]==='event')[1],'view_item')
 assert.ok(calls.findIndex(call=>call[0]==='config')<calls.findIndex(call=>call[0]==='event'))
 assert.equal(calls.find(call=>call[0]==='consent' && call[1]==='update')[2].ad_storage,'denied')
})
test('consent withdrawal disables automatic Google collection and regrant restores the same installation',()=>{
 const f=client();f.consent(true);f.api.initializeGoogleTag(env.NEXT_PUBLIC_GA_ID)
 f.consent(false);assert.equal(f.window['ga-disable-G-FIXTURE123'],true)
 const before=commands(f.window).length;f.api.sendGoogleTagEvent('purchase',{value:100});assert.equal(commands(f.window).length,before)
 f.consent(true,true);assert.equal(f.window['ga-disable-G-FIXTURE123'],false)
 f.api.initializeGoogleTag(env.NEXT_PUBLIC_GA_ID)
 assert.equal(commands(f.window).filter(call=>call[0]==='config').length,1)
})
test('GTM mode never dispatches a second direct gtag event',()=>{
 const f=client('gtm');f.consent(true,true);f.api.sendGoogleTagEvent('purchase',{value:100})
 assert.equal(f.window.dataLayer,undefined)
})
test('root measurement renders one direct Google script with analytics-only consent and no GTM initializer',()=>{
 const Component=sourceLoader({
  react:{...React,useEffect(){}},'next/script':({src,id,children})=>React.createElement('script',{src,id},children),
  '@/components/ConsentGate':({category,children})=>category==='analytics'?children:null,
 },{env}).load('components/MarketingTags.tsx').default
 const html=renderToStaticMarkup(React.createElement(Component))
 assert.match(html,/gtag\/js\?id=G-FIXTURE123/)
 assert.equal((html.match(/id="sara-google-tag"/g)||[]).length,1)
 assert.doesNotMatch(html,/gtm-init|gtm\.js/)
})
