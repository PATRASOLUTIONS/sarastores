import type { Document } from 'mongodb'
import { z } from 'zod'
import { getCollection } from '@/lib/db-service'
import { FLOW_EVENT_STAGES, FLOW_LINKS, FLOW_STAGES, type FlowFilters } from '@/lib/customer-flow'

const ids = FLOW_STAGES.map(s => s[0])
export const FlowQuery = z.object({
  mode: z.enum(['graph','table','detail']).default('graph'),
  start: z.string().datetime(), end: z.string().datetime(),
  kind: z.enum(['','guest','registered']).default(''), device: z.enum(['','Mobile','Desktop','Tablet']).default(''),
  source: z.string().max(100).default(''), gateway: z.string().max(80).default(''),
  product: z.string().max(200).default(''), orderStatus: z.string().max(80).default(''),
  stage: z.string().refine(s => ids.includes(s as typeof ids[number])).default('visitor'),
  search: z.string().max(120).default(''), page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['name','email','phone','address','city','state','pincode','country','contactSource','productIds','paymentAmount','paymentGateway','paymentReference','id','kind','lastActivity','currentStage','productsViewed','cartValue','orderId','orderAmount','paymentStatus','orderStatus','device','trafficSource','firstVisit']).default('lastActivity'),
  direction: z.enum(['asc','desc']).default('desc'),
  id: z.string().max(220).regex(/^(?:[uv]:[a-zA-Z0-9_-]+)?$/).default(''),
}).superRefine((q, ctx) => {
  const days = (+new Date(q.end) - +new Date(q.start)) / 86400000
  if (days <= 0 || days > 366) ctx.addIssue({ code:'custom', message:'Select a date range of up to 366 days.' })
  if (q.mode === 'detail' && !q.id) ctx.addIssue({ code:'custom', message:'Customer ID is required.' })
})
export type FlowQueryInput = z.infer<typeof FlowQuery>
const str = (value: unknown): Document => ({ $convert: { input: value, to:'string', onError:'', onNull:'' } })
const date = (value: unknown): Document => ({ $convert: { input:value, to:'date', onError:null, onNull:null } })
const number = (value: unknown): Document => ({ $convert:{ input:value, to:'double', onError:null, onNull:null } })
const nonempty = (value: unknown): Document => ({ $ne: [ { $ifNull:[value,''] }, '' ] })
const prefer = (values: unknown[], otherwise: unknown = ''): unknown => values.reduceRight((next,value)=>({ $cond:[nonempty(value),value,next] }),otherwise)
const statusStage: Record<string,string> = { processing:'processing', confirmed:'processing', shipped:'shipped', out_for_delivery:'out_for_delivery', delivered:'delivered', cancelled:'cancelled', canceled:'cancelled', delivery_failed:'delivery_failed', returned:'returned', refunded:'refunded' }
const status = (value: unknown): Document => ({ $replaceAll:{ input:{ $replaceAll:{ input:{ $toLower:str(value) }, find:'-', replacement:'_' } }, find:' ', replacement:'_' } })
const mappedStatus = (value: unknown): Document => ({ $switch: { branches:Object.entries(statusStage).map(([s,stage]) => ({ case:{ $eq:[status(value),s] }, then:stage })), default:null } })
const event = (stage: unknown, at: unknown, evidence = 'Commerce record'): Document => ({ stage, at:date(at), evidence, productIds:[], orderId:'' })
const rawDateMatch = (fields: string[], start: Date, end: Date): Document => ({ $match:{ $or: fields.map(f => ({ [f]:{ $gte:start,$lt:end } })) } })

