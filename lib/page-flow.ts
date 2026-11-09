/** Public GA4 aggregate contract. No account names, emails or identifiers. */
export interface PageFlowFilters { preset:string; startDate:string; endDate:string; device:string; source:string; search:string; graphLimit:number }
export interface PageFlowConnection { configured:boolean; propertyId:string | null; authType:string; missing:string[]; measurementId:string | null }
export interface PageFlowPage { path:string; users:number; views:number; sessions:number; engagementRate:number }
export interface PageFlowReferral { id:string; source:string; target:string; users:number | null; views:number; groups:number }
export interface PageFlowReport {
  propertyId:string; timeZone:string; currency:string; generatedAt:string;
  summary:{ users:number; views:number; sessions:number }; pages:PageFlowPage[]; pageCount:number;
  referrals:PageFlowReferral[]; referralRowCount:number; referralRowsLoaded:number; notes:string[];
  quotaRemaining:number | null; cached:boolean;
}
export interface PageFlowTable { pages:PageFlowPage[]; total:number; page:number; limit:number; notes:string[]; timeZone:string; generatedAt:string }
export interface PageFlowDetail {
  path:string; summary:{users:number;views:number;sessions:number};
  breakdown:{device:string;source:string;users:number;views:number}[]; total:number; page:number; limit:number;
  timeZone:string; notes:string[]; generatedAt:string;
}
export function pageLabel(path:string):string {
  if(path==='/')return 'Home'
  if(path==='(not set)')return 'Unspecified page'
  const parts=path.split('/').filter(Boolean)
  return parts.length<=1 ? (parts[0] || path).replaceAll('-',' ') : parts.at(-1)!.replaceAll('-',' ')
}
export function safePagePath(raw:string):string | null {
  if(raw==='(not set)')return raw
  if(!raw.startsWith('/') || raw.startsWith('//') || raw.length>500 || /[\u0000-\u001f\u007f\\]/.test(raw))return null
  const path=raw.split(/[?#]/,1)[0]
  let decoded:string
  try {decoded=decodeURIComponent(path)}catch{return null}
  if(/^\/(?:admin|api|account|dashboard|vendor|orders?|users?|customers?)(?:\/|$)/i.test(decoded) || decoded.includes('@') || /[\u0000-\u001f\u007f\\]/.test(decoded))return null
  return path || '/'
}
