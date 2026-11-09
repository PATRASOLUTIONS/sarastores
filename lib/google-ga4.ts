import { createHash,createSign } from 'node:crypto'
import { readFile,realpath } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { PageFlowConnection } from '@/lib/page-flow'

export const GA4_SCOPE='https://www.googleapis.com/auth/analytics.readonly'
export class Ga4Error extends Error {
  constructor(message:string,public status=503,public code='GA4_UNAVAILABLE',public missing:string[]=[]) {super(message);this.name='Ga4Error'}
}
export function ga4Connection():PageFlowConnection {
  const propertyId=(process.env.GOOGLE_GA4_PROPERTY_ID || '').trim()
  const file=(process.env.GOOGLE_GA4_CREDENTIALS_FILE || '').trim()
  const missing:string[]=[]
  if(!/^\d{1,20}$/.test(propertyId))missing.push('GOOGLE_GA4_PROPERTY_ID')
  if(!file)for(const name of ['GOOGLE_GA4_CLIENT_ID','GOOGLE_GA4_CLIENT_SECRET','GOOGLE_GA4_REFRESH_TOKEN'])if(!process.env[name]?.trim())missing.push(name)
  const id=process.env.NEXT_PUBLIC_GA_ID || ''
  return {configured:missing.length===0,propertyId:/^\d{1,20}$/.test(propertyId)?propertyId:null,authType:file?'service-account':'oauth',missing,measurementId:/^G-[A-Z0-9]+$/.test(id)?id:null}
}
type Context={propertyId:string;key:string;token:()=>Promise<string>}
const tokens=new Map<string,{value:string;expires:number}>()
const tokenPromises=new Map<string,Promise<string>>()
const metadataCache=new Map<string,{expires:number;value:{dimensions:Set<string>;metrics:Set<string>}}>()
const digest=(value:string)=>createHash('sha256').update(value).digest('hex')
export async function ga4Context():Promise<Context> {
  const config=ga4Connection()
  if(!config.configured || !config.propertyId)throw new Ga4Error('Connect a numeric GA4 property and dedicated read-only reporting credentials.',503,'GA4_NOT_CONFIGURED',config.missing)
  let fields:Record<string,string>,key:string
  const file=process.env.GOOGLE_GA4_CREDENTIALS_FILE?.trim()
  if(file) {
    let credentials:z.infer<typeof serviceAccount>
    try {
      const resolved=await realpath(path.resolve(file)),relative=path.relative(process.cwd(),resolved)
      if(!relative.startsWith('..'+path.sep) && !path.isAbsolute(relative) || /(^|[\\/])OneDrive(?:[^\\/]*)?([\\/]|$)/i.test(resolved))throw new Error('Unsafe credential location')
      const raw=await readFile(resolved,'utf8')
      if(raw.length>20000)throw new Error('Oversized credentials')
      credentials=serviceAccount.parse(JSON.parse(raw));key=digest(config.propertyId+raw)
    }catch{throw new Ga4Error('The dedicated service-account file must be valid and stored outside the project and OneDrive.',503,'GA4_CREDENTIALS_INVALID')}
    const now=Math.floor(Date.now()/1000)
    const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url')
    const claims=Buffer.from(JSON.stringify({iss:credentials.client_email,scope:GA4_SCOPE,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})).toString('base64url')
    const value=`${header}.${claims}`
    let signature:string
    try {signature=createSign('RSA-SHA256').update(value).sign(credentials.private_key,'base64url')}
    catch{throw new Ga4Error('The dedicated service-account signing key is invalid.',503,'GA4_CREDENTIALS_INVALID')}
    fields={grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${value}.${signature}`}
  }else {
    // Refresh preserves the original grant. New scopes require a fresh consent
    // flow, not a scope parameter on Google's refresh-token request.
    fields={grant_type:'refresh_token',client_id:process.env.GOOGLE_GA4_CLIENT_ID!.trim(),client_secret:process.env.GOOGLE_GA4_CLIENT_SECRET!.trim(),refresh_token:process.env.GOOGLE_GA4_REFRESH_TOKEN!.trim()}
    key=digest(config.propertyId+JSON.stringify(fields))
  }
  const token=async()=>{
    const cached=tokens.get(key)
    if(cached && cached.expires>Date.now())return cached.value
    if(tokenPromises.has(key))return tokenPromises.get(key)!
    const pending=(async()=>{
      const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),signal:AbortSignal.timeout(10000)})
      if(!response.ok) {
        const problem=await response.json().catch(()=>null)
        if(problem?.error==='invalid_grant')throw new Ga4Error('The GA4 reporting refresh token expired or was revoked. Re-authorize the dedicated reporting client with analytics.readonly and replace GOOGLE_GA4_REFRESH_TOKEN.',403,'GA4_REAUTHORIZE_REQUIRED')
        if(problem?.error==='invalid_client')throw new Ga4Error('Google rejected the reporting OAuth client. Check that GOOGLE_GA4_CLIENT_ID and GOOGLE_GA4_CLIENT_SECRET belong to the client that issued this refresh token.',503,'GA4_CLIENT_INVALID')
        if(problem?.error==='invalid_scope')throw new Ga4Error('Google rejected the reporting permission. Re-authorize the dedicated reporting client with analytics.readonly and replace GOOGLE_GA4_REFRESH_TOKEN.',403,'GA4_SCOPE_MISSING')
        throw new Ga4Error('Google reporting authorization failed. Check the dedicated GA4 credentials.',response.status===429?429:503,'GA4_AUTH_FAILED')
      }
      const parsed=tokenSchema.safeParse(await response.json())
      if(!parsed.success)throw new Ga4Error('Google returned an invalid reporting token response.',503,'GA4_AUTH_FAILED')
      if(parsed.data.scope && !parsed.data.scope.split(' ').includes(GA4_SCOPE))throw new Ga4Error('This refresh token does not grant analytics.readonly. Re-authorize the dedicated reporting OAuth client with that scope and replace GOOGLE_GA4_REFRESH_TOKEN; refreshing a login-only token cannot add Analytics access.',403,'GA4_SCOPE_MISSING')
      if(tokens.size>5)tokens.clear()
      tokens.set(key,{value:parsed.data.access_token,expires:Date.now()+Math.max(0,Math.min(parsed.data.expires_in,3600)-60)*1000})
      return parsed.data.access_token
    })()
    tokenPromises.set(key,pending)
    try{return await pending}finally{tokenPromises.delete(key)}
  }
  return {propertyId:config.propertyId,key,token}
}
const serviceAccount=z.object({type:z.literal('service_account'),client_email:z.string().email(),private_key:z.string().min(100).max(16000)})
const tokenSchema=z.object({access_token:z.string().min(1),expires_in:z.number().positive().default(3600),scope:z.string().optional()})
export async function ga4Request(context:Context,method:'metadata'|'checkCompatibility'|'batchRunReports',body?:unknown):Promise<unknown> {
  const suffix=method==='metadata'?'/metadata':`:${method}`
  try {
    const response=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${context.propertyId}${suffix}`,{
      method:method==='metadata'?'GET':'POST',cache:'no-store',headers:{Authorization:`Bearer ${await context.token()}`,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),
    })
    if(!response.ok) {
      if(response.status===401)tokens.delete(context.key)
      throw new Ga4Error(response.status===429?'GA4 quota is temporarily exhausted. Retry later.':response.status===403?'GA4 access was denied. Enable the Analytics Data API and grant the dedicated principal Viewer access to this property.':'The GA4 report could not be read. Check property access and reporting configuration.',response.status===429?429:response.status===403?403:503,response.status===429?'GA4_QUOTA_LIMIT':response.status===403?'GA4_ACCESS_DENIED':'GA4_REPORT_FAILED')
    }
    return await response.json()
  }catch(error){if(error instanceof Ga4Error)throw error;throw new Ga4Error('Google Analytics did not respond in time. Retry the report.',503,'GA4_REQUEST_FAILED')}
}
const metadataSchema=z.object({dimensions:z.array(z.object({apiName:z.string()})),metrics:z.array(z.object({apiName:z.string()}))})
/** Validate current property metadata and dimension/metric compatibility before reading any report. */
export async function validateGa4Report(context:Context,dimensions:string[],metrics:string[]) {
  let metadata=metadataCache.get(context.key)
  if(!metadata || metadata.expires<Date.now()) {
    const parsed=metadataSchema.safeParse(await ga4Request(context,'metadata'))
    if(!parsed.success)throw new Ga4Error('GA4 metadata could not be validated.',503,'GA4_METADATA_INVALID')
    metadata={expires:Date.now()+3600000,value:{dimensions:new Set(parsed.data.dimensions.map(d=>d.apiName)),metrics:new Set(parsed.data.metrics.map(m=>m.apiName))}}
    if(metadataCache.size>5)metadataCache.clear()
    metadataCache.set(context.key,metadata)
  }
  if(dimensions.some(d=>!metadata!.value.dimensions.has(d)) || metrics.some(m=>!metadata!.value.metrics.has(m)))throw new Ga4Error('This GA4 property does not expose the requested page-report fields.',503,'GA4_METADATA_UNSUPPORTED')
  const raw=await ga4Request(context,'checkCompatibility',{dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name}))})
  const result=z.object({dimensionCompatibilities:z.array(z.object({dimensionMetadata:z.object({apiName:z.string()}),compatibility:z.string()})),metricCompatibilities:z.array(z.object({metricMetadata:z.object({apiName:z.string()}),compatibility:z.string()}))}).safeParse(raw)
  if(!result.success || dimensions.some(name=>!result.data.dimensionCompatibilities.some(d=>d.dimensionMetadata.apiName===name && d.compatibility==='COMPATIBLE')) || metrics.some(name=>!result.data.metricCompatibilities.some(m=>m.metricMetadata.apiName===name && m.compatibility==='COMPATIBLE')))throw new Ga4Error('GA4 cannot combine the requested page dimensions and metrics.',503,'GA4_REPORT_INCOMPATIBLE')
}