/** Indexed source matches precede projection/union. Aggregation never exports raw commerce documents. */
export function flowEventsPipeline(q: FlowFilters, allHistory = false): Document[] {
  const start = allHistory ? new Date(0) : new Date(q.start), end = new Date(q.end)
  const range = { $gte:start, $lt:end }
  const analytics: Document[] = [
    rawDateMatch(['createdAt'],start,end),
    { $match:{ $or:[{ userId:{ $type:'string',$ne:'' } },{ visitorId:{ $type:'string',$ne:'' } }] } },
    { $project:{ _id:0, userId:str('$userId'), visitorId:str('$visitorId'), at:date('$createdAt'),
      stage:{ $switch:{ branches:Object.entries(FLOW_EVENT_STAGES).map(([name, stages]) => ({ case:{ $eq:['$event',name] }, then:name === 'page_view' ? { $concatArrays:[stages, [{ $cond:[nonempty('$userId'),'registered','guest'] }]] } : stages })), default:[] } },
      device:{ $ifNull:['$device','Unknown'] }, source:{ $ifNull:['$trafficSource',''] },
      productIds:{ $ifNull:['$productIds',[]] }, viewedIds:{ $cond:[{ $eq:['$event','view_item'] },{ $ifNull:['$productIds',[]] },[]] },
      cartValue:{ $cond:[{ $in:['$event',['add_to_cart','view_cart','cart_confirmed','begin_checkout']] },number('$params.value'),null] },
      evidence:{ $literal:'Consented browser event' }, order:{ $literal:null },
      contact:{ $ifNull:['$checkoutContext',null] }, contactSource:{ $cond:[nonempty('$checkoutContext.name'),'Entered checkout details',''] },
      gateway:{ $ifNull:['$params.payment_type',''] }, payment:{ $literal:null },
      recoveryConsent:{ $ifNull:['$recoveryConsent',null] },
    } }, { $unwind:'$stage' },
  ]
  const orderEvents = { $concatArrays:[
    [event('order','$createdAt')],
    { $cond:[{ $eq:['$paymentVerification.verified',true] },[event('payment_success','$paymentVerification.verifiedAt')],[]] },
    { $cond:[{ $eq:['$paymentVerification.verified',false] },[event('payment_pending','$createdAt')],[]] },
    { $map:{ input:{ $ifNull:['$statusHistory',[]] }, as:'h', in:event(mappedStatus('$$h.status'),'$$h.timestamp','Recorded order status change') } },
    [event(mappedStatus('$status'),{ $ifNull:['$updatedAt','$createdAt'] },'Recorded current order status')],
  ] }
  const orders: Document[] = [
    rawDateMatch(['createdAt','updatedAt','statusHistory.timestamp','paymentVerification.verifiedAt'],start,end),
    { $match:{ $or:[{ userId:{ $type:'string',$ne:'' } },{ journeyVisitorId:{ $type:'string',$ne:'' } }] } },
    { $project:{ userId:str('$userId'), visitorId:str('$journeyVisitorId'),
      events:orderEvents, device:{ $literal:'' }, source:{ $literal:'' }, viewedIds:{ $literal:[] }, cartValue:{ $literal:null },
      productIds:{ $map:{ input:{ $ifNull:['$items',[]] }, as:'i', in:str({ $ifNull:['$$i.productId','$$i.id'] }) } },
      order:{ orderId:str({ $ifNull:['$orderId','$_id'] }), amount:number({ $ifNull:['$total','$summary.total'] }),
        name:str('$customer.name'),email:str('$customer.email'),phone:str('$customer.phone'),
        status:str('$status'),gateway:str('$paymentMethod'),paymentStatus:{ $cond:[{ $eq:['$paymentVerification.verified',true] },'Verified',{ $ifNull:['$paymentDetails.status','Not verified'] }] } },
      contact:{ name:str('$customer.name'),email:str('$customer.email'),phone:str('$customer.phone'),
        address:str(prefer(['$shippingAddress.street','$shippingAddress.address','$customer.address'])),
        city:str(prefer(['$shippingAddress.city','$customer.city'])),state:str(prefer(['$shippingAddress.state','$customer.state'])),
        pincode:str(prefer(['$shippingAddress.zip','$shippingAddress.zipCode','$shippingAddress.pincode','$customer.zipCode','$customer.pincode'])),
        country:str(prefer(['$shippingAddress.country','$customer.country'])) },
      contactSource:{ $literal:'Order checkout details' },payment:{ $literal:null },
    } }, { $unwind:'$events' },
    { $set:{ at:'$events.at', stage:'$events.stage', evidence:'$events.evidence' } },
    { $match:{ stage:{ $ne:null },at:range } }, { $unset:['events','_id'] },
  ]
  const intents: Document[] = [
    rawDateMatch(['createdAt'],start,end),
    { $match:{ $or:[{ userId:{ $type:'string',$ne:'' } },{ journeyVisitorId:{ $type:'string',$ne:'' } }] } },
    { $project:{ _id:0,userId:str('$userId'),visitorId:str('$journeyVisitorId'),at:date('$createdAt'), stage:{ $literal:'payment' },
      evidence:{ $literal:'Server checkout intent' }, device:{ $literal:'' }, source:{ $literal:'' }, productIds:{ $ifNull:['$journeyProductIds',[]] },
      viewedIds:{ $literal:[] }, cartValue:{ $literal:null }, order:{ $literal:null }, gateway:'$method',
      contact:{ $literal:null },contactSource:{ $literal:'' },
      payment:{ reference:str('$_id'),amount:{ $divide:[number('$amount'),100] },gateway:str('$method'),status:str('$status') },
    } },
  ]
  const carts: Document[] = [rawDateMatch(['updatedAt'],start,end),{ $match:{ userId:{ $type:'string',$ne:'' },'items.0':{ $exists:true } } },
    { $project:{ _id:0,userId:str('$userId'),visitorId:{ $literal:'' },at:date('$updatedAt'),stage:{ $literal:'cart' },
      evidence:{ $literal:'Saved account cart snapshot' },device:{ $literal:'' },source:{ $literal:'' },viewedIds:{ $literal:[] },order:{ $literal:null },cartValue:{ $literal:null },
      contact:{ $literal:null },contactSource:{ $literal:'' },payment:{ $literal:null },
      productIds:{ $map:{ input:'$items',as:'i',in:str({ $ifNull:['$$i.productId','$$i.id'] }) } },
    } },
  ]
  return [...analytics,{ $unionWith:{ coll:'orders',pipeline:orders } },{ $unionWith:{ coll:'checkout_intents',pipeline:intents } },{ $unionWith:{ coll:'carts',pipeline:carts } },
    // A browser shared by several accounts is deliberately NOT joined to any account.
    { $lookup:{ from:'analytics_events',let:{ vid:'$visitorId' },pipeline:[
      { $match:{ userId:{ $type:'string',$ne:'' },$expr:{ $and:[nonempty('$$vid'),{ $eq:['$visitorId','$$vid'] }] } } }, { $group:{ _id:'$userId' } }, { $limit:2 },
    ],as:'linkedAccounts' } },
    { $set:{ userId:{ $cond:[nonempty('$userId'),'$userId',{ $cond:[{ $eq:[{ $size:'$linkedAccounts' },1] },{ $arrayElemAt:['$linkedAccounts._id',0] },''] }] } } },
    { $set:{ id:{ $cond:[nonempty('$userId'),{ $concat:['u:','$userId'] },{ $concat:['v:','$visitorId'] }] } } },
    { $unset:'linkedAccounts' },
  ]
}
function cohorts(q: FlowQueryInput): Document[] {
  const asOf = Math.min(Date.now(), +new Date(q.end)), quietBefore = new Date(asOf-86400000)
  const lastNonempty = (field: string) => ({ $reduce:{ input:`$${field}`, initialValue:'', in:{ $cond:[nonempty('$$this'),'$$this','$$value'] } } })
  const contactField = (field: string) => ({ $reduce:{ input:'$contacts',initialValue:'',in:{ $cond:[nonempty(`$$this.${field}`),`$$this.${field}`,'$$value'] } } })
  return [
    { $set:{ stageOrder:{ $indexOfArray:[ids,'$stage'] } } },
    { $sort:{ at:1,stageOrder:1 } },
    { $group:{ _id:'$id',userId:{ $max:'$userId' },visitorIds:{ $addToSet:'$visitorId' },stages:{ $addToSet:'$stage' }, sequence:{ $push:'$stage' },
      lastActivity:{ $max:'$at' },currentStage:{ $last:'$stage' }, firstInRange:{ $min:'$at' },
      orders:{ $push:'$order' },devices:{ $push:'$device' },sources:{ $push:'$source' },gateways:{ $push:'$gateway' },
      contacts:{ $push:'$contact' },contactSources:{ $push:'$contactSource' },payments:{ $push:'$payment' },
      recoveryConsents:{ $push:'$recoveryConsent' },
      cartAt:{ $max:{ $cond:[{ $in:['$stage',['cart','cart_confirmed']] },'$at',null] } },
      paymentFailedAt:{ $max:{ $cond:[{ $eq:['$stage','payment_failed'] },'$at',null] } },
      cartProducts:{ $push:{ $cond:[{ $in:['$stage',['cart','cart_confirmed']] },'$productIds',[]] } },
      products:{ $push:'$productIds' },views:{ $push:'$viewedIds' },carts:{ $push:'$cartValue' },
    } },
    { $set:{ id:'$_id', kind:{ $cond:[nonempty('$userId'),'registered','guest'] },
      latestOrder:{ $arrayElemAt:[{ $filter:{ input:'$orders',as:'o',cond:{ $ne:['$$o',null] } } },-1] },
      latestPayment:{ $arrayElemAt:[{ $filter:{ input:'$payments',as:'p',cond:{ $ne:['$$p',null] } } },-1] },
      recoveryConsent:{ $ifNull:[{ $arrayElemAt:[{ $filter:{ input:'$recoveryConsents',as:'c',cond:{ $ne:['$$c',null] } } },-1] },null] },
      cartProductIds:{ $reduce:{ input:'$cartProducts',initialValue:[],in:{ $setUnion:['$$value','$$this'] } } },
      checkoutName:contactField('name'),checkoutEmail:contactField('email'),checkoutPhone:contactField('phone'),
      address:contactField('address'),city:contactField('city'),state:contactField('state'),pincode:contactField('pincode'),country:contactField('country'),
      contactSource:lastNonempty('contactSources'),
      device:lastNonempty('devices'), trafficSource:lastNonempty('sources'), gateway:lastNonempty('gateways'),
      cartValue:{ $arrayElemAt:[{ $filter:{ input:'$carts',as:'c',cond:{ $ne:['$$c',null] } } },-1] },
      productIds:{ $reduce:{ input:'$products',initialValue:[],in:{ $setUnion:['$$value','$$this'] } } },
      viewedIds:{ $reduce:{ input:'$views',initialValue:[],in:{ $setUnion:['$$value','$$this'] } } },
      inferred:{ $cond:[{ $lt:['$lastActivity',quietBefore] },{ $switch:{ branches:[
        { case:{ $in:['$currentStage',['visitor','guest','registered','browse']] },then:'visitor_exited' },
        { case:{ $eq:['$currentStage','product'] },then:'product_abandoned' },
        { case:{ $in:['$currentStage',['cart','cart_confirmed']] },then:'cart_abandoned' },
        { case:{ $in:['$currentStage',['checkout','address','guest_checkout']] },then:'checkout_abandoned' },
      ],default:null } },null] },
    } },
    { $set:{ stages:{ $cond:[{ $ne:['$inferred',null] },{ $setUnion:['$stages',['$inferred']] },'$stages'] },
      sequence:{ $cond:[{ $ne:['$inferred',null] },{ $concatArrays:['$sequence',['$inferred']] },'$sequence'] },
      currentStage:{ $ifNull:['$inferred','$currentStage'] }, productsViewed:{ $size:{ $setDifference:['$viewedIds',['']] } },
      orderId:{ $ifNull:['$latestOrder.orderId',''] },orderAmount:{ $ifNull:['$latestOrder.amount',null] },
      orderStatus:{ $ifNull:['$latestOrder.status',''] },paymentStatus:{ $ifNull:['$latestOrder.paymentStatus',{ $ifNull:['$latestPayment.status',''] }] },
      gateway:{ $ifNull:['$latestOrder.gateway','$gateway'] },
      paymentAmount:{ $ifNull:['$latestPayment.amount',null] },paymentReference:{ $ifNull:['$latestPayment.reference',''] },
      paymentGateway:prefer(['$latestOrder.gateway','$latestPayment.gateway','$gateway']),
    } },
    { $match:{ ...(q.kind ? { kind:q.kind } : {}), ...(q.device ? { device:q.device } : {}),
      ...(q.source ? { trafficSource:q.source } : {}), ...(q.gateway ? { gateway:q.gateway } : {}),
      ...(q.product ? { productIds:q.product } : {}), ...(q.orderStatus ? { orderStatus:q.orderStatus } : {}),
    } },
  ]
}
const people: Document[] = [
  { $set:{ userObjectId:{ $convert:{ input:'$userId',to:'objectId',onError:null,onNull:null } } } },
  { $lookup:{ from:'users',localField:'userObjectId',foreignField:'_id',pipeline:[{ $project:{ name:1,email:1,phone:1 } }],as:'account' } },
  { $lookup:{ from:'users',localField:'userId',foreignField:'_id',pipeline:[{ $project:{ name:1,email:1,phone:1 } }],as:'stringAccount' } },
  { $set:{ account:{ $arrayElemAt:[{ $concatArrays:['$account','$stringAccount'] },0] } } },
  { $set:{ name:prefer(['$checkoutName','$account.name','$latestOrder.name'],'Anonymous visitor'),
    email:prefer(['$checkoutEmail','$account.email','$latestOrder.email']),phone:prefer(['$checkoutPhone','$account.phone','$latestOrder.phone']),
    contactSource:prefer(['$contactSource'],{ $cond:[nonempty('$account.name'),'Account profile','Not recorded'] }),
  } },
]
const safeRow: Document = { $project:{ _id:0,id:1,name:1,email:1,phone:1,kind:1,lastActivity:1,currentStage:1,productsViewed:1,
  address:1,city:1,state:1,pincode:1,country:1,contactSource:1,productIds:1,paymentAmount:1,paymentGateway:1,paymentReference:1,
  recoveryConsent:1,cartAt:1,paymentFailedAt:1,cartProductIds:1,
  cartValue:{ $ifNull:['$cartValue',null] },orderId:1,orderAmount:1,paymentStatus:1,orderStatus:1,
  device:{ $cond:[nonempty('$device'),'$device','Unknown'] },trafficSource:{ $cond:[nonempty('$trafficSource'),'$trafficSource','Unknown'] },
  firstVisit:{ $ifNull:['$firstVisit',null] },
} }
const visitProjection: Document[] = [{ $match:{ event:'page_view' } },{ $sort:{ createdAt:1 } },{ $limit:1 },{ $project:{ _id:0,at:'$createdAt' } }]
const firstVisit: Document[] = [
  { $lookup:{ from:'analytics_events',localField:'userId',foreignField:'userId',pipeline:visitProjection,as:'userFirstVisit' } },
  { $set:{ visitorIds:{ $setDifference:['$visitorIds',['']] } } },
  { $lookup:{ from:'analytics_events',localField:'visitorIds',foreignField:'visitorId',pipeline:visitProjection,as:'visitorFirstVisit' } },
  { $set:{ firstVisit:{ $min:{ $concatArrays:['$userFirstVisit.at','$visitorFirstVisit.at'] } } } },
]

