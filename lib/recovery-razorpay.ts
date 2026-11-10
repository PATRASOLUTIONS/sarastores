import { z } from 'zod'
import { getCollection } from '@/lib/db-service'
import { paymentFailureRow, type DatabasePaymentFailure } from '@/lib/recovery-payment-data'
import type { RecoveryDashboard } from '@/lib/recovery-policy'

const noteText=z.union([z.string().max(2000),z.number().finite()]).transform(String).catch('')
const notesSchema=z.object({
  customer_name:noteText.optional(),customer_email:noteText.optional(),customer_phone:noteText.optional(),
  customer_address:noteText.optional(),customer_city:noteText.optional(),customer_state:noteText.optional(),
  customer_country:noteText.optional(),customer_zipcode:noteText.optional(),item_names:noteText.optional(),order_items_count:noteText.optional(),
})
const paymentSchema=z.object({
  id:z.string().regex(/^pay_[A-Za-z0-9]+$/),order_id:z.string().regex(/^order_[A-Za-z0-9]+$/).nullish(),
  status:z.enum(['created','authorized','captured','refunded','failed']),amount:z.number().int().nonnegative(),
  currency:z.string().max(10),created_at:z.number().int().positive(),email:z.string().max(320).nullish(),contact:z.string().max(50).nullish(),
  error_reason:z.string().max(500).nullish(),error_description:z.string().max(1000).nullish(),
  notes:notesSchema.nullish().catch(null),
})
const listSchema=z.object({items:z.array(paymentSchema).max(100)})
type GatewayStatus=NonNullable<RecoveryDashboard['razorpay']>
function credentials():{key:string;secret:string}|null {
  const recoveryKey=process.env.RAZORPAY_RECOVERY_KEY_ID?.trim(),recoverySecret=process.env.RAZORPAY_RECOVERY_KEY_SECRET?.trim()
  if(recoveryKey || recoverySecret)return recoveryKey && recoverySecret?{key:recoveryKey,secret:recoverySecret}:null
  const key=process.env.RAZORPAY_KEY_ID?.trim(),secret=process.env.RAZORPAY_KEY_SECRET?.trim()
  return key && secret?{key,secret}:null
}

async function read(path:string,timeoutMs=8000):Promise<unknown> {
  const selected=credentials()
  if(!selected)throw new Error('Razorpay recovery credentials are not configured')
  const {key,secret}=selected
  const response=await fetch(`https://api.razorpay.com/v1/${path}`,{
    headers:{Authorization:`Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`},
    cache:'no-store',signal:AbortSignal.timeout(timeoutMs),
  })
  if(!response.ok)throw new Error('Razorpay payment lookup failed')
  return response.json()
}

