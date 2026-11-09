// Isolated synthetic payload/CPU comparison. Never reads Sara data or providers.
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { gzipSync } from 'node:zlib'
import { sourceLoader } from '../tests/source-loader.mjs'
const {buildListingIndex,queryListing,listingQuerySchema}=sourceLoader().load('lib/catalogue-listing.ts')
const products=Array.from({length:1200},(_,i)=>({id:`synthetic-${i}`,slug:`synthetic-phone-${i}`,name:`Synthetic Phone ${i}`,price:10000+i*10,mrp:40000,stock:i%4?3:0,brand:i%2?'Brand A':'Brand B',category:'Phones',description:'Synthetic catalogue description. '.repeat(100),images:['/fixture.webp'],features:['Verified fixture feature'],specifications:{RAM:'8GB','Internal Storage':i%2?'128GB':'256GB'}}))
const started=performance.now(),index=buildListingIndex(products),indexMs=performance.now()-started
const q=listingQuerySchema.parse({}),samples=[];let result
for(let i=0;i<25;i++){const at=performance.now();result=queryListing(index,[{id:'phones',name:'Phones'}],{...q,page:1+i%10});samples.push(performance.now()-at)}
samples.sort((a,b)=>a-b)
const before=JSON.stringify(products),after=JSON.stringify(result)
const output={fixtureOnly:true,generatedAt:new Date().toISOString(),products:products.length,eligibleCustomersNotMeasured:true,matchingProducts:result.total,cardsPerPage:result.products.length,
  fullCatalogueJsonBytes:Buffer.byteLength(before),pagedJsonBytes:Buffer.byteLength(after),fullCatalogueGzipBytes:gzipSync(before).length,pagedGzipBytes:gzipSync(after).length,
  rawPayloadReductionPercent:Number(((1-Buffer.byteLength(after)/Buffer.byteLength(before))*100).toFixed(2)),indexConstructionMs:Number(indexMs.toFixed(2)),warmQueryP50Ms:Number(samples[12].toFixed(2)),warmQueryP95Ms:Number(samples[23].toFixed(2)),
  limits:'Synthetic payload and local CPU only. Excludes MongoDB, cold starts, deployment, network, browser rendering, LCP/INP/CLS and physical mobile data.'}
fs.mkdirSync('.seo-local',{recursive:true});fs.writeFileSync('.seo-local/catalogue-performance-comparison.json',JSON.stringify(output,null,2))
console.log(JSON.stringify(output,null,2))
