import { createHash } from 'node:crypto'
import type { Document } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import type { FlowCustomer } from '@/lib/customer-flow'

export type DatabasePaymentFailure=FlowCustomer & {databaseFailure:true;recoveryVisitorId:string;failureReference:string;failureSource:string;failureStatus:string}
const text=(value:unknown):Document=>({$convert:{input:value,to:'string',onNull:'',onError:''}})
const date=(value:unknown):Document=>({$convert:{input:value,to:'date',onNull:null,onError:null}})
const number=(value:unknown):Document=>({$convert:{input:value,to:'double',onNull:null,onError:null}})
const prefer=(values:unknown[]):unknown=>values.reduceRight((fallback,value)=>({$cond:[{$ne:[{$ifNull:[value,'']},'']},value,fallback]}),'')
const failures=/^(failed|failure|declined|payment_failed|txn_failure|cancelled|canceled)$/i
const successes=/^(completed|captured|paid|verified|success|successful)$/i
function source(source:'orders'|'payments'|'checkout_intents',start:Date,end:Date):Document[]{
  const order=source==='orders',joined=order?'$':'$linked.'
  const prefix=(field:string)=>joined+field
  const failed={$regex:failures.source,$options:'i'}
  const succeeded={$regex:successes.source,$options:'i'}
  const pipeline:Document[]=[{$match:{$or:[...(!order?[{status:failed}]:[{status:{$regex:'^payment_failed$',$options:'i'}}]),{'paymentDetails.status':failed},{paymentStatus:failed}]}}]
  // Financial success takes precedence over a stale failure field.
  pipeline.push({$match:{'paymentVerification.verified':{$ne:true},status:{$not:succeeded},paymentStatus:{$not:succeeded},'paymentDetails.status':{$not:succeeded}}})
  if(!order)pipeline.push({$lookup:{from:'orders',let:{reference:text('$orderId')},pipeline:[
    {$match:{$expr:{$and:[
      {$ne:['$$reference','']},
      {$or:[{$eq:[text('$orderId'),'$$reference']},{$eq:[text('$_id'),'$$reference']}]},
    ]}}},
    {$sort:{updatedAt:-1}},{$limit:1},{$project:{userId:1,journeyVisitorId:1,customer:1,shippingAddress:1,items:1,orderId:1,paymentMethod:1,paymentVerification:1,paymentDetails:1,paymentStatus:1,status:1}},
  ],as:'linked'}},{$set:{linked:{$arrayElemAt:['$linked',0]}}},{$match:{'linked.paymentVerification.verified':{$ne:true},'linked.paymentDetails.status':{$not:succeeded},'linked.paymentStatus':{$not:succeeded},'linked.status':{$not:succeeded}}})
  const itemIds={$map:{input:{$ifNull:['$items',{$ifNull:[prefix('items'),[]]}]},as:'item',in:text({$ifNull:['$$item.productId','$$item.id']})}}
  pipeline.push({$project:{_id:0,
    userId:text(prefer(['$userId',prefix('userId')])),visitorId:text(prefer(['$journeyVisitorId',prefix('journeyVisitorId')])),
    name:text(prefer(['$customer.name','$customer.firstName','$name',prefix('customer.name'),prefix('customer.firstName'),prefix('shippingAddress.name')])),
    email:text(prefer(['$customer.email','$email',prefix('customer.email'),prefix('shippingAddress.email')])),phone:text(prefer(['$customer.phone','$phone',prefix('customer.phone'),prefix('shippingAddress.phone')])),
    productIds:{$setUnion:[itemIds,{$ifNull:['$journeyProductIds',[]]}]},
    recoveryItems:{$map:{input:{$ifNull:['$journeyItems',{$ifNull:['$items',{$ifNull:[prefix('items'),[]]}]}]},as:'item',in:{
      id:text({$ifNull:['$$item.productId','$$item.id']}),name:text('$$item.name'),quantity:number('$$item.quantity'),
    }}},
    productName:{$reduce:{input:{$ifNull:['$items',{$ifNull:[prefix('items'),[]]}]},initialValue:'',in:{$concat:['$$value',{$cond:[{$eq:['$$value','']},'',', ']},text('$$this.name')]}}},
    failedAt:date({$ifNull:['$failedAt',{$ifNull:['$updatedAt','$createdAt']}]}),
    reference:text(prefer(['$providerPaymentId','$razorpayPaymentId','$_id'])),orderId:text(prefer(['$orderId',prefix('orderId')])),
    gateway:text(prefer(['$method','$paymentDetails.method','$paymentMethod',prefix('paymentDetails.method'),prefix('paymentMethod')])),
    amount:source==='checkout_intents'?{$divide:[number('$amount'),100]}:number(prefer(['$amount','$total','$summary.total'])),
    failureSource:{$literal:source},failureStatus:text(prefer(['$paymentDetails.status','$paymentStatus','$status'])),
  }},{$match:{failedAt:{$gte:start,$lt:end}}})
  return pipeline
}
export function databasePaymentFailuresPipeline(start:Date,end:Date,page=1,limit=25):Document[]{
  return [...source('orders',start,end),{$unionWith:{coll:'payments',pipeline:source('payments',start,end)}},{$unionWith:{coll:'checkout_intents',pipeline:source('checkout_intents',start,end)}},
    {$set:{identity:{$switch:{branches:[
      {case:{$ne:['$userId','']},then:{$concat:['u:','$userId']}},
      {case:{$ne:['$visitorId','']},then:{$concat:['v:','$visitorId']}},
      {case:{$ne:['$email','']},then:{$concat:['email:',{$toLower:'$email'}]}},
      {case:{$ne:['$phone','']},then:{$concat:['phone:','$phone']}},
    ],default:{$concat:['record:','$failureSource',':','$reference']}}}}},
    {$sort:{failedAt:-1,reference:1}},{$group:{_id:'$identity',record:{$first:'$$ROOT'}}},
    {$facet:{total:[{$count:'value'}],rows:[{$sort:{'record.failedAt':-1,_id:1}},{$skip:(page-1)*limit},{$limit:limit},{$replaceRoot:{newRoot:'$record'}}]}},
  ]
}
export async function getDatabasePaymentFailures(start:Date,end:Date,page=1,limit=25):Promise<{rows:DatabasePaymentFailure[];total:number}>{
  const result=await (await getCollection('orders')).aggregate(databasePaymentFailuresPipeline(start,end,page,limit),{maxTimeMS:10000,allowDiskUse:true}).toArray()
  const rows:DatabasePaymentFailure[]=(result[0]?.rows || []).map(paymentFailureRow)
  return {rows,total:result[0]?.total[0]?.value || 0}
}
export function paymentFailureRow(record:Document):DatabasePaymentFailure {
    const identity=String(record.identity),id=/^[uv]:/.test(identity)?identity:`f:${createHash('sha256').update(identity).digest('hex')}`
    return {id,name:record.name || 'Customer',email:record.email || '',phone:record.phone || '',kind:record.userId?'registered':'guest',
      productIds:(record.productIds || []).filter((id:unknown)=>typeof id==='string' && !!id),cartProductIds:[],
      recoveryItems:(Array.isArray(record.recoveryItems)?record.recoveryItems:[]).slice(0,100).map((item:Document)=>({
        id:String(item.id || ''),name:String(item.name || '').slice(0,300),
        quantity:Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity)>0?Number(item.quantity):null,
      })).filter((item:{id:string})=>!!item.id),
      paymentFailedAt:new Date(record.failedAt).toISOString(),cartAt:null,lastActivity:new Date(record.failedAt).toISOString(),currentStage:'payment_failed',
      paymentAmount:record.amount ?? null,paymentGateway:record.gateway || '',paymentReference:record.reference || '',orderId:record.orderId || '',
      failureReference:record.reference || '',failureSource:record.failureSource,failureStatus:record.failureStatus,databaseFailure:true,recoveryVisitorId:record.visitorId || '',
      failureProductName:String(record.productName || '').slice(0,400),
      productsViewed:0,cartValue:null,orderAmount:null,paymentStatus:record.failureStatus,orderStatus:'',device:'Unknown',trafficSource:'Database',firstVisit:null,
      address:'',city:'',state:'',pincode:'',country:'',contactSource:`Stored ${record.failureSource} failure`,
    }
}
export async function databaseFailureStillFailed(source:string,reference:string):Promise<boolean>{
  if(!['orders','payments','checkout_intents'].includes(source) || !reference)return false
  const record=await (await getCollection(source)).findOne({$expr:{$or:['$_id','$providerPaymentId','$razorpayPaymentId'].map(field=>({$eq:[text(field),reference]}))}},
    {projection:{status:1,paymentStatus:1,paymentDetails:1,paymentVerification:1},maxTimeMS:3000})
  if(!record || record.paymentVerification?.verified===true)return false
  const statuses=[record.status,record.paymentStatus,record.paymentDetails?.status].map(value=>String(value || ''))
  return !statuses.some(value=>successes.test(value)) && statuses.some(value=>failures.test(value))
}