/** All configured-account failures are visible; only matched checkouts may send reminders. */
export async function getRazorpayRecoveryFailures(start:Date,end:Date,page=1,limit=25,scanCount=limit):Promise<{rows:DatabasePaymentFailure[];total:number;gateway:GatewayStatus}> {
  const gateway:GatewayStatus={status:'not_configured',message:'Configure both RAZORPAY_RECOVERY_KEY_ID and RAZORPAY_RECOVERY_KEY_SECRET, or use the checkout Razorpay key pair',fetchedAt:null,hasMore:false}
  const selected=credentials()
  if(!selected)return {rows:[],total:0,gateway}
  try {
    const params=new URLSearchParams({from:String(Math.floor(+start/1000)),to:String(Math.floor(+end/1000)),count:String(scanCount),skip:String((page-1)*scanCount)})
    const payments=listSchema.parse(await read(`payments?${params}`)).items
    const key=selected.key
    const mode=key.startsWith('rzp_live_')?'live mode':key.startsWith('rzp_test_')?'test mode':'configured account'
    gateway.status='connected';gateway.message=`Authenticated Razorpay payment data (${mode})`;gateway.fetchedAt=end.toISOString();gateway.hasMore=payments.length===scanCount;gateway.scanned=payments.length
    const failures=payments.filter(p=>p.status==='failed' && p.currency==='INR' && p.created_at*1000>=+start && p.created_at*1000<+end)
    gateway.failed=failures.length
    const successfulOrders=new Set(payments.filter(p=>['created','authorized','captured','refunded'].includes(p.status)).map(p=>p.order_id))
    const orderIds=[...new Set(failures.map(p=>p.order_id).filter((id):id is string=>!!id))]
    // Some integrations put notes on the gateway order instead of each payment.
    // Enrichment is display-only, best effort and bounded independently of eligibility.
    const orderNotes=new Map<string,z.infer<typeof notesSchema>>()
    const missingNotes=[...new Set(failures.filter(p=>!p.notes?.item_names?.trim()).map(p=>p.order_id).filter((id):id is string=>!!id))].slice(0,25)
    for(let i=0;i<missingNotes.length;i+=5){
      await Promise.all(missingNotes.slice(i,i+5).map(async id=>{
        try {
          const order=z.object({id:z.string(),notes:notesSchema.nullish()}).parse(await read(`orders/${id}`,3000))
          if(order.id===id && order.notes)orderNotes.set(id,order.notes)
        }catch { /* Failed optional notes lookup must not hide a failed payment. */ }
      }))
    }
    const intents=orderIds.length?await (await getCollection<{_id:string;[key:string]:unknown}>('checkout_intents')).find(
      {_id:{$in:orderIds},method:'razorpay'},
      {projection:{_id:1,userId:1,journeyVisitorId:1,journeyProductIds:1,journeyItems:1,amount:1,currency:1,status:1},maxTimeMS:3000},
    ).limit(scanCount).toArray():[]
    const rows:DatabasePaymentFailure[]=[]
    for(const payment of failures){
      const intent=intents.find(i=>i._id===payment.order_id)
      const bound=!!intent && intent.amount===payment.amount && intent.currency===payment.currency
      if((bound && ['verified','consumed'].includes(String(intent.status))) || (payment.order_id && successfulOrders.has(payment.order_id)))continue
      const userId=bound && typeof intent.userId==='string'?intent.userId:'',visitorId=bound && typeof intent.journeyVisitorId==='string'?intent.journeyVisitorId:''
      const email=(payment.email || '').trim().toLowerCase(),phone=(payment.contact || '').trim()
      const identity=userId?`u:${userId}`:visitorId?`v:${visitorId}`:email?`email:${email}`:`record:razorpay:${payment.id}`
      const row=paymentFailureRow({identity,userId,visitorId,email,phone,name:'Customer',
        productIds:bound && Array.isArray(intent.journeyProductIds)?intent.journeyProductIds:[],failedAt:new Date(payment.created_at*1000),
        recoveryItems:bound && Array.isArray(intent.journeyItems)?intent.journeyItems:[],
        reference:payment.id,orderId:payment.order_id,gateway:'razorpay',amount:payment.amount/100,
        failureSource:'razorpay',failureStatus:'failed',productName:'',
      })
      row.failureOrderId=payment.order_id || ''
      row.failureCheckoutBound=bound
      row.failureReason=(payment.error_description || payment.error_reason || '').trim().slice(0,300)
      const notes={...orderNotes.get(payment.order_id || ''),...Object.fromEntries(Object.entries(payment.notes || {}).filter(([,value])=>value?.trim()))}
      const count=Number(notes.order_items_count)
      row.gatewayDisplay={name:(notes.customer_name || '').trim().slice(0,300),email:(notes.customer_email || '').trim().slice(0,320),
        phone:(notes.customer_phone || '').trim().slice(0,50),address:[notes.customer_address,notes.customer_city,notes.customer_state,notes.customer_zipcode,notes.customer_country].filter(Boolean).join(', ').slice(0,1000),
        itemCount:Number.isSafeInteger(count) && count>0?count:null}
      row.failureProductName=(notes.item_names || '').trim().slice(0,2000)
      rows.push(row)
    }
    // Gateway pagination includes successful payments; this is a lower bound used
    // to rotate the worker and expose the next page without claiming a false count.
    return {rows,total:gateway.hasMore?(page+1)*limit:page*limit,gateway}
  }catch {
    gateway.status='error';gateway.message='Unable to verify Razorpay payments. Check credentials or retry; local records remain available.'
    return {rows:[],total:0,gateway}
  }
}

/** Failed attempts alone are insufficient when a sibling payment is authorized/captured. */
export async function razorpayFailureStillFailed(paymentId:string,orderId:string):Promise<boolean> {
  if(!/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^order_[A-Za-z0-9]+$/.test(orderId))return false
  try {
    const payment=paymentSchema.parse(await read(`payments/${paymentId}`))
    if(payment.id!==paymentId || payment.status!=='failed' || payment.order_id!==orderId || payment.currency!=='INR')return false
    const intent=await (await getCollection<{_id:string;[key:string]:unknown}>('checkout_intents')).findOne(
      {_id:orderId,method:'razorpay'},{projection:{amount:1,currency:1,status:1},maxTimeMS:3000},
    )
    if(!intent || intent.amount!==payment.amount || intent.currency!==payment.currency || ['verified','consumed'].includes(String(intent.status)))return false
    const siblings=listSchema.parse(await read(`orders/${orderId}/payments`)).items
    return siblings.some(p=>p.id===paymentId && p.status==='failed') && !siblings.some(p=>p.order_id===orderId && ['created','authorized','captured','refunded'].includes(p.status))
  }catch {return false}
}
