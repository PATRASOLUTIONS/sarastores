'use client'
import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import Link from 'next/link'
import { ArrowLeft,ArrowRight,BarChart3,CalendarDays,ChevronDown,Download,ExternalLink,FileText,Home,Info,Link2,Map,Maximize,Minus,Plus,RefreshCw,RotateCcw,Save,Scan,Search,Settings2,SlidersHorizontal,X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { ReactFlow,ReactFlowProvider,Background,BackgroundVariant,MiniMap,Handle,Position,BaseEdge,EdgeLabelRenderer,getBezierPath,useNodesState,useReactFlow,type Node,type NodeProps,type Edge,type EdgeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { apiFetch } from '@/lib/api-client'
import { csvCell } from '@/lib/customer-flow'
import { pageLabel,type PageFlowConnection,type PageFlowFilters,type PageFlowPage,type PageFlowReport,type PageFlowTable,type PageFlowDetail } from '@/lib/page-flow'
import '../customer-flow/customer-flow.css'
import './page-flow.css'

type PageNode=Node<{path:string;users:number;views:number;percentage:number;color:string;onSelect:(path:string)=>void},'pageCircle'>
type ReferralEdge=Edge<{users:number | null;views:number;groups:number},'referral'>
const fmt=new Intl.NumberFormat('en-IN')
const tone=(path:string)=>/^\/(product|cart|categor|brand)/.test(path)?'#8b5cf6':/^\/checkout/.test(path)?'#f59e0b':/^\/thank-you/.test(path)?'#10b981':'#3b82f6'
function PageCircle({data,selected}:NodeProps<PageNode>) {
  const Icon=data.path==='/'?Home:FileText
  return <div className={`flow-circle-wrap ${selected?'is-selected':''}`} style={{'--stage-color':data.color} as React.CSSProperties}>
    <span className="flow-node-count">{fmt.format(data.users)}</span><button className="flow-circle" onClick={e=>{if(e.detail===0)data.onSelect(data.path)}} aria-label={`${data.path}: ${data.users} GA4 users. View page details`}><Icon size={18} strokeWidth={1.7}/></button>
    <span className="flow-node-label flow-page-label" title={data.path}>{pageLabel(data.path)}</span><span className="flow-node-percent">{data.percentage.toFixed(1)}% · {fmt.format(data.views)} views</span>
    <Handle type="source" id="right" position={Position.Right}/><Handle type="target" id="left" position={Position.Left}/><Handle type="source" id="bottom" position={Position.Bottom}/><Handle type="target" id="top" position={Position.Top}/>
  </div>
}
function Referral({data,...props}:EdgeProps<ReferralEdge>) {
  const [hover,setHover]=useState(false),[path,x,y]=getBezierPath({...props,curvature:.3})
  return <g onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}><BaseEdge path={path} interactionWidth={20} style={{stroke:'#93b2df',strokeWidth:1+Math.min(2,Math.log10((data?.views || 0)+1)),opacity:.45}}/>{data?.views?<circle r={2} fill="#6095dc" className="flow-particle"><animateMotion dur="6s" repeatCount="indefinite" path={path}/></circle>:null}{(hover || props.selected) && <EdgeLabelRenderer><div className="flow-edge-label nodrag nopan" style={{transform:`translate(-50%,-50%) translate(${x}px,${y}px)`}}>{fmt.format(data?.views || 0)} views · {data?.users==null?'users unavailable':`${fmt.format(data.users)} users`}</div></EdgeLabelRenderer>}</g>
}
const nodeTypes={pageCircle:PageCircle},edgeTypes={referral:Referral}
interface ApiFailure extends Error {code?:string;missing?:string[]}
async function read<T>(query:Record<string,string | number>,signal?:AbortSignal):Promise<T> {
  const response=await apiFetch(`/api/admin/page-flow?${new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)]))}`,{signal})
  const result=await response.json()
  if(!response.ok){const failure=new Error(result.error || 'Unable to read GA4') as ApiFailure;failure.code=result.code;failure.missing=result.missing;throw failure}
  return result as T
}
const defaults:PageFlowFilters={preset:'Last 7 Days',startDate:'',endDate:'',device:'',source:'',search:'',graphLimit:30}
const stamp=(s:string)=>new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})
const tableColumns:[keyof PageFlowPage,string][]=[['path','Page'],['users','GA4 users'],['views','Page views'],['sessions','Sessions'],['engagementRate','Engagement']]
function field(row:PageFlowPage,key:keyof PageFlowPage){return key==='path'?row.path:key==='engagementRate'?`${(row.engagementRate*100).toFixed(1)}%`:fmt.format(row[key])}
function Canvas() {
  const root=useRef<HTMLDivElement>(null),abortExport=useRef<AbortController | null>(null)
  const [filters,setFilters]=useState(defaults),[draftSearch,setDraftSearch]=useState(''),[sourceDraft,setSourceDraft]=useState('')
  const [connection,setConnection]=useState<PageFlowConnection | null>(null),[report,setReport]=useState<PageFlowReport | null>(null)
  const [error,setError]=useState<ApiFailure | null>(null),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0)
  const [setup,setSetup]=useState(false),[coverage,setCoverage]=useState(false),[advanced,setAdvanced]=useState(false),[mini,setMini]=useState(true)
  const [selected,setSelected]=useState(''),[detail,setDetail]=useState<PageFlowDetail | null>(null),[detailPage,setDetailPage]=useState(1),[detailError,setDetailError]=useState('')
  const [tableOpen,setTableOpen]=useState(false),[table,setTable]=useState<PageFlowTable | null>(null),[tablePage,setTablePage]=useState(1),[tableError,setTableError]=useState(''),[tableLoading,setTableLoading]=useState(false)
  const [sort,setSort]=useState('users'),[direction,setDirection]=useState('desc'),[notice,setNotice]=useState(''),[exporting,setExporting]=useState(false)
  const {fitView,zoomIn,zoomOut,getNodes,getViewport,setViewport}=useReactFlow<PageNode,ReferralEdge>()
  const [nodes,setNodes,onNodesChange]=useNodesState<PageNode>([])
  const choose=useCallback((path:string)=>{setSelected(path);setDetailPage(1)},[])
  useEffect(()=>{const t=setTimeout(()=>setFilters(f=>({...f,search:draftSearch})),350);return ()=>clearTimeout(t)},[draftSearch])
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError(null);setReport(null)
    read<PageFlowConnection>({mode:'status'},controller.signal).then(setConnection).catch(()=>{if(!controller.signal.aborted)setConnection(null)})
    read<PageFlowReport>({...filters,mode:'graph',refresh:refresh?'1':''},controller.signal).then(setReport).catch(e=>{if(!controller.signal.aborted)setError(e)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[filters,refresh])
  useEffect(()=>{
    if(!report){setNodes([]);return}
    let saved:Record<string,{x:number;y:number}>={},viewport:{x:number;y:number;zoom:number} | undefined
    try{const value=JSON.parse(localStorage.getItem('sara.page-flow.layout.v1') || '{}');saved=value.nodes || {};viewport=value.viewport}catch{}
    const columns=Math.max(2,Math.min(6,Math.ceil(Math.sqrt(report.pages.length*1.3))))
    setNodes(report.pages.map((p,i)=>({id:p.path,type:'pageCircle',position:saved[p.path] && Number.isFinite(saved[p.path].x) && Number.isFinite(saved[p.path].y) && Math.abs(saved[p.path].x)<100000 && Math.abs(saved[p.path].y)<100000?saved[p.path]:{x:i%columns*230,y:Math.floor(i/columns)*175},data:{...p,percentage:report.summary.users?p.users/report.summary.users*100:0,color:tone(p.path),onSelect:choose}})))
    setTimeout(()=>{if(viewport && [viewport.x,viewport.y,viewport.zoom].every(Number.isFinite) && viewport.zoom>=.12 && viewport.zoom<=2.5)setViewport(viewport);else fitView({padding:.18,duration:300})},100)
  },[report,setNodes,choose,fitView,setViewport])
  useEffect(()=>setNodes(current=>current.map(n=>({...n,selected:n.id===selected}))),[selected,setNodes])
  useEffect(()=>{setTablePage(1);setSelected('')},[filters])
  useEffect(()=>{
    if(!tableOpen)return
    const controller=new AbortController();setTable(null);setTableError('');setTableLoading(true)
    read<PageFlowTable>({...filters,mode:'pages',page:tablePage,limit:25,sort,direction,refresh:refresh?'1':''},controller.signal).then(setTable).catch(e=>{if(!controller.signal.aborted)setTableError(e.message)}).finally(()=>{if(!controller.signal.aborted)setTableLoading(false)})
    return ()=>controller.abort()
  },[tableOpen,tablePage,filters,sort,direction,refresh])
  useEffect(()=>{
    if(!selected)return
    const controller=new AbortController();setDetail(null);setDetailError('')
    read<PageFlowDetail>({...filters,mode:'detail',path:selected,page:detailPage,limit:25,refresh:refresh?'1':''},controller.signal).then(setDetail).catch(e=>{if(!controller.signal.aborted)setDetailError(e.message)})
    return ()=>controller.abort()
  },[selected,filters,detailPage,refresh])
  useEffect(()=>()=>abortExport.current?.abort(),[])
  const edges=useMemo<ReferralEdge[]>(()=>report?.referrals.map(e=>({id:e.id,source:e.source,target:e.target,type:'referral',data:e,sourceHandle:'right',targetHandle:'left'})) || [],[report])
  const update=(key:keyof PageFlowFilters,value:string | number)=>setFilters(f=>({...f,[key]:value}))
  const download=(url:string,name:string)=>{const a=document.createElement('a');a.href=url;a.download=name;a.click()}
  async function csv() {
    if(exporting)return
    const controller=new AbortController();abortExport.current=controller;setExporting(true);setNotice('Preparing page report export…')
    try {
      const lines=[tableColumns.map(([,label])=>csvCell(label)).join(',')];let total=0
      for(let page=1;;page++) {
        const batch=await read<PageFlowTable>({...filters,mode:'pages',page,limit:100,sort,direction},controller.signal)
        if(page===1)total=batch.total
        if(batch.total!==total)throw new Error('GA4 report changed during export. Refresh and retry.')
        if(batch.pages.length<Math.min(100,total-(page-1)*100))throw new Error('Some page URLs cannot be exported safely. Narrow the filters before exporting; no partial file was downloaded.')
        batch.pages.forEach(p=>lines.push(tableColumns.map(([key])=>csvCell(field(p,key))).join(',')))
        if(page*100>=total)break
        if(!batch.pages.length)throw new Error('Some GA4 rows could not be exported safely. No partial file was downloaded.')
        setNotice(`Exporting ${Math.min(page*100,total)} of ${total} pages…`)
      }
      const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));download(url,'sara-ga4-page-flow.csv');setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`Exported ${total} reported pages.`)
    }catch(e){setNotice(controller.signal.aborted?'Export cancelled.':(e as Error).message)}finally{setExporting(false);abortExport.current=null}
  }
  async function graphExport(type:'png'|'svg') {
    const element=root.current?.querySelector<HTMLElement>('.react-flow__viewport');if(!element || !nodes.length)return
    try {
      setNotice('Preparing graph export…')
      const {toPng,toSvg}=await import('html-to-image'),all=getNodes(),minX=Math.min(...all.map(n=>n.position.x))-120,minY=Math.min(...all.map(n=>n.position.y))-100
      const width=Math.max(...all.map(n=>n.position.x))+230-minX,height=Math.max(...all.map(n=>n.position.y))+160-minY
      const url=await(type==='png'?toPng:toSvg)(element,{backgroundColor:'white',width,height,pixelRatio:2,style:{width:`${width}px`,height:`${height}px`,transform:`translate(${-minX}px,${-minY}px) scale(1)`}})
      download(url,`sara-ga4-page-flow.${type}`);setNotice('Graph exported.')
    }catch{setNotice('Graph export failed. Retry after fonts and pages finish loading.')}
  }
  function layout(save:boolean) {
    try {
      if(save){localStorage.setItem('sara.page-flow.layout.v1',JSON.stringify({nodes:Object.fromEntries(getNodes().map(n=>[n.id,n.position])),viewport:getViewport()}));setNotice('Page layout saved on this device.')}
      else{localStorage.removeItem('sara.page-flow.layout.v1');const cols=Math.max(2,Math.min(6,Math.ceil(Math.sqrt(nodes.length*1.3))));setNodes(current=>current.map((n,i)=>({...n,position:{x:i%cols*230,y:Math.floor(i/cols)*175}})));setTimeout(()=>fitView({padding:.18,duration:300}),50);setNotice('Page layout reset; counts preserved.')}
    }catch{setNotice('Browser storage is unavailable.')}
  }
  const gaUrl=connection?.propertyId?`https://analytics.google.com/analytics/web/#/p${connection.propertyId}`:'https://analytics.google.com/'
  return <div ref={root} className="customer-flow-app page-flow-app" style={{zIndex:60}}>
    <header className="flow-header"><div className="flow-brand"><Link href="/admin/dashboard" aria-label="Back to admin"><ArrowLeft size={18}/></Link><span className="flow-brand-mark"><BarChart3 size={20}/></span><div><h1>Page Flow</h1><p>SARA STORES <span>·</span> Google Analytics 4</p></div></div><div className="flow-header-actions"><Link className="page-flow-switch" href="/admin/customer-flow">Customer Flow<ArrowRight size={14}/></Link><span className="flow-live"><i style={{background:report?'#10b981':'#94a3b8'}}/>{report?'GA4 connected':loading?'Checking GA4…':'GA4 unavailable'}</span><button title="Refresh GA4 report" aria-label="Refresh GA4 report" onClick={()=>setRefresh(r=>r+1)}><RefreshCw size={17}/></button><button title="Full screen" aria-label="Full screen" onClick={()=>{(document.fullscreenElement?document.exitFullscreen():root.current?.requestFullscreen())?.catch(()=>setNotice('Full screen is unavailable.'))}}><Maximize size={17}/></button><button onClick={()=>setSetup(true)}><Settings2 size={16}/><span>Connection</span></button></div></header>
    <div className="flow-filterbar"><div className="flow-date"><CalendarDays size={16}/><select aria-label="Date range" value={filters.preset} onChange={e=>update('preset',e.target.value)}>{['Today','Yesterday','Last 7 Days','Last 30 Days','Last 90 Days','Custom'].map(p=><option key={p}>{p}</option>)}</select></div>{filters.preset==='Custom' && <><input type="date" aria-label="Start date" value={filters.startDate} onChange={e=>update('startDate',e.target.value)}/><input type="date" aria-label="End date" value={filters.endDate} onChange={e=>update('endDate',e.target.value)}/></>}
      <select aria-label="Device" value={filters.device} onChange={e=>update('device',e.target.value)}><option value="">All devices</option>{['desktop','mobile','tablet'].map(d=><option key={d}>{d}</option>)}</select><select aria-label="Pages on canvas" value={filters.graphLimit} onChange={e=>update('graphLimit',Number(e.target.value))}>{[30,60,100].map(n=><option key={n} value={n}>Top {n} pages</option>)}</select><button onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={15}/>Filters</button><label className="flow-search"><Search size={15}/><input aria-label="Search pages" placeholder="Find a page, e.g. /products" value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}/></label><button onClick={()=>{setTableOpen(true);setTablePage(1)}} disabled={!report}><FileText size={15}/>Page list</button>
    </div>
    {advanced && <form className="flow-advanced" onSubmit={e=>{e.preventDefault();update('source',sourceDraft)}}><label>Traffic source / medium<input value={sourceDraft} onChange={e=>setSourceDraft(e.target.value)} placeholder="e.g. google / organic" aria-label="Traffic source / medium"/></label><button type="submit">Apply source</button><button type="button" onClick={()=>{setSourceDraft('');setDraftSearch('');setFilters(f=>({...f,source:'',device:'',search:''}))}}>Clear filters</button></form>}
    <main className="flow-canvas" aria-label="Google Analytics page flow canvas"><ReactFlow<PageNode,ReferralEdge> nodes={nodes} edges={edges} onNodesChange={onNodesChange} onNodeClick={(_,node)=>choose(node.data.path)} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={.12} maxZoom={2.5} nodesConnectable={false} deleteKeyCode={null} proOptions={{hideAttribution:true}}><Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce2ea"/>{mini && nodes.length>0 && <MiniMap pannable zoomable nodeColor={n=>String(n.data.color)} nodeBorderRadius={100} position="bottom-right"/>}</ReactFlow>
      <div className="flow-canvas-heading"><span>PAGE VISITORS</span><p>{report?`${fmt.format(report.summary.users)} GA4 users · ${fmt.format(report.summary.views)} page views`:loading?'Checking the Google Analytics connection…':'Google Analytics data is unavailable'}</p><small>{report?`${report.pages.length} of ${report.pageCount} pages · ${report.timeZone} · Updated ${stamp(report.generatedAt)}${report.cached?' (cached)':''}`:'A missing connection is not zero visitors.'}</small></div>
      {error && <div className="page-flow-empty" role="alert"><span className="page-flow-empty-icon"><BarChart3 size={26}/></span><h2>{error.code==='GA4_NOT_CONFIGURED'?'Connect Google Analytics':error.code==='GA4_ACCESS_DENIED'?'Google Analytics access needed':['GA4_SCOPE_MISSING','GA4_REAUTHORIZE_REQUIRED'].includes(error.code || '')?'Authorize GA4 reporting':'GA4 report unavailable'}</h2><p>{error.message}</p><p>Page counts will appear above the circles once the property can be read. No demo statistics are shown.</p><div><button onClick={()=>setSetup(true)}><Link2 size={16}/>Connection setup</button><button onClick={()=>setRefresh(r=>r+1)}><RefreshCw size={15}/>Retry</button></div></div>}
      {!loading && !error && report && !nodes.length && <div className="page-flow-empty"><BarChart3 size={25}/><h2>No page data returned</h2><p>GA4 returned no matching public pages for these dates and filters. Check the date range, website hostname and GA4 tracking.</p><button onClick={()=>setSetup(true)}>Review connection</button></div>}
      {report && <button className="page-flow-quality" onClick={()=>setCoverage(true)}><Info size={14}/>Reported referrers · Data coverage</button>}
      <div className="flow-controls"><button aria-label="Zoom in" onClick={()=>zoomIn({duration:150})}><Plus size={17}/></button><button aria-label="Zoom out" onClick={()=>zoomOut({duration:150})}><Minus size={17}/></button><button aria-label="Fit to screen" onClick={()=>fitView({padding:.18,duration:300})}><Scan size={17}/></button><button aria-label="Toggle mini map" onClick={()=>setMini(v=>!v)}><Map size={17}/></button><span/><button aria-label="Save graph layout" disabled={!nodes.length} onClick={()=>layout(true)}><Save size={17}/></button><button aria-label="Reset graph layout" disabled={!nodes.length} onClick={()=>layout(false)}><RotateCcw size={17}/></button><button disabled={!nodes.length} onClick={()=>graphExport('png')}>PNG</button><button disabled={!nodes.length} onClick={()=>graphExport('svg')}>SVG</button></div>
    </main>
    {notice && <div className="flow-notice" role="status">{notice}<button onClick={()=>exporting?abortExport.current?.abort():setNotice('')}>{exporting?'Cancel':<X size={14}/>}</button></div>}
    <Dialog.Root open={setup || coverage} onOpenChange={open=>{if(!open){setSetup(false);setCoverage(false)}}}><Dialog.Portal container={root.current}><Dialog.Overlay className="flow-profile-overlay"/><Dialog.Content className="flow-profile"><div className="flow-profile-header"><div><p>GOOGLE ANALYTICS</p><Dialog.Title>{setup?'Connection setup':'Data coverage'}</Dialog.Title></div><Dialog.Close aria-label="Close GA4 information"><X size={20}/></Dialog.Close></div><Dialog.Description>{setup?'Use a dedicated read-only GA4 reporting connection.':'Understand what the page counts and connections represent.'}</Dialog.Description>
      {setup?<div className="page-flow-setup"><div className="page-flow-connection-state"><strong>{connection?.configured?'Credentials configured; report access is checked on refresh':'Reporting connection not configured'}</strong><p>Property: {connection?.propertyId || 'not configured'}</p><p>Authentication: {connection?.authType==='service-account'?'Service account':'Dedicated reporting OAuth'}</p></div><ol><li><strong>Choose the numeric GA4 Property ID</strong><p>Google Analytics → Admin → Property details. A G- Measurement ID identifies the tracking tag and cannot read reports.</p></li><li><strong>Grant read-only property access</strong><p>Enable the Google Analytics Data API in the credential’s Cloud project and grant its user or service account Viewer access to this property.</p></li><li><strong>Configure the private server connection</strong><p>Use a dedicated service-account file outside the project/OneDrive, or dedicated OAuth reporting credentials with analytics.readonly permission. Keep keys and tokens out of chat and the browser.</p><code>GOOGLE_GA4_PROPERTY_ID</code><code>GOOGLE_GA4_CREDENTIALS_FILE</code><p>OAuth alternative:</p><p>Authorize <code>https://www.googleapis.com/auth/analytics.readonly</code> with a Google account that can view this property. A refresh token with only email/login permission cannot read Analytics reports.</p><a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer">Open Google OAuth Playground<ExternalLink size={14}/></a><p>In Playground settings, use your own reporting OAuth client credentials privately. Authorize the scope above, exchange the code, and save the new refresh token as GOOGLE_GA4_REFRESH_TOKEN on the server. Keep the new token out of chat.</p>{['GOOGLE_GA4_CLIENT_ID','GOOGLE_GA4_CLIENT_SECRET','GOOGLE_GA4_REFRESH_TOKEN'].map(name=><code key={name}>{name}</code>)}<p>If the app runs locally or on a preview domain, set the public website hostname separately:</p><code>GOOGLE_GA4_HOSTNAME</code></li><li><strong>Refresh the report</strong><p>Reporting access does not install tracking. GA4 must already receive consented page_view events from your Google tag or GTM container. Older unrecorded visits cannot be recovered.</p></li></ol>{connection?.missing.length?<p className="page-flow-missing">Missing: {connection.missing.join(', ')}</p>:null}<a href={gaUrl} target="_blank" rel="noopener noreferrer">Open Google Analytics<ExternalLink size={14}/></a><button onClick={()=>{setSetup(false);setRefresh(r=>r+1)}}><RefreshCw size={15}/>Check connection again</button></div>:<div className="page-flow-notes">{report?.notes.map(n=><p key={n}>{n}</p>)}{report && <p>{report.referralRowsLoaded} of {report.referralRowCount} reported referrer rows inspected. {report.quotaRemaining==null?'Quota information was not returned.':`${report.quotaRemaining} hourly property tokens remaining.`}</p>}<a href={gaUrl} target="_blank" rel="noopener noreferrer">Use GA4 Explore for path analysis<ExternalLink size={14}/></a></div>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={tableOpen} onOpenChange={setTableOpen}><Dialog.Portal container={root.current}><Dialog.Overlay className="flow-drawer-overlay"/><Dialog.Content className="flow-drawer"><div className="flow-drawer-title"><div><p>GOOGLE ANALYTICS PAGE REPORT</p><Dialog.Title>Pages <span>{table?fmt.format(table.total):'…'}</span></Dialog.Title><Dialog.Description>Anonymous GA4 users per page. Click a page for device and traffic-source details.</Dialog.Description></div><div><button disabled={!table || exporting} onClick={csv}><Download size={15}/>Export CSV</button><Dialog.Close aria-label="Close page list"><X size={18}/></Dialog.Close></div></div><div className="flow-table-tools"><label><Search size={15}/><input value={draftSearch} onChange={e=>setDraftSearch(e.target.value)} placeholder="Search reported pages…" aria-label="Search page list"/></label><small>User counts overlap between pages. Do not add them together.</small></div>{tableError && <p role="alert" className="flow-error">{tableError}</p>}<div className="flow-table-scroll" aria-busy={tableLoading}><table><thead><tr>{tableColumns.map(([key,label])=><th key={key}><button onClick={()=>{setSort(key);setDirection(sort===key && direction==='desc'?'asc':'desc');setTablePage(1)}}>{label}{sort===key && <ChevronDown size={12}/>}</button></th>)}</tr></thead><tbody>{tableLoading?<tr><td colSpan={5} className="flow-table-empty">Reading GA4 page data…</td></tr>:table?.pages.length?table.pages.map(p=><tr key={p.path} onClick={()=>choose(p.path)}>{tableColumns.map(([key])=><td key={key}>{key==='path'?<button className="page-flow-path" onClick={e=>{e.stopPropagation();choose(p.path)}}>{p.path}</button>:field(p,key)}</td>)}</tr>):<tr><td colSpan={5} className="flow-table-empty">{tableError?'Report unavailable.':'No matching pages reported.'}</td></tr>}</tbody></table></div><footer className="flow-table-pagination"><span>{table?.total?`${(tablePage-1)*25+1}–${Math.min(tablePage*25,table.total)} of ${table.total} pages`:'No pages'}</span><div><button disabled={tablePage===1 || tableLoading} onClick={()=>setTablePage(p=>p-1)}>Previous</button><span>Page {tablePage}</span><button disabled={!table || tablePage*25>=table.total || tableLoading} onClick={()=>setTablePage(p=>p+1)}>Next</button></div></footer></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!selected} onOpenChange={open=>{if(!open)setSelected('')}}><Dialog.Portal container={root.current}><Dialog.Overlay className="flow-profile-overlay"/><Dialog.Content className="flow-profile"><div className="flow-profile-header"><div><p>PAGE VISITOR DETAILS</p><Dialog.Title>{pageLabel(selected)}</Dialog.Title></div><Dialog.Close aria-label="Close page details"><X size={20}/></Dialog.Close></div><Dialog.Description>{selected} · Anonymous GA4 aggregates for the selected range.</Dialog.Description>{detailError?<p role="alert" className="flow-error">{detailError}</p>:!detail?<p>Reading GA4 page details…</p>:<><div className="page-flow-detail-metrics"><div><strong>{fmt.format(detail.summary.users)}</strong><span>GA4 users</span></div><div><strong>{fmt.format(detail.summary.views)}</strong><span>Page views</span></div><div><strong>{fmt.format(detail.summary.sessions)}</strong><span>Sessions</span></div></div><h3>Device & traffic source</h3><p className="page-flow-subtle">Users may belong to more than one source/device group. These rows cannot identify named customers.</p><div className="page-flow-breakdown"><table><thead><tr><th>Device</th><th>Source / medium</th><th>Users</th><th>Views</th></tr></thead><tbody>{detail.breakdown.map((b,i)=><tr key={`${b.device}-${b.source}-${i}`}><td>{b.device}</td><td>{b.source}</td><td>{fmt.format(b.users)}</td><td>{fmt.format(b.views)}</td></tr>)}</tbody></table></div><div className="flow-detail-pages"><button disabled={detailPage===1} onClick={()=>setDetailPage(p=>p-1)}>Previous</button><span>Page {detailPage}</span><button disabled={detailPage*25>=detail.total} onClick={()=>setDetailPage(p=>p+1)}>Next</button></div><p className="page-flow-subtle">Property timezone: {detail.timeZone}. Updated {stamp(detail.generatedAt)}.</p></>}</Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
export default function PageFlowCanvas(){return <ReactFlowProvider><Canvas/></ReactFlowProvider>}