export async function getCustomerFlow(q: FlowQueryInput) {
  const collection = await getCollection('analytics_events')
  const run = (pipeline: Document[]) => collection.aggregate(pipeline,{ maxTimeMS:12000,allowDiskUse:true }).toArray()
  if (q.mode === 'detail') {
    const history = [...flowEventsPipeline(q,true),{ $match:{ id:q.id } }]
    const result = await run([...history,{ $facet:{
      customer:[...cohorts({ ...q,kind:'',device:'',source:'',gateway:'',product:'',orderStatus:'' }),...people,...firstVisit,safeRow],
      events:[{ $sort:{ at:1,stage:1 } },{ $skip:(q.page-1)*q.limit },{ $limit:q.limit },{ $project:{ _id:0,stage:1,at:1,evidence:1,productIds:1,orderId:{ $ifNull:['$order.orderId',''] } } }],
      total:[{ $count:'value' }],
    } }])
    const data = result[0]
    return { customer:data?.customer[0] || null,events:data?.events || [],total:data?.total[0]?.value || 0,page:q.page }
  }
  const base = [...flowEventsPipeline(q),...cohorts(q)]
  if (q.mode === 'table') {
    const escaped = q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    const result = await run([...base,{ $match:{ stages:q.stage } },...people,
      ...(escaped ? [{ $match:{ $or:['name','email','phone','id','orderId','address','city','pincode','paymentReference','productIds'].map(f => ({ [f]:{ $regex:escaped,$options:'i' } })) } }] : []),
      ...(q.sort === 'firstVisit' ? firstVisit : []),
      { $facet:{ total:[{ $count:'value' }],rows:[
        { $sort:{ [q.sort]:q.direction === 'asc' ? 1 : -1,id:1 } },
        { $skip:(q.page-1)*q.limit },{ $limit:q.limit },...(q.sort === 'firstVisit' ? [] : firstVisit),safeRow,
      ] } },
    ])
    return { rows:result[0]?.rows || [],total:result[0]?.total[0]?.value || 0,page:q.page,limit:q.limit }
  }
  const links = FLOW_LINKS.map(([s,t]) => `${s}:${t}`)
  const result = await run([...base,{ $facet:{ total:[{ $count:'value' }],counts:[{ $unwind:'$stages' },{ $group:{ _id:'$stages',count:{ $sum:1 } } }],
    edges:[{ $project:{ pairs:{ $setUnion:[{ $map:{ input:{ $range:[1,{ $size:'$sequence' }] },as:'i',in:{ $concat:[{ $arrayElemAt:['$sequence',{ $subtract:['$$i',1] }] },':',{ $arrayElemAt:['$sequence','$$i'] }] } } },[]] } } },
      { $unwind:'$pairs' },{ $match:{ pairs:{ $in:links } } },{ $group:{ _id:'$pairs',count:{ $sum:1 } } }],
  } }])
  const [anonymousEventsExcluded,guestOrdersExcluded] = await Promise.all([
    collection.countDocuments({ createdAt:{ $gte:new Date(q.start),$lt:new Date(q.end) },userId:{ $in:[null,''] },visitorId:{ $in:[null,''] } },{ maxTimeMS:3000 }),
    (await getCollection('orders')).countDocuments({ createdAt:{ $gte:new Date(q.start),$lt:new Date(q.end) },userId:{ $in:[null,''] },journeyVisitorId:{ $in:[null,''] } },{ maxTimeMS:3000 }),
  ])
  return { total:result[0]?.total[0]?.value || 0,counts:Object.fromEntries((result[0]?.counts || []).map((r:Document) => [r._id,r.count])),
    edges:Object.fromEntries((result[0]?.edges || []).map((r:Document) => [r._id,r.count])),generatedAt:new Date().toISOString(),
    coverage:{ anonymousEventsExcluded,guestOrdersExcluded,notes:[
      'Counts deduplicate accounts and consented browser identities, not physical people. Shared-account browsers remain separate. Unidentifiable historical events and guest orders are excluded.',
      'Milestones require recorded evidence; later order states do not invent earlier stages. Counts measure activity within the range; percentages use all identifiable active customers as the denominator.',
      'Exit and abandonment are inferred from 24 hours without a subsequent recorded milestone as of the range end. They do not prove a visitor left or a cart was lost.',
      'Payment failures and retries are browser-reported unless backed by commerce history. Edges count consecutive recorded milestones per customer; zero means no recorded transition.',
      'Cart value is browser-reported. Order amount comes from the server order. Unknown devices, sources, first visits and historical failures are left unfilled.',
      'Search Console clicks and GA4 users are separate aggregate reports, not Customer Flow records. This view requires consented site events or identifiable commerce records.',
      'Checkout details are customer-entered contact information, not proof of identity. Missing historical guest addresses cannot be recovered; payment amount/reference come from saved checkout intents.',
    ] },
  }
}
