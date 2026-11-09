'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Globe,UserRound,UserCheck,Search,Package,ShoppingCart,LogIn,Check,ShoppingBag,MapPin,CreditCard,CheckCheck,X,Clock,Receipt,PackageCheck,Truck,CircleCheck,LogOut,PackageX,LockKeyhole,RotateCcw,Ban,Undo2,Wallet,ArrowLeft,ArrowRight,Waypoints,RefreshCw,Maximize,Info,CalendarDays,SlidersHorizontal,Plus,Minus,Scan,Map,Save,Download,ChevronDown,ChevronsUpDown,Circle as CircleIcon,type LucideIcon } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath, useNodesState, useReactFlow, type Node, type NodeProps, type Edge, type EdgeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { apiFetch } from '@/lib/api-client'
import { FLOW_STAGES, FLOW_LINKS, FLOW_COLORS, csvCell, type StageId, type FlowFilters, type FlowGraph, type FlowTable, type FlowCustomer, type FlowDetail } from '@/lib/customer-flow'
import './customer-flow.css'

type CircleData = { label:string; icon:string; color:string; count:number | null; percentage:number; onSelect:(id:StageId)=>void }
const Icons = { Globe,UserRound,UserCheck,Search,Package,ShoppingCart,LogIn,Check,ShoppingBag,MapPin,CreditCard,CheckCheck,X,Clock,Receipt,PackageCheck,Truck,CircleCheck,LogOut,PackageX,LockKeyhole,RotateCcw,Ban,Undo2,Wallet,ArrowLeft,ArrowRight,Waypoints,RefreshCw,Maximize,Info,CalendarDays,SlidersHorizontal,Plus,Minus,Scan,Map,Save,Download,ChevronDown,ChevronsUpDown,Circle:CircleIcon }
type Circle = Node<CircleData,'circle'>
type FlowEdge = Edge<{ volume:number; loaded:boolean; color:string },'chain'>
const format = new Intl.NumberFormat('en-IN')
const money = (n:number | null) => n == null ? '—' : new Intl.NumberFormat('en-IN',{ style:'currency',currency:'INR',maximumFractionDigits:0 }).format(n)
const stamp = (s:string | null) => s ? new Date(s).toLocaleString('en-IN',{ dateStyle:'medium',timeStyle:'short' }) : '—'
const stageName = (id:string) => FLOW_STAGES.find(s=>s[0]===id)?.[1] || id
function CircleNode({ id,data,selected }:NodeProps<Circle>) {
  const Icon = (Icons as Record<string,LucideIcon>)[data.icon] || Icons.Circle
  return <div className={`flow-circle-wrap ${selected ? 'is-selected' : ''}`} style={{ '--stage-color':data.color } as React.CSSProperties}>
    <span className="flow-node-count">{data.count == null ? '—' : format.format(data.count)}</span>
    <button className="flow-circle" onClick={event=>{if(event.detail===0)data.onSelect(id as StageId)}} aria-label={`${data.label}: ${data.count == null ? 'loading' : data.count} customers. Open customer table`}><Icon size={18} strokeWidth={1.7}/></button>
    <span className="flow-node-label">{data.label}</span><span className="flow-node-percent">{data.count == null ? '—' : `${data.percentage.toFixed(1)}%`}</span>
    <Handle id="left-in" type="target" position={Position.Left}/><Handle id="right-in" type="target" position={Position.Right}/>
    <Handle id="left-out" type="source" position={Position.Left}/><Handle id="right-out" type="source" position={Position.Right}/>
    <Handle id="top-in" type="target" position={Position.Top}/><Handle id="bottom-in" type="target" position={Position.Bottom}/>
    <Handle id="top-out" type="source" position={Position.Top}/><Handle id="bottom-out" type="source" position={Position.Bottom}/>
  </div>
}
function ChainEdge(props:EdgeProps<FlowEdge>) {
  const [hover,setHover] = useState(false)
  const [path,x,y] = getBezierPath({ ...props,curvature:0.35 })
  const count = props.data?.volume || 0, color = props.data?.color || '#94a3b8'
  return <g onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
    <BaseEdge path={path} interactionWidth={22} style={{ stroke:color,strokeWidth:count ? 1+Math.min(3,Math.log10(count+1)) : 1,opacity:count ? 0.65 : 0.2 }} />
    {count > 0 && <circle r="2" fill={color} className="flow-particle"><animateMotion dur="5s" repeatCount="indefinite" path={path}/></circle>}
    {(hover || props.selected) && <EdgeLabelRenderer><div className="flow-edge-label nodrag nopan" style={{ transform:`translate(-50%,-50%) translate(${x}px,${y}px)` }}>{props.data?.loaded ? `${format.format(count)} customers` : 'Loading…'}</div></EdgeLabelRenderer>}
  </g>
}
const nodeTypes = { circle:CircleNode }, edgeTypes = { chain:ChainEdge }
// Compact two-row journey with outer exception lanes; circles remain readable when fitted.
const compactLayout: Record<string,[number,number]> = {
  visitor:[0,0],guest:[180,-70],registered:[180,70],browse:[360,0],product:[540,0],cart:[720,0],
  login:[900,-70],guest_checkout:[900,70],cart_confirmed:[1080,0],checkout:[1080,180],
  address:[900,180],payment:[720,180],payment_success:[540,180],order:[360,180],processing:[180,180],shipped:[0,180],
  out_for_delivery:[0,360],delivered:[180,360],visitor_exited:[0,-170],product_abandoned:[540,-170],
  cart_abandoned:[720,360],login_failed:[900,-240],checkout_abandoned:[1080,360],payment_failed:[720,-170],
  payment_retried:[1080,-170],payment_pending:[540,360],cancelled:[360,360],delivery_failed:[-180,360],returned:[180,540],refunded:[360,540],
}
const columns: [keyof FlowCustomer,string][] = [['name','Customer Name'],['email','Email'],['phone','Phone'],['id','Customer ID'],['kind','Guest / Registered'],['lastActivity','Last Activity'],['currentStage','Current Journey Stage'],['productsViewed','Products Viewed'],['cartValue','Cart Value'],['orderId','Order ID'],['orderAmount','Order Amount'],['paymentStatus','Payment Status'],['orderStatus','Order Status'],['device','Device'],['trafficSource','Traffic Source'],['firstVisit','First Visit']]
function cell(row:FlowCustomer,key:keyof FlowCustomer) {
  if (key === 'cartValue' || key === 'orderAmount') return money(row[key])
  if (key === 'lastActivity' || key === 'firstVisit') return stamp(row[key])
  if (key === 'currentStage') return stageName(row[key])
  return row[key] == null || row[key] === '' ? '—' : String(row[key])
}
function dateRange(preset:string) {
  // The business date is IST regardless of the admin browser's timezone.
  const now = Date.now(), date = new Date(now+19800000).toISOString().slice(0,10)
  const midnight = +new Date(`${date}T00:00:00+05:30`)
  const end = preset === 'Yesterday' ? midnight : now+1000
  const start = preset === 'Yesterday' ? midnight-86400000 : midnight-(preset === 'Today' ? 0 : (Number(preset.match(/\d+/)?.[0] || 7)-1)*86400000)
  return { start:new Date(start).toISOString(),end:new Date(end).toISOString() }
}
async function request<T>(params:Record<string,string | number>, signal?:AbortSignal):Promise<T> {
  const response = await apiFetch(`/api/admin/customer-flow?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}`,{ signal })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Unable to load customer data')
  return result as T
}
function Canvas() {
  const [preset,setPreset] = useState('Last 7 Days')
  const [filters,setFilters] = useState<FlowFilters>(()=>({ ...dateRange('Last 7 Days'),kind:'',device:'',source:'',gateway:'',product:'',orderStatus:'' }))
  const [advanced,setAdvanced] = useState(false), [coverage,setCoverage] = useState(false)
  const [graph,setGraph] = useState<FlowGraph | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState('')
  const [refresh,setRefresh] = useState(0), [selected,setSelected] = useState<StageId | null>(null)
  const [search,setSearch] = useState(''), [query,setQuery] = useState(''), [page,setPage] = useState(1)
  const [sort,setSort] = useState<keyof FlowCustomer>('lastActivity'), [direction,setDirection] = useState('desc')
  const [table,setTable] = useState<FlowTable | null>(null), [tableLoading,setTableLoading] = useState(false), [tableError,setTableError] = useState('')
  const [detailId,setDetailId] = useState(''), [detail,setDetail] = useState<FlowDetail | null>(null), [detailPage,setDetailPage] = useState(1), [detailError,setDetailError] = useState('')
  const [mini,setMini] = useState(true), [notice,setNotice] = useState(''), [exporting,setExporting] = useState(false)
  const root = useRef<HTMLDivElement>(null), exportAbort = useRef<AbortController | null>(null)
  const { fitView,zoomIn,zoomOut,getNodes,getViewport,setViewport } = useReactFlow<Circle,FlowEdge>()
  const select = useCallback((id:StageId)=>{ setSelected(id);setPage(1);setDetailId('') },[])
  const initial = useMemo(()=>FLOW_STAGES.map(([id,label,tone,x,y,icon])=>({ id,type:'circle' as const,position:{ x:compactLayout[id]?.[0] ?? x,y:compactLayout[id]?.[1] ?? y },data:{ label,icon,color:FLOW_COLORS[tone],count:null,percentage:0,onSelect:select } })),[select])
  const [nodes,setNodes,onNodesChange] = useNodesState<Circle>(initial)
  useEffect(()=>{ const t=setTimeout(()=>{setQuery(search);setPage(1)},300);return ()=>clearTimeout(t) },[search])
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setGraph(null)
    request<FlowGraph>({ ...filters,mode:'graph' },controller.signal).then(setGraph).catch(e=>{if (!controller.signal.aborted)setError(e.message)}).finally(()=>{if (!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[filters,refresh])
  useEffect(()=>{ setNodes(current=>current.map(node=>({ ...node,selected:node.id===selected,data:{ ...node.data,count:graph ? graph.counts[node.id] || 0 : null,percentage:graph?.total ? 100*(graph.counts[node.id] || 0)/graph.total : 0 } }))) },[graph,selected,setNodes])
  useEffect(()=>{setPage(1);setDetailId('')},[filters])
  useEffect(()=>{
    if (!selected) return
    const controller=new AbortController();setTableLoading(true);setTableError('');setTable(null)
    request<FlowTable>({ ...filters,mode:'table',stage:selected,search:query,page,limit:25,sort,direction },controller.signal).then(setTable).catch(e=>{if(!controller.signal.aborted)setTableError(e.message)}).finally(()=>{if(!controller.signal.aborted)setTableLoading(false)})
    return ()=>controller.abort()
  },[selected,filters,query,page,sort,direction,refresh])
  useEffect(()=>{
    if(!detailId)return
    const controller=new AbortController();setDetail(null);setDetailError('')
    request<FlowDetail>({ ...filters,mode:'detail',id:detailId,page:detailPage,limit:100 },controller.signal).then(setDetail).catch(e=>{if(!controller.signal.aborted)setDetailError(e.message)})
    return ()=>controller.abort()
  },[detailId,detailPage,filters,refresh])
  useEffect(()=>{try {
    const saved=JSON.parse(localStorage.getItem('sara.customer-flow.layout.v1') || 'null')
    if(saved?.nodes) setNodes(current=>current.map(n=>{const p=saved.nodes[n.id];return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x)<100000 && Math.abs(p.y)<100000 ? {...n,position:p} : n}))
    if(saved?.viewport && ['x','y','zoom'].every(k=>Number.isFinite(saved.viewport[k])) && saved.viewport.zoom>=0.15 && saved.viewport.zoom<=2)setViewport(saved.viewport)
  } catch {setNotice('Saved layout could not be restored.')} },[setNodes,setViewport])
  useEffect(()=>()=>exportAbort.current?.abort(),[])
  const edges = useMemo<FlowEdge[]>(()=>FLOW_LINKS.map(([source,target])=>{
    const from=nodes.find(n=>n.id===source)!.position,to=nodes.find(n=>n.id===target)!.position
    const left=to.x<from.x,vertical=Math.abs(to.y-from.y)>Math.abs(to.x-from.x)*1.3,up=to.y<from.y
    const bypass=to.x===from.x && Math.abs(to.y-from.y)>200
    const targetDef=FLOW_STAGES.find(s=>s[0]===target)!
    return { id:`${source}:${target}`,source,target,type:'chain',sourceHandle:bypass?'right-out':vertical?(up?'top-out':'bottom-out'):(left?'left-out':'right-out'),targetHandle:bypass?'right-in':vertical?(up?'bottom-in':'top-in'):(left?'right-in':'left-in'),data:{ volume:graph?.edges[`${source}:${target}`] || 0,loaded:!!graph,color:FLOW_COLORS[targetDef[2]] } }
  }),[nodes,graph])
  const update = (key:keyof FlowFilters,value:string)=>setFilters(f=>({...f,[key]:value}))
  const download = (url:string,name:string)=>{const a=document.createElement('a');a.href=url;a.download=name;a.click()}
  async function exportCsv() {
    if(!selected || exporting)return
    const controller=new AbortController();exportAbort.current=controller;setExporting(true);setNotice('Preparing complete customer export…')
    try {
      const lines=[columns.map(([,label])=>csvCell(label)).join(',')];let total=0
      for(let p=1;;p++) {
        const batch=await request<FlowTable>({...filters,mode:'table',stage:selected,search:query,page:p,limit:100,sort,direction},controller.signal)
        if(p===1)total=batch.total
        if(batch.total!==total)throw new Error('Customer data changed during export. Refresh and export again.')
        for(const row of batch.rows)lines.push(columns.map(([key])=>csvCell(cell(row,key))).join(','))
        if(p*100>=total)break
        if(!batch.rows.length)throw new Error('Export was interrupted. Please retry.')
        setNotice(`Exporting ${Math.min(p*100,total)} of ${total} customers…`)
      }
      const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));download(url,`sara-${selected}-customers.csv`);setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`Exported ${total} customers.`)
    } catch(e){setNotice(controller.signal.aborted?'Export cancelled.':(e as Error).message)} finally{setExporting(false);exportAbort.current=null}
  }
  async function exportGraph(type:'png'|'svg') {
    const viewport=root.current?.querySelector<HTMLElement>('.react-flow__viewport');if(!viewport)return
    try {
      setNotice('Preparing graph export…')
      const { toPng,toSvg }=await import('html-to-image')
      const all=getNodes(),minX=Math.min(...all.map(n=>n.position.x))-100,minY=Math.min(...all.map(n=>n.position.y))-100
      const width=Math.max(...all.map(n=>n.position.x))+200-minX,height=Math.max(...all.map(n=>n.position.y))+200-minY
      const url=await(type==='png'?toPng:toSvg)(viewport,{backgroundColor:'#ffffff',width,height,pixelRatio:2,style:{width:`${width}px`,height:`${height}px`,transform:`translate(${-minX}px,${-minY}px) scale(1)`},filter:n=>!(n instanceof HTMLElement && n.classList.contains('react-flow__handle'))})
      download(url,`sara-customer-flow.${type}`);setNotice('Graph exported.')
    }catch(e){setNotice(`Graph export failed: ${(e as Error).message}`)}
  }
  function layout(action:'save'|'reset') {
    try {if(action==='save'){localStorage.setItem('sara.customer-flow.layout.v1',JSON.stringify({nodes:Object.fromEntries(getNodes().map(n=>[n.id,n.position])),viewport:getViewport()}));setNotice('Graph layout saved on this device.')}
      else {localStorage.removeItem('sara.customer-flow.layout.v1');setNodes(current=>current.map(node=>({...node,position:initial.find(n=>n.id===node.id)?.position || node.position})));setTimeout(()=>fitView({padding:0.12,duration:500}),50);setNotice('Default layout restored.')}
    }catch{setNotice('Browser storage is unavailable.')}
  }
  return <div ref={root} className="customer-flow-app" style={{zIndex:60}}>
    <header className="flow-header"><div className="flow-brand"><Link href="/admin/dashboard" aria-label="Back to admin"><Icons.ArrowLeft size={18}/></Link><span className="flow-brand-mark"><Icons.Waypoints size={20}/></span><div><h1>Customer flow</h1><p>SARA STORES <span>·</span> Journey intelligence</p></div></div>
      <div className="flow-header-actions"><Link href="/admin/page-flow" className="text-xs text-blue-600">Page Flow</Link><span className="flow-live"><i/>{loading?'Updating…':'Live records'}</span><button title="Refresh data" aria-label="Refresh data" onClick={()=>{setFilters(f=>preset==='Custom'?f:{...f,...dateRange(preset)});setRefresh(v=>v+1)}}><Icons.RefreshCw size={17}/></button><button title="Full screen" aria-label="Full screen" onClick={()=>{(document.fullscreenElement?document.exitFullscreen():root.current?.requestFullscreen())?.catch(()=>setNotice('Full screen is unavailable in this browser.'))}}><Icons.Maximize size={17}/></button><button onClick={()=>setCoverage(v=>!v)}><Icons.Info size={16}/><span>Data coverage</span></button></div>
    </header>
    <div className="flow-filterbar"><div className="flow-date"><Icons.CalendarDays size={16}/><select aria-label="Date range" value={preset} onChange={e=>{setPreset(e.target.value);if(e.target.value!=='Custom')setFilters(f=>({...f,...dateRange(e.target.value)}))}}>{['Today','Yesterday','Last 7 Days','Last 30 Days','Last 90 Days','Custom'].map(p=><option key={p}>{p}</option>)}</select><span>IST</span></div>
      {preset==='Custom' && <><input type="date" aria-label="Start date" value={new Date(+new Date(filters.start)+19800000).toISOString().slice(0,10)} onChange={e=>{if(e.target.value)update('start',new Date(`${e.target.value}T00:00:00+05:30`).toISOString())}}/><input type="date" aria-label="End date" value={new Date(+new Date(filters.end)-1+19800000).toISOString().slice(0,10)} onChange={e=>{if(e.target.value)update('end',new Date(+new Date(`${e.target.value}T00:00:00+05:30`)+86400000).toISOString())}}/></>}
      <select aria-label="Customer type" value={filters.kind} onChange={e=>update('kind',e.target.value)}><option value="">All customers</option><option value="guest">Guest</option><option value="registered">Registered</option></select>
      <select aria-label="Device" value={filters.device} onChange={e=>update('device',e.target.value)}><option value="">All devices</option>{['Mobile','Desktop','Tablet'].map(v=><option key={v}>{v}</option>)}</select>
      <button className={advanced?'active':''} onClick={()=>setAdvanced(v=>!v)}><Icons.SlidersHorizontal size={15}/>Filters</button>
      <label className="flow-search"><Icons.Search size={15}/><input placeholder="Search customer, email or order…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')select('visitor')}} aria-label="Search customers"/><button onClick={()=>select('visitor')} aria-label="Find customers"><Icons.ArrowRight size={15}/></button></label>
    </div>
    {advanced && <div className="flow-advanced">{([['source','Traffic source'],['gateway','Payment gateway'],['product','Product ID'],['orderStatus','Order status']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} placeholder={key==='gateway'?'e.g. razorpay':key==='orderStatus'?'e.g. delivered':'Exact value'} value={filters[key]} onChange={e=>update(key,e.target.value)}/></label>)}<button onClick={()=>setFilters(f=>({...f,kind:'',device:'',source:'',gateway:'',product:'',orderStatus:''}))}>Clear filters</button></div>}
    {coverage && <div className="flow-coverage"><strong>Recorded activity, with explicit gaps</strong>{graph?.coverage.notes.map(n=><p key={n}>{n}</p>)}{graph && <p>{format.format(graph.coverage.anonymousEventsExcluded)} unidentifiable events and {format.format(graph.coverage.guestOrdersExcluded)} unlinked guest orders excluded in this date range.</p>}<p>Zero means no qualifying records. Counts update after refresh. Layout is saved locally; customer records are never stored in browser storage.</p></div>}
    {error && <div role="alert" className="flow-error">{error}<button onClick={()=>setRefresh(v=>v+1)}>Retry</button></div>}
    <main className="flow-canvas" aria-label="Customer journey canvas">
      <ReactFlow<Circle,FlowEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onNodeClick={(_event,node)=>select(node.id as StageId)} fitView fitViewOptions={{padding:0.13}} minZoom={0.15} maxZoom={2} nodesConnectable={false} deleteKeyCode={null} onPaneClick={()=>setSelected(null)} proOptions={{hideAttribution:true}}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce2ea"/>
        {mini && <MiniMap position="bottom-right" nodeColor={n=>n.data.color as string} nodeStrokeWidth={0} nodeBorderRadius={100} pannable zoomable maskColor="rgba(248,250,252,.65)"/>}
      </ReactFlow>
      <div className="flow-canvas-heading"><span>CUSTOMER JOURNEY</span><p>{loading?'Loading recorded activity…':graph ? `${format.format(graph.total)} unique customer identities · ${preset==='Custom'?'Custom range':preset.toLowerCase()}`:'Data unavailable'}</p><small>Click a circle to explore customers. Drag to arrange.</small></div>
      <div className="flow-controls"><button aria-label="Zoom in" title="Zoom in" onClick={()=>zoomIn({duration:200})}><Icons.Plus size={17}/></button><button aria-label="Zoom out" title="Zoom out" onClick={()=>zoomOut({duration:200})}><Icons.Minus size={17}/></button><button aria-label="Fit to screen" title="Fit to screen" onClick={()=>fitView({padding:.13,duration:400})}><Icons.Scan size={17}/></button><button aria-label="Toggle mini map" title="Mini map" onClick={()=>setMini(v=>!v)}><Icons.Map size={17}/></button><span/><button aria-label="Save graph layout" title="Save layout" onClick={()=>layout('save')}><Icons.Save size={17}/></button><button aria-label="Reset graph layout" title="Reset layout" onClick={()=>layout('reset')}><Icons.RotateCcw size={17}/></button><button title="Export graph as PNG" onClick={()=>exportGraph('png')}>PNG</button><button title="Export graph as SVG" onClick={()=>exportGraph('svg')}>SVG</button></div>
      <div className="flow-legend">{(['blue','purple','orange','green','red','grey'] as const).map((tone,i)=><span key={tone}><i style={{background:FLOW_COLORS[tone]}}/>{['Visitors','Products & cart','Checkout','Success','Failure / exit','Pending'][i]}</span>)}</div>
    </main>
    {notice && <div className="flow-notice" role="status">{notice}{exporting?<button onClick={()=>exportAbort.current?.abort()}>Cancel export</button>:<button aria-label="Dismiss message" onClick={()=>setNotice('')}><Icons.X size={14}/></button>}</div>}
    <Dialog.Root open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}><Dialog.Portal container={root.current}>
      <Dialog.Overlay className="flow-drawer-overlay"/><Dialog.Content className="flow-drawer" onOpenAutoFocus={e=>{e.preventDefault();root.current?.querySelector<HTMLButtonElement>('.flow-drawer-close')?.focus()}}>
        <div className="flow-drawer-title"><div><p>CUSTOMER COHORT</p><Dialog.Title>{selected ? stageName(selected):''} <span>{table ? format.format(table.total):'…'}</span></Dialog.Title><Dialog.Description>Customers with recorded activity in this stage and selected date range. Click a name for their timeline.</Dialog.Description></div><div><button disabled={!table || exporting || !!tableError} onClick={exportCsv}><Icons.Download size={15}/>Export CSV</button><Dialog.Close className="flow-drawer-close" aria-label="Close customer table"><Icons.X size={19}/></Dialog.Close></div></div>
        <div className="flow-table-tools"><label><Icons.Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this customer cohort…" aria-label="Search customer table"/></label><select value={filters.kind} onChange={e=>update('kind',e.target.value)} aria-label="Filter table customer type"><option value="">Guest & registered</option><option value="guest">Guest</option><option value="registered">Registered</option></select><select value={filters.device} onChange={e=>update('device',e.target.value)} aria-label="Filter table device"><option value="">All devices</option>{['Mobile','Desktop','Tablet'].map(v=><option key={v}>{v}</option>)}</select><small>Cart values are reported; order amounts are verified server records.</small></div>
        {tableError && <p role="alert" className="flow-error">{tableError}<button onClick={()=>setRefresh(v=>v+1)}>Retry</button></p>}
        <div className="flow-table-scroll" aria-busy={tableLoading}><table><thead><tr>{columns.map(([key,label])=><th key={key} aria-sort={sort===key?(direction==='asc'?'ascending':'descending'):'none'}><button onClick={()=>{setSort(key);setDirection(sort===key && direction==='desc'?'asc':'desc');setPage(1)}}>{label}{sort===key?<Icons.ChevronDown size={12} style={{transform:direction==='asc'?'rotate(180deg)':undefined}}/>:<Icons.ChevronsUpDown size={12}/>}</button></th>)}</tr></thead><tbody>
          {tableLoading ? <tr><td colSpan={columns.length} className="flow-table-empty">Loading customer records…</td></tr> : table?.rows.length ? table.rows.map(row=><tr key={row.id} onClick={()=>{setDetailId(row.id);setDetailPage(1)}}>{columns.map(([key])=><td key={key}>{key==='name'?<button className="flow-customer-name" onClick={e=>{e.stopPropagation();setDetailId(row.id);setDetailPage(1)}}><span>{row.name?.slice(0,1) || '?'}</span>{row.name || 'Anonymous visitor'}</button>:key==='kind'?<span className={`flow-kind ${row.kind}`}>{cell(row,key)}</span>:cell(row,key)}</td>)}</tr>):<tr><td colSpan={columns.length} className="flow-table-empty">{tableError?'Customer data could not be loaded.':'No matching customers recorded. Try another date range or clear filters.'}</td></tr>}
        </tbody></table></div>
        <footer className="flow-table-pagination"><span>{table?.total ? `${(page-1)*25+1}–${Math.min(page*25,table.total)} of ${format.format(table.total)} customers`:'0 customers'}</span><div><button disabled={page===1 || tableLoading} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page}</span><button disabled={!table || page*25>=table.total || tableLoading} onClick={()=>setPage(p=>p+1)}>Next</button></div></footer>
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
    <Dialog.Root open={!!detailId} onOpenChange={open=>{if(!open)setDetailId('')}}><Dialog.Portal container={root.current}><Dialog.Overlay className="flow-profile-overlay"/><Dialog.Content className="flow-profile">
      <div className="flow-profile-header"><div><p>CUSTOMER PROFILE</p><Dialog.Title>{detail?.customer.name || 'Customer details'}</Dialog.Title></div><Dialog.Close aria-label="Close customer details"><Icons.X size={20}/></Dialog.Close></div><Dialog.Description>Chronological recorded activity through the selected end date. Missing history is not reconstructed.</Dialog.Description>
      {detailError?<p role="alert">{detailError}</p>:!detail?<p>Loading profile…</p>:<><dl className="flow-profile-data">{columns.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{cell(detail.customer,key)}</dd></div>)}</dl><h3>Activity timeline <span>{detail.total} events</span></h3><ol className="flow-timeline">{detail.events.map((event,i)=><li key={`${event.at}-${event.stage}-${i}`}><i style={{background:FLOW_COLORS[FLOW_STAGES.find(s=>s[0]===event.stage)?.[2] || 'grey']}}/><div><strong>{stageName(event.stage)}</strong><time>{stamp(event.at)}</time><p>{event.evidence}{event.orderId?` · Order ${event.orderId}`:''}{event.productIds.length?` · Products: ${event.productIds.join(', ')}`:''}</p></div></li>)}</ol><div className="flow-detail-pages"><button disabled={detailPage===1} onClick={()=>setDetailPage(p=>p-1)}>Earlier</button><span>Page {detailPage}</span><button disabled={detailPage*100>=detail.total} onClick={()=>setDetailPage(p=>p+1)}>Later</button></div></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
export default function CustomerFlowCanvas(){return <ReactFlowProvider><Canvas/></ReactFlowProvider>}

