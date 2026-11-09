import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getConfiguredSiteOrigin } from '@/lib/site-origin'
import { ga4Context,ga4Request,validateGa4Report,Ga4Error } from '@/lib/google-ga4'
import { safePagePath,type PageFlowPage,type PageFlowReferral,type PageFlowReport,type PageFlowTable,type PageFlowDetail } from '@/lib/page-flow'

const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(+new Date(s)) && new Date(s).toISOString().slice(0,10)===s,'Invalid date')
export const PageFlowQuery=z.object({
  mode:z.enum(['status','graph','pages','detail']).default('graph'),
  preset:z.enum(['Today','Yesterday','Last 7 Days','Last 30 Days','Last 90 Days','Custom']).default('Last 7 Days'),
  startDate:z.union([z.literal(''),isoDate]).default(''),endDate:z.union([z.literal(''),isoDate]).default(''),
  device:z.enum(['','desktop','mobile','tablet']).default(''),source:z.string().max(100).default(''),search:z.string().max(120).default(''),
  graphLimit:z.coerce.number().int().min(1).max(100).default(30),page:z.coerce.number().int().min(1).max(10000).default(1),
  limit:z.coerce.number().int().min(1).max(100).default(25),path:z.string().max(500).default(''),
  sort:z.enum(['users','views','sessions','path','engagementRate']).default('users'),direction:z.enum(['asc','desc']).default('desc'),
  refresh:z.enum(['','1']).default(''),
}).superRefine((q,ctx)=>{
  if(q.preset==='Custom' && (!q.startDate || !q.endDate || +new Date(q.endDate)<+new Date(q.startDate) || +new Date(q.endDate)-+new Date(q.startDate)>365*86400000))ctx.addIssue({code:'custom',message:'Choose a valid custom date range of up to 366 days.'})
  if(q.mode==='detail' && safePagePath(q.path)!==q.path)ctx.addIssue({code:'custom',message:'Choose a public page path without query parameters.'})
})
export type PageFlowQueryInput=z.infer<typeof PageFlowQuery>
type Json=Record<string,unknown>
const PRIVATE_PAGES='^/(admin|api|account|dashboard|vendor|orders?|users?|customers?)(/.*)?$'
const METRICS=['totalUsers','screenPageViews','sessions','engagementRate']
const numeric=z.string().refine(s=>s.trim()!=='' && Number.isFinite(Number(s)) && Number(s)>=0,'Invalid GA4 metric')
const metadata=z.object({timeZone:z.string().optional(),currencyCode:z.string().optional(),subjectToThresholding:z.boolean().optional(),dataLossFromOtherRow:z.boolean().optional(),samplingMetadatas:z.array(z.object({samplesReadCount:z.string(),samplingSpaceSize:z.string()})).optional(),emptyReason:z.string().optional()}).passthrough()
const reportSchema=z.object({dimensionHeaders:z.array(z.object({name:z.string()})).default([]),metricHeaders:z.array(z.object({name:z.string()})),
  rows:z.array(z.object({dimensionValues:z.array(z.object({value:z.string()})).default([]),metricValues:z.array(z.object({value:numeric}))})).default([]),
  rowCount:z.number().int().nonnegative().default(0),metadata:metadata.default({}),propertyQuota:z.object({tokensPerHour:z.object({remaining:z.number().optional()}).optional()}).optional(),
})
type Report=z.infer<typeof reportSchema>
const caches=new Map<string,{expires:number;data:unknown}>(), pending=new Map<string,Promise<unknown>>()
const filter=(fieldName:string,value:string,matchType='EXACT'):Json=>({filter:{fieldName,stringFilter:{matchType,value,caseSensitive:false}}})
export function ga4Dates(q:PageFlowQueryInput) {
  if(q.preset==='Custom')return {startDate:q.startDate,endDate:q.endDate}
  if(q.preset==='Today')return {startDate:'today',endDate:'today'}
  if(q.preset==='Yesterday')return {startDate:'yesterday',endDate:'yesterday'}
  return {startDate:`${Number(q.preset.match(/\d+/)?.[0])-1}daysAgo`,endDate:'today'}
}
function siteHosts():string[] {
  const origin=getConfiguredSiteOrigin()
  const explicit=(process.env.GOOGLE_GA4_HOSTNAME || '').trim().toLowerCase()
  let host:string
  if(explicit) {
    try {const url=new URL(`https://${explicit}`);if(url.hostname!==explicit || url.port || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error();host=url.hostname}
    catch {throw new Ga4Error('GOOGLE_GA4_HOSTNAME must contain the public website hostname without a URL path or port.',503,'GA4_SITE_INVALID',['GOOGLE_GA4_HOSTNAME'])}
  }else if(origin)host=new URL(origin).hostname
  else throw new Ga4Error('Configure the public storefront hostname to scope GA4 reports to your website.',503,'GA4_SITE_MISSING',['GOOGLE_GA4_HOSTNAME'])
  if(['localhost','127.0.0.1','[::1]'].includes(host))throw new Ga4Error('This app is using a local website URL. Set GOOGLE_GA4_HOSTNAME to the public storefront hostname before reading production traffic.',503,'GA4_SITE_MISSING',['GOOGLE_GA4_HOSTNAME'])
  return host==='sarastores.com' || host==='www.sarastores.com'?['sarastores.com','www.sarastores.com']:[host]
}
export function pageReportFilter(q:PageFlowQueryInput,hosts:string[]):Json {
  const expressions:Json[]=[{filter:{fieldName:'hostName',inListFilter:{values:hosts,caseSensitive:false}}},{notExpression:filter('pagePath',PRIVATE_PAGES,'FULL_REGEXP')}]
  if(q.device)expressions.push(filter('deviceCategory',q.device))
  if(q.source)expressions.push(filter('sessionSourceMedium',q.source))
  if(q.mode==='detail')expressions.push(filter('pagePath',q.path))
  else if(q.search)expressions.push(filter('pagePath',q.search,'CONTAINS'))
  return {andGroup:{expressions}}
}
function requestBody(q:PageFlowQueryInput,hosts:string[],dimensions:string[],metrics:string[],limit:number,offset=0):Json {
  const metricName=({users:'totalUsers',views:'screenPageViews',sessions:'sessions',engagementRate:'engagementRate'} as const)[q.sort as Exclude<typeof q.sort,'path'>] || 'totalUsers'
  return {dateRanges:[ga4Dates(q)],dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),dimensionFilter:pageReportFilter(q,hosts),
    orderBys:dimensions.length?[q.sort==='path' && dimensions.includes('pagePath')?{dimension:{dimensionName:'pagePath'},desc:q.direction==='desc'}:{metric:{metricName:metrics.includes(metricName)?metricName:metrics[0]},desc:q.direction==='desc'},...dimensions.filter(d=>q.sort!=='path' || d!=='pagePath').map(d=>({dimension:{dimensionName:d},desc:false}))]:[],
    limit:String(limit),offset:String(offset),returnPropertyQuota:true,
  }
}
function parseReport(raw:unknown,dimensions:string[],metrics:string[]):Report {
  const parsed=reportSchema.safeParse(raw)
  if(!parsed.success)throw new Ga4Error('GA4 returned an unexpected report format. No counts were substituted.',503,'GA4_RESPONSE_INVALID')
  const r=parsed.data
  if(r.dimensionHeaders.length!==dimensions.length || r.dimensionHeaders.some((h,i)=>h.name!==dimensions[i]) || r.metricHeaders.length!==metrics.length || r.metricHeaders.some((h,i)=>h.name!==metrics[i]) || r.rows.some(row=>row.dimensionValues.length!==dimensions.length || row.metricValues.length!==metrics.length))throw new Ga4Error('GA4 report headers do not match the requested metrics.',503,'GA4_RESPONSE_INVALID')
  return r
}
function values(report:Report,row:Report['rows'][number]) {
  return Object.fromEntries(report.metricHeaders.map((h,i)=>[h.name,Number(row.metricValues[i].value)]))
}
function pages(report:Report):PageFlowPage[] {
  return report.rows.flatMap(row=>{
    const path=safePagePath(row.dimensionValues[0].value)
    if(!path || path!==row.dimensionValues[0].value)return []
    const m=values(report,row)
    return [{path,users:m.totalUsers,views:m.screenPageViews,sessions:m.sessions,engagementRate:m.engagementRate}]
  })
}
function summary(report:Report) {
  const m=report.rows[0]?values(report,report.rows[0]):{totalUsers:0,screenPageViews:0,sessions:0}
  return {users:m.totalUsers,views:m.screenPageViews,sessions:m.sessions}
}
function notes(reports:Report[]):string[] {
  const result=[
    'GA4 users are anonymous aggregate users under the property reporting identity, not registered customer accounts. Users can appear on several pages; page user counts must not be added together.',
    'Connections show GA4 reported referring pages. Referrer values can persist across single-page-app navigation; these connections do not prove the exact next page or a complete chronological journey.',
    'GA4 aggregates cannot reveal customer names, emails, phones or individual customer histories. Use Customer Flow for consented first-party customer records.',
    'Today is provisional. Standard GA4 reporting can be delayed; consent settings, modeled data and property reporting identity can change user counts.',
    'Reports are scoped to the configured storefront host and exclude private account/admin/order paths. Referrer queries and fragments are removed before display.',
  ]
  if(reports.some(r=>r.metadata.subjectToThresholding))result.push('GA4 applied data thresholds. Small cohorts may be withheld; visible numbers are not complete underlying traffic.')
  if(reports.some(r=>r.metadata.dataLossFromOtherRow))result.push('GA4 reports data loss from high-cardinality aggregation. Some page/referrer detail is unavailable.')
  if(reports.some(r=>r.metadata.samplingMetadatas?.length))result.push('GA4 returned sampled reports. Counts reflect the sampled reporting result.')
  if(reports.some(r=>!r.metadata.timeZone))result.push('The property timezone was not returned; date interpretation is unverified.')
  return result
}
/** Merge additive views, never sum distinct users across query-string variants of a referrer. */
export function pageReferrals(report:Report,hosts:string[],visible:Set<string>):PageFlowReferral[] {
  const groups=new Map<string,PageFlowReferral>()
  for(const row of report.rows) {
    const target=safePagePath(row.dimensionValues[0].value)
    let source:string | null
    try {const url=new URL(row.dimensionValues[1].value);if(!hosts.includes(url.hostname) || url.username || url.password || !['http:','https:'].includes(url.protocol))continue;source=safePagePath(url.pathname)}catch{continue}
    if(!source || !target || source===target || !visible.has(source) || !visible.has(target))continue
    const key=`${source}\0${target}`,m=values(report,row),old=groups.get(key)
    if(old){old.views+=m.screenPageViews;old.users=null;old.groups++}
    else groups.set(key,{id:createHash('sha256').update(key).digest('hex').slice(0,20),source,target,users:m.totalUsers,views:m.screenPageViews,groups:1})
  }
  return [...groups.values()]
}
export async function getPageFlow(q:PageFlowQueryInput):Promise<PageFlowReport | PageFlowTable | PageFlowDetail> {
  const context=await ga4Context(),hosts=siteHosts()
  const cacheKey=createHash('sha256').update(context.key+JSON.stringify({hosts,query:{...q,refresh:''}})).digest('hex')
  const cached=caches.get(cacheKey)
  if(q.refresh!=='1' && cached && cached.expires>Date.now())return {...cached.data as PageFlowReport,cached:true}
  if(pending.has(cacheKey))return pending.get(cacheKey)! as Promise<PageFlowReport | PageFlowTable | PageFlowDetail>
  const execute=(async()=>{
    const dims=['hostName','pagePath',...(q.device || q.mode==='detail'?['deviceCategory']:[]),...(q.source || q.mode==='detail'?['sessionSourceMedium']:[])]
    await validateGa4Report(context,[...new Set(dims)],METRICS)
    const overviewMetrics=['totalUsers','screenPageViews','sessions']
    let requests:Json[],definitions:{dimensions:string[];metrics:string[]}[]
    if(q.mode==='graph') {
      await validateGa4Report(context,[...new Set([...dims,'pageReferrer'])],['totalUsers','screenPageViews'])
      requests=[requestBody(q,hosts,[],overviewMetrics,1),requestBody({...q,sort:'users',direction:'desc'},hosts,['pagePath'],METRICS,q.graphLimit),requestBody({...q,sort:'views',direction:'desc'},hosts,['pagePath','pageReferrer'],['totalUsers','screenPageViews'],1000)]
      definitions=[{dimensions:[],metrics:overviewMetrics},{dimensions:['pagePath'],metrics:METRICS},{dimensions:['pagePath','pageReferrer'],metrics:['totalUsers','screenPageViews']}]
    }else if(q.mode==='detail') {
      requests=[requestBody(q,hosts,[],overviewMetrics,1),requestBody(q,hosts,['deviceCategory','sessionSourceMedium'],['totalUsers','screenPageViews'],q.limit,(q.page-1)*q.limit)]
      definitions=[{dimensions:[],metrics:overviewMetrics},{dimensions:['deviceCategory','sessionSourceMedium'],metrics:['totalUsers','screenPageViews']}]
    }else {
      requests=[requestBody(q,hosts,['pagePath'],METRICS,q.limit,(q.page-1)*q.limit)]
      definitions=[{dimensions:['pagePath'],metrics:METRICS}]
    }
    const raw=z.object({reports:z.array(z.unknown())}).safeParse(await ga4Request(context,'batchRunReports',{requests}))
    if(!raw.success || raw.data.reports.length!==definitions.length)throw new Ga4Error('GA4 did not return the complete requested reports.',503,'GA4_RESPONSE_INVALID')
    const reports=raw.data.reports.map((r,i)=>parseReport(r,definitions[i].dimensions,definitions[i].metrics))
    const common={notes:notes(reports),timeZone:reports[0].metadata.timeZone || 'Unknown',generatedAt:new Date().toISOString()}
    common.notes.push(`Website hostname filter: ${hosts.join(', ')}.`)
    let result:PageFlowReport | PageFlowTable | PageFlowDetail
    if(q.mode==='graph') {
      const list=pages(reports[1])
      result={...common,propertyId:context.propertyId,currency:reports[0].metadata.currencyCode || 'Unknown',summary:summary(reports[0]),pages:list,pageCount:reports[1].rowCount,
        referrals:pageReferrals(reports[2],hosts,new Set(list.map(p=>p.path))),referralRowCount:reports[2].rowCount,referralRowsLoaded:reports[2].rows.length,
        quotaRemaining:reports.at(-1)?.propertyQuota?.tokensPerHour?.remaining ?? null,cached:false}
      if(reports[1].rowCount>list.length)result.notes.push(`Canvas shows the top ${list.length} of ${reports[1].rowCount} reported pages. Search or use the complete paginated page list to find other pages.`)
      if(reports[2].rowCount>reports[2].rows.length)result.notes.push('Referrer connections are limited to the top 1,000 GA4 report rows and pages visible on the canvas.')
      if(!result.referrals.length && list.length)result.notes.push('No qualifying internal referring-page connections were returned. Page counts remain available; no connections were invented.')
    }else if(q.mode==='detail') {
      result={...common,path:q.path,summary:summary(reports[0]),breakdown:reports[1].rows.map(row=>{const m=values(reports[1],row);return {device:row.dimensionValues[0].value,source:row.dimensionValues[1].value,users:m.totalUsers,views:m.screenPageViews}}),total:reports[1].rowCount,page:q.page,limit:q.limit}
    }else result={...common,pages:pages(reports[0]),total:reports[0].rowCount,page:q.page,limit:q.limit}
    if(caches.size>=20)caches.delete(caches.keys().next().value!)
    caches.set(cacheKey,{data:result,expires:Date.now()+60000})
    return result
  })()
  pending.set(cacheKey,execute)
  try{return await execute}finally{pending.delete(cacheKey)}
}
