import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { ObjectId, type Document } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import { getAuthenticatedUserById } from '@/lib/auth-credentials'
import type { AuthSession } from '@/lib/auth'
import { isDiwaliCustomerBlocked } from '@/lib/diwali/blocklist'
import { FlowQuery, getCustomerFlow } from '@/lib/customer-flow-data'
import type { FlowCustomer } from '@/lib/customer-flow'
import { getDatabasePaymentFailures, databaseFailureStillFailed } from '@/lib/recovery-payment-data'
import { getRazorpayRecoveryFailures, razorpayFailureStillFailed } from '@/lib/recovery-razorpay'
import { priceCatalogueCart } from '@/lib/order-pricing'
import { isPublicProduct } from '@/lib/product-visibility'
import { normalizeProductForSchema } from '@/lib/product-schema'
import { getStorefrontPromotions } from '@/lib/storefront-promotions'
import { getEmailTransport } from '@/lib/smtp'
import { sendWhatsAppTemplate } from '@/lib/whatsapp-template'
import { normaliseIndianPhone } from '@/lib/marketing/whatsapp'
import {
  RECOVERY_DEFAULTS, RECOVERY_NOTICE_VERSION, RECOVERY_WINDOW_MS, RECOVERY_MAX_TOUCHES,
  RECOVERY_MIN_GAP_MS, recoverySettingsSchema, recoverySendWindow, buildRecoveryMessage,
  type RecoverySettings, type RecoveryFlow, type RecoveryCandidate, type RecoveryPreview,
  type RecoveryDashboard, type RecoveryProduct,
} from '@/lib/recovery-policy'

export const RECOVERY_COLLECTIONS={settings:'recovery_settings',deliveries:'recovery_deliveries',locks:'recovery_locks',suppressions:'recovery_suppressions'}
type RecordDoc=Document & {_id:string}
const collection=(name:string)=>getCollection<RecordDoc>(name)
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const secret=()=>process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ''
function origin():string {
  try { const url=new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '');return ['https:','http:'].includes(url.protocol)?url.origin:'' } catch {return ''}
}
export function recoveryReadiness() {
  return {email:['SMTP_HOST','SMTP_USER','SMTP_PASS','EMAIL_FROM'].every(k=>!!process.env[k]?.trim()),
    whatsapp:process.env.WHATSAPP_CAMPAIGNS_ENABLED==='true' && ['ASKEVA_API_KEY','ASKEVA_API_URL'].every(k=>!!process.env[k]?.trim()),
    cron:(process.env.CRON_SECRET || '').length>=16,origin:!!origin() && secret().length>=16}
}
export function recoveryUnsubscribeToken(identity:string,now=new Date()):string {
  if(secret().length<16)throw new Error('Recovery signing secret is not configured')
  const payload=Buffer.from(JSON.stringify({identity,exp:now.getTime()+90*86400000,purpose:'recovery-unsubscribe'})).toString('base64url')
  return `${payload}.${createHmac('sha256',secret()).update(payload).digest('base64url')}`
}
export function verifyRecoveryUnsubscribe(token:string,now=new Date()):string|null {
  if(secret().length<16 || token.length>600)return null
  const [payload,sig,extra]=token.split('.')
  if(!payload || !sig || extra)return null
  const expected=createHmac('sha256',secret()).update(payload).digest()
  const actual=Buffer.from(sig,'base64url')
  if(actual.length!==expected.length || !timingSafeEqual(actual,expected))return null
  try {const p=JSON.parse(Buffer.from(payload,'base64url').toString());return p.purpose==='recovery-unsubscribe' && typeof p.identity==='string' && /^c:[a-f0-9]{64}$/.test(p.identity) && p.exp>now.getTime()?p.identity:null} catch{return null}
}
export async function unsubscribeRecovery(token:string):Promise<boolean> {
  const identity=verifyRecoveryUnsubscribe(token)
  if(!identity)return false
  await (await collection(RECOVERY_COLLECTIONS.suppressions)).updateOne({_id:identity},{$set:{updatedAt:new Date(),reason:'Customer opted out of recovery reminders'}},{upsert:true})
  return true
}
export async function getRecoverySettings():Promise<RecoverySettings> {
  const doc=await (await collection(RECOVERY_COLLECTIONS.settings)).findOne({_id:'settings'})
  const parsed=recoverySettingsSchema.safeParse(doc?.settings)
  const settings=parsed.success?parsed.data:structuredClone(RECOVERY_DEFAULTS)
  // Apply the owner's new timing to existing saved settings without enabling a flow
  // or discarding approved templates, channels and later reminder delays.
  settings.payment.steps[0].delayMinutes=2
  return settings
}
export async function saveRecoverySettings(input:unknown,adminId:string):Promise<RecoverySettings> {
  const settings=recoverySettingsSchema.parse(input)
  settings.payment.steps[0].delayMinutes=2
  // Supporting indexes are created only by this explicit admin write, never by a preview.
  const deliveries=await collection(RECOVERY_COLLECTIONS.deliveries)
  await Promise.all([deliveries.createIndex({contactKey:1,createdAt:-1},{name:'recovery_contact_history'}),deliveries.createIndex({identity:1,createdAt:-1},{name:'recovery_identity_history'}),deliveries.createIndex({createdAt:-1},{name:'recovery_recent_history'})])
  await (await collection(RECOVERY_COLLECTIONS.settings)).updateOne({_id:'settings'},{$set:{settings,updatedAt:new Date(),updatedBy:adminId}},{upsert:true})
  return settings
}
type Lead=RecoveryCandidate & {queueContact:{name:string;email:string;phone:string};recoveryItems:NonNullable<FlowCustomer['recoveryItems']>;gatewayDisplay:FlowCustomer['gatewayDisplay'];contactKey:string;visitorIds:string[];productKey:string;databaseFailure:boolean;failureReference:string;failureSource:string;failureProductName:string;failureAmount:number|null;failureGateway:string;failureOrderId:string;failureEmail:string;failurePhone:string;failureReason:string;failureCheckoutBound:boolean}
function contactText(...values:unknown[]):string {
  for(const value of values){
    if(typeof value!=='string' && typeof value!=='number')continue
    const text=String(value).trim()
    if(text)return text
  }
  return ''
}
async function queueFallbackPhone(userId:string,account:Document|null):Promise<string> {
  const accountId=account?._id instanceof ObjectId?account._id.toHexString():contactText(account?._id)
  const ids=[...new Set([userId,accountId].filter(Boolean))]
  const owner={userId:{$in:[...ids,...ids.filter(id=>ObjectId.isValid(id)).map(id=>new ObjectId(id))]}}
  const hasPhone=(field:string)=>[{$regex:'\\S'},{$type:'number'}].map(condition=>({[field]:condition}))
  const address=await (await getCollection('user_addresses')).findOne(
    {...owner,$or:[...hasPhone('phone'),...hasPhone('mobile')]},
    {projection:{_id:0,phone:1,mobile:1},sort:{isDefault:-1,updatedAt:-1,createdAt:-1},maxTimeMS:3000},
  )
  const addressPhone=contactText(address?.phone,address?.mobile)
  if(addressPhone)return addressPhone
  const order=await (await getCollection('orders')).findOne(
    {...owner,$or:['customer.phone','customer.mobile','shippingAddress.phone','shippingAddress.mobile'].flatMap(hasPhone)},
    {projection:{_id:0,'customer.phone':1,'customer.mobile':1,'shippingAddress.phone':1,'shippingAddress.mobile':1},sort:{createdAt:-1},maxTimeMS:3000},
  )
  return contactText(order?.customer?.phone,order?.customer?.mobile,order?.shippingAddress?.phone,order?.shippingAddress?.mobile)
}
async function queueProductDetails(lead:Lead):Promise<NonNullable<RecoveryPreview['queueProducts']>> {
  let items:Document[]=lead.recoveryItems || []
  if(!items.length && !(lead.failureSource==='razorpay' && !lead.failureCheckoutBound)){
    if(lead.userId && lead.flow==='cart'){
      const owners=[lead.userId,...(ObjectId.isValid(lead.userId)?[new ObjectId(lead.userId)]:[])]
      const cart=await (await getCollection('carts')).findOne({userId:{$in:owners}},{projection:{items:1},maxTimeMS:3000})
      if(Array.isArray(cart?.items))items=cart.items
    }
    if(!items.length && lead.visitorIds.length){
      const snapshot=await (await getCollection('analytics_events')).findOne({event:'cart_snapshot',visitorId:{$in:lead.visitorIds},
        ...(lead.userId?{userId:lead.userId}:{}),
        ...(lead.flow==='payment'?{createdAt:{$lte:new Date(lead.anchorAt)}}:{})},
        {sort:{createdAt:-1},projection:{'params.items':1},maxTimeMS:3000})
      if(Array.isArray(snapshot?.params?.items))items=snapshot.params.items
    }
  }
  const itemId=(item:Document)=>contactText(item.productId,item.id,item.item_id)
  const ids=[...new Set([...lead.productIds,...items.map(itemId)].filter(Boolean))].slice(0,20)
  if(!ids.length)return []
  const objectIds=ids.filter(id=>ObjectId.isValid(id)).map(id=>new ObjectId(id))
  const query={$or:[{_id:{$in:[...objectIds,...ids]}},{id:{$in:ids}},{sku:{$in:ids}}]}
  const sources=await Promise.all(['products','software_products'].map(async name=>
    (await getCollection<Document & {_id:ObjectId|string}>(name)).find(query,
      {projection:{_id:1,id:1,name:1,title:1,sku:1,itemno:1,itemNo:1,raw:1},maxTimeMS:3000}).limit(40).toArray(),
  ))
  const products=sources.flat()
  return ids.flatMap(id=>{
    const product=products.find(p=>String(p._id)===id) || products.find(p=>p.id===id) || products.find(p=>p.sku===id)
    const lines=items.filter(item=>itemId(item)===id)
    const quantities=lines.map(item=>Number(item.quantity))
    const total=quantities.reduce((sum,quantity)=>sum+quantity,0)
    const quantity=quantities.length && quantities.every(q=>Number.isSafeInteger(q) && q>0) && Number.isSafeInteger(total)?total:null
    const metadata=product?normalizeProductForSchema(product):null
    return [{id,name:metadata?.name || contactText(product?.title,...lines.flatMap(item=>[item.name,item.item_name])) || (ids.length===1?lead.failureProductName:'') || 'Product',itemno:metadata?.itemno || '',quantity}]
  })
}
async function queueAccountContact(userId:string):Promise<Document|null> {
  const users=await getCollection<Document & {_id:ObjectId|string}>('users')
  const keys=[...(ObjectId.isValid(userId)?[{_id:new ObjectId(userId)}]:[]),{_id:userId},{id:userId}]
  for(const key of keys){
    const account=await users.findOne(key,{projection:{_id:1,name:1,email:1,phone:1,mobile:1,
      'address.phone':1,'address.mobile':1,'addresses.phone':1,'addresses.mobile':1,'addresses.isDefault':1,
      'shippingAddress.phone':1,'shippingAddress.mobile':1},maxTimeMS:3000})
    if(account)return account
  }
  return null
}
async function candidate(row:FlowCustomer,flow:RecoveryFlow):Promise<Lead|null> {
  const userId=row.id.startsWith('u:')?row.id.slice(2):null
  const anchorAt=flow==='payment'?row.paymentFailedAt:row.cartAt
  if(!anchorAt)return null
  const events=await getCollection('analytics_events')
  const visitorIds=userId?(await events.find({userId,visitorId:{$type:'string'}},{projection:{visitorId:1},maxTimeMS:3000}).sort({createdAt:-1}).limit(100).toArray()).map(e=>String(e.visitorId)):row.id.startsWith('v:')?[row.id.slice(2)]:row.recoveryVisitorId?[row.recoveryVisitorId]:[]
  // Explicit opt-in is bound to the details submitted with it. Later shipping/contact edits
  // must not silently redirect permission to a different recipient.
  const contactMatch=[...(row.email?[{'checkoutContext.email':row.email.toLowerCase()}]:[]),...(row.phone?[{'checkoutContext.phone':row.phone}]:[])]
  const consentEvent=userId || visitorIds.length || contactMatch.length?await events.findOne({event:'checkout_contact',...(userId?{userId}:visitorIds.length?{visitorId:{$in:visitorIds}}:{$or:contactMatch})},{sort:{createdAt:-1},projection:{recoveryConsent:1,checkoutContext:1}}):null
  const profile=userId?await (await getCollection('customer_profiles')).findOne({userId},{projection:{email:1,phone:1,mobile:1,name:1,consent:1,consentUpdatedAt:1}}):null
  // Queue details come from this account ID. They are display data, separate from
  // the exact recipient that opted into reminders at checkout.
  const account=flow==='cart' && userId?await queueAccountContact(userId):null
  const explicit=consentEvent?.recoveryConsent?.version===RECOVERY_NOTICE_VERSION
  const contact=explicit?consentEvent?.checkoutContext:profile || (flow==='payment'?row:null)
  const consent=explicit?{...consentEvent!.recoveryConsent}:profile?.consent
  if(explicit && profile?.consentUpdatedAt && +new Date(profile.consentUpdatedAt)>+new Date(consentEvent!.recoveryConsent.acceptedAt)) {
    for(const channel of ['email','whatsapp'])if(profile.consent?.[channel]!==true)consent[channel]=false
  }
  const email=String(contact?.email || '').trim().toLowerCase(),phone=(normaliseIndianPhone(String(contact?.phone || '')) || '').slice(-10)
  const queueContact={name:String(account?.name || row.name || contact?.name || 'Customer'),
    email:contactText(account?.email,profile?.email,row.email,consentEvent?.checkoutContext?.email,contact?.email),
    phone:contactText(account?.phone,account?.mobile,profile?.phone,profile?.mobile,row.phone,consentEvent?.checkoutContext?.phone,contact?.phone)}
  if(row.failureSource==='razorpay')Object.assign(queueContact,{name:contactText(contact?.name,profile?.name,row.name) || 'Customer',email:contactText(row.email,queueContact.email),phone:contactText(row.phone,queueContact.phone)})
  if(flow==='cart' && userId && !queueContact.phone){
    const addresses=Array.isArray(account?.addresses)?[...account.addresses].sort((a,b)=>Number(b.isDefault===true)-Number(a.isDefault===true)):[]
    queueContact.phone=contactText(account?.address?.phone,account?.address?.mobile,account?.shippingAddress?.phone,account?.shippingAddress?.mobile,
      ...addresses.flatMap(address=>[address?.phone,address?.mobile])) || await queueFallbackPhone(userId,account)
  }
  const productIds=(row.cartProductIds?.length?row.cartProductIds:row.productIds).filter(Boolean)
  const contactKey=`c:${hash(phone || email || row.id)}`
  return {identity:row.id,userId,visitorIds:[...new Set(visitorIds)],flow,anchorAt:new Date(anchorAt).toISOString(),name:String(contact?.name || row.name || 'there'),email,phone,queueContact,
    consent:{email:consent?.email===true,whatsapp:consent?.whatsapp===true},productIds,contactKey,productKey:hash([...productIds].sort().join('|')),
    databaseFailure:row.databaseFailure===true,failureReference:row.failureReference || '',failureSource:row.failureSource || '',failureProductName:row.failureProductName || '',failureAmount:row.paymentAmount ?? null,failureGateway:row.paymentGateway || '',
    failureOrderId:row.failureOrderId || '',failureEmail:row.email || '',failurePhone:row.phone || '',failureReason:row.failureReason || '',failureCheckoutBound:row.failureCheckoutBound!==false,recoveryItems:row.recoveryItems || [],gatewayDisplay:row.gatewayDisplay}
}
async function candidates(now:Date,page=1,onlyFlow?:RecoveryFlow,queueView=false) {
  const input={mode:'table',start:new Date(now.getTime()-RECOVERY_WINDOW_MS).toISOString(),end:now.toISOString(),limit:25,page,sort:'lastActivity',direction:'asc'}
  const rows:FlowCustomer[]=[];let total=0;let razorpay:RecoveryDashboard['razorpay']
  if(onlyFlow!=='cart'){
    const provider=await getRazorpayRecoveryFailures(new Date(input.start),now,page,25,queueView?100:25)
    rows.push(...provider.rows);total=provider.total;razorpay=provider.gateway
    const stored=await getDatabasePaymentFailures(new Date(input.start),now,page,25)
    for(const row of stored.rows)if(!rows.some(r=>r.id===row.id))rows.push(row)
    total=Math.max(total,stored.total)
  }
  for(const flow of (onlyFlow?[onlyFlow]:['payment','cart']) as RecoveryFlow[]) {
    const table=await getCustomerFlow(FlowQuery.parse({...input,stage:flow==='cart'?'cart':'payment_failed'})) as {rows:FlowCustomer[];total:number}
    total=Math.max(total,table.total)
    for(const row of table.rows)if(!rows.some(r=>r.id===row.id))rows.push(row)
  }
  const leads:Lead[]=[]
  for(const row of rows){const flow:RecoveryFlow=row.paymentFailedAt && (!row.cartAt || +new Date(row.paymentFailedAt)>=+new Date(row.cartAt))?'payment':'cart';if(onlyFlow && flow!==onlyFlow)continue;const lead=await candidate(row,flow);if(lead && !(flow==='payment' && await orderCreated(lead,now)) && !leads.some(l=>l.flow===lead.flow && l.contactKey===lead.contactKey))leads.push(lead)}
  return {leads,total,razorpay}
}
function buyer(lead:Lead):Document {
  const contacts:Document[]=[]
  for(const email of new Set([lead.email,...(lead.flow==='payment'?[lead.failureEmail]:[])].filter(Boolean))){
    const escaped=email.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    for(const field of ['customer.email','shippingAddress.email','email'])contacts.push({[field]:{$regex:`^\\s*${escaped}\\s*$`,$options:'i'}})
  }
  for(const value of new Set([lead.phone,...(lead.flow==='payment'?[lead.failurePhone]:[])].filter(Boolean))){
    const phone=normaliseIndianPhone(value)?.slice(-10)
    if(!phone)continue
    const pattern=`^[\\s().-]*(?:\\+?91[\\s().-]*)?${phone.split('').join('[\\s().-]*')}[\\s().-]*$`
    for(const field of ['customer.phone','customer.mobile','shippingAddress.phone','shippingAddress.mobile','phone','mobile'])contacts.push({[field]:{$regex:pattern}},{[field]:{$in:[Number(phone),Number(`91${phone}`)]}})
  }
  // A guest may finish buying on another device: consented contact matches suppress
  // reminders without exposing that other device's order to the admin queue.
  const matches=[...(lead.userId?[{userId:{$in:[lead.userId,...(ObjectId.isValid(lead.userId)?[new ObjectId(lead.userId)]:[])]}}]:[]),...(lead.visitorIds.length?[{journeyVisitorId:{$in:lead.visitorIds}}]:[]),...contacts]
  return matches.length?{$or:matches}:{_id:{$exists:false}}
}
async function orderCreated(lead:Lead,now:Date):Promise<boolean> {
  const orders=await getCollection('orders')
  return !!await orders.findOne({...buyer(lead),$and:[{$or:[
    {$expr:{$gte:[{$convert:{input:'$createdAt',to:'date',onError:null,onNull:null}},new Date(lead.anchorAt)]}},
    ...(lead.failureOrderId?[{'paymentDetails.orderId':lead.failureOrderId}]:[]),
    {createdAt:{$gte:new Date(now.getTime()-RECOVERY_WINDOW_MS)},$or:[{'items.id':{$in:lead.productIds}},{'items.productId':{$in:lead.productIds}}]},
  ]}]},{projection:{_id:1},maxTimeMS:3000})
}
async function stopReason(lead:Lead,now:Date,checkGateway=true):Promise<string> {
  if(await orderCreated(lead,now))return 'An order was created; reminders stopped'
  if(lead.failureSource==='razorpay'){
    if(checkGateway && !await razorpayFailureStillFailed(lead.failureReference,lead.failureOrderId))return 'Razorpay failure is resolved, pending, or could not be verified; reminders stopped'
  }else if(lead.databaseFailure && !await databaseFailureStillFailed(lead.failureSource,lead.failureReference))return 'The stored payment failure was resolved or is no longer failed'
  if(await (await collection(RECOVERY_COLLECTIONS.suppressions)).findOne({_id:lead.contactKey}))return 'Customer stopped recovery reminders'
  const intents=await getCollection<Document & {_id:string}>('checkout_intents')
  if(await intents.findOne({...buyer(lead),$and:[{$or:[{status:'verified'},{status:{$in:['created','pending']},expiresAt:{$gt:now},...(lead.failureSource==='razorpay'?{_id:{$ne:lead.failureOrderId}}:{})}]}]},{projection:{_id:1}}))return 'Payment is pending or verified; do not ask the customer to pay again'
  return ''
}
async function currentProduct(lead:Lead,now:Date):Promise<RecoveryProduct|null> {
  let ids:string[]=[]
  if(lead.userId){const cart=await (await getCollection('carts')).findOne({userId:lead.userId},{projection:{items:1}});ids=Array.isArray(cart?.items)?cart.items.map((i:Document)=>String(i.productId || i.id || '')):[]}
  else if(!lead.databaseFailure){const snapshot=await (await getCollection('analytics_events')).findOne({event:'cart_snapshot',visitorId:{$in:lead.visitorIds}},{sort:{createdAt:-1},projection:{productIds:1,createdAt:1}});if(!snapshot || +new Date(snapshot.createdAt)<now.getTime()-RECOVERY_WINDOW_MS)return null;ids=Array.isArray(snapshot.productIds)?snapshot.productIds:[]}
  const id=lead.productIds.find(id=>ids.includes(id)) || (lead.databaseFailure?lead.productIds[0]:undefined)
  if(!id)return null
  const priced=await priceCatalogueCart([{id,quantity:1}])
  if(!priced.ok || priced.items.length!==1)return null
  const item=priced.items[0],product=priced.catalogue.get(item.id)
  if(!product || !isPublicProduct(product) || item.type==='service')return null
  const account=lead.userId?await getAuthenticatedUserById(lead.userId):null
  if(lead.userId && (!account || !['user','admin','superadmin','vendor'].includes(account.role)))return null
  // Offer eligibility uses the actual account, not a shipping recipient's identity.
  const session:AuthSession|null=account?{user:{id:account.id,name:account.name,email:account.email,phone:account.phone,role:account.role as AuthSession['user']['role']}}:null
  const promotions=await getStorefrontPromotions(id,session)
  const promo=promotions.products.find(p=>p.id===item.id)
  let benefits=promo?.benefits || []
  if(benefits.some(b=>b.kind==='diwali') && await isDiwaliCustomerBlocked({email:lead.email,mobile:lead.phone,accountEmail:account?.email,accountMobile:account?.phone}))benefits=benefits.filter(b=>b.kind!=='diwali')
  const slug='slug' in product && typeof product.slug==='string' && product.slug?product.slug:item.id
  return {id:item.id,name:item.name,itemno:normalizeProductForSchema(product).itemno,price:item.price,href:`/product/${encodeURIComponent(slug)}`,offers:benefits.filter(o=>!o.expiresAt || +new Date(o.expiresAt)>now.getTime()).map(o=>({description:`${o.name}. ${o.description}`,expiresAt:o.expiresAt}))}
}
async function preview(lead:Lead,settings:RecoverySettings,now:Date,queueDetails=false):Promise<RecoveryPreview> {
  const deliveries=await (await collection(RECOVERY_COLLECTIONS.deliveries)).find({$or:[{contactKey:lead.contactKey},{identity:lead.identity}],createdAt:{$gte:new Date(now.getTime()-RECOVERY_WINDOW_MS)}},{projection:{status:1,createdAt:1,step:1}}).sort({createdAt:1}).limit(10).toArray()
  const count=deliveries.filter(d=>d.status!=='suppressed').length,step=count+1
  const result:RecoveryPreview={id:hash(`${lead.contactKey}:${lead.productKey}:${lead.anchorAt}:${step}`),identity:lead.identity,flow:lead.flow,name:lead.name,email:lead.email,phone:lead.phone,status:'blocked',reason:'',step:Math.min(step,3),dueAt:null,channel:null,product:null,message:null,sent:deliveries.filter(d=>d.status==='sent').length}
  if(lead.flow==='cart' || lead.failureSource==='razorpay')Object.assign(result,lead.queueContact)
  if(queueDetails)result.queueProducts=await queueProductDetails(lead)
  if(queueDetails && lead.gatewayDisplay){
    result.name=lead.gatewayDisplay.name || result.name
    result.email=result.email || lead.gatewayDisplay.email
    result.phone=result.phone || lead.gatewayDisplay.phone
    result.customerAddress=lead.gatewayDisplay.address
    result.failureItemCount=lead.gatewayDisplay.itemCount
  }
  if(lead.flow==='payment')Object.assign(result,{failureAt:lead.anchorAt,failureReference:lead.failureReference,failureSource:lead.failureSource || 'analytics_events',failureProductName:lead.failureProductName,failureAmount:lead.failureAmount,failureGateway:lead.failureGateway,failureReason:lead.failureReason})
  if(lead.databaseFailure)result.product=await currentProduct(lead,now)
  const blocked=async(reason:string)=>({...result,reason})
  if(count>=RECOVERY_MAX_TOUCHES)return blocked('Three reminder limit reached for this customer in 14 days')
  if(deliveries.some(d=>['sending','unknown','failed'].includes(d.status)))return blocked('A delivery needs review; automatic retries are paused to prevent duplicates')
  if(lead.failureSource==='razorpay' && !lead.failureCheckoutBound)return blocked('Razorpay failure loaded, but no matching local checkout exists; automatic reminders are paused')
  const stop=await stopReason(lead,now,!queueDetails);if(stop)return blocked(stop)
  if(!lead.consent.email && !lead.consent.whatsapp)return blocked('No recovery messaging opt-in; anonymous cart visitors cannot be contacted')
  if(lead.flow==='payment' && lead.failureGateway.toLowerCase()==='razorpay' && lead.failureSource!=='razorpay')return blocked('This stored Razorpay failure has not been verified in gateway data')
  const spec=settings[lead.flow].steps[step-1],ready=recoveryReadiness()
  for(const channel of settings.channels) {
    if(channel==='whatsapp' && ready.whatsapp && lead.consent.whatsapp && lead.phone && spec.templateApproved && spec.templateName)result.channel=channel
    if(channel==='email' && ready.email && lead.consent.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))result.channel=channel
    if(result.channel)break
  }
  if(!result.channel)return blocked('No configured, approved channel matches this customer’s opt-in')
  if(!ready.origin)return blocked('Website URL or signing secret is not configured')
  result.product=result.product || await currentProduct(lead,now)
  if(!result.product)return blocked('Cart is empty, snapshot is missing, or the product is unavailable')
  const unsubscribe=`${origin()}/recovery/unsubscribe?token=${recoveryUnsubscribeToken(lead.contactKey,now)}`
  result.message=buildRecoveryMessage(lead.flow,step,lead.name,result.product,origin(),unsubscribe,now)
  if(result.channel==='whatsapp' && result.message.bodyParams.some(text=>text.length>1024))return blocked('WhatsApp parameters exceed the provider limit; review the product or offer text')
  const last=deliveries.at(-1),due=Math.max(+new Date(lead.anchorAt)+spec.delayMinutes*60000,last?+new Date(last.createdAt)+RECOVERY_MIN_GAP_MS:0)
  result.dueAt=new Date(due).toISOString()
  if(!settings[lead.flow].enabled){result.status='paused';result.reason='This flow is disabled';return result}
  if(now.getTime()<due){result.status='scheduled';result.reason='Waiting for the next reminder time';return result}
  if(!recoverySendWindow(now,settings)){result.status='scheduled';result.reason='Waiting for permitted sending hours (IST)';return result}
  result.status='due';result.reason='Eligible for one reminder; order and consent will be checked again before dispatch'
  return result
}
export async function getRecoveryDashboard(now=new Date(),page=1):Promise<RecoveryDashboard> {
  const settings=await getRecoverySettings(),batch=await candidates(now,page,undefined,true),queue:RecoveryPreview[]=[]
  for(const lead of batch.leads)queue.push(await preview(lead,settings,now,true))
  const history=(await (await collection(RECOVERY_COLLECTIONS.deliveries)).find({},{projection:{name:1,flow:1,step:1,channel:1,status:1,createdAt:1,subject:1}}).sort({createdAt:-1}).limit(30).toArray()).map(d=>({id:d._id,name:String(d.name),flow:d.flow,step:d.step,channel:d.channel,status:d.status,createdAt:new Date(d.createdAt).toISOString(),subject:String(d.subject)}))
  return {settings,queue,history,readiness:recoveryReadiness(),generatedAt:now.toISOString(),truncated:page*25<batch.total,page,razorpay:batch.razorpay}
}
export async function runRecoveryAutomation(options:{dryRun?:boolean;flow?:RecoveryFlow;now?:Date}={}) {
  const dryRun=options.dryRun ?? true,now=options.now || new Date(),started=Date.now()
  const settings=await getRecoverySettings(),settingsCollection=await collection(RECOVERY_COLLECTIONS.settings)
  const cursorId=`cursor:${options.flow || 'all'}`
  const cursor=await settingsCollection.findOne({_id:cursorId}),page=Math.max(1,Number(cursor?.page)||1)
  const batch=await candidates(now,page,options.flow)
  const report={candidates:batch.leads.length,sent:0,failed:0,unknown:0,skipped:0,dryRun,due:0,page,completed:true}
  for(const lead of batch.leads) {
    if(Date.now()-started>40000){report.completed=false;break}
    const planned=await preview(lead,settings,now)
    if(planned.status!=='due'){report.skipped++;continue}
    report.due++
    if(dryRun)continue
    const locks=await collection(RECOVERY_COLLECTIONS.locks),owner=randomUUID()
    try {const lock=await locks.findOneAndUpdate({_id:lead.contactKey,expiresAt:{$lte:new Date()}},{$set:{owner,expiresAt:new Date(Date.now()+120000)}},{upsert:true,returnDocument:'after'});if(lock?.owner!==owner){report.skipped++;continue}} catch(error) {if((error as {code?:number}).code===11000){report.skipped++;continue}throw error}
    try {
      // Fresh consent/contact, suppression, order, price and offers; never dispatch a saved preview.
      const refreshed=await candidate({id:lead.identity,cartAt:lead.flow==='cart'?lead.anchorAt:null,paymentFailedAt:lead.flow==='payment'?lead.anchorAt:null,cartProductIds:lead.productIds,productIds:lead.productIds,name:lead.name,email:lead.flow==='payment'?lead.failureEmail || lead.email:lead.email,phone:lead.flow==='payment'?lead.failurePhone || lead.phone:lead.phone,
        databaseFailure:lead.databaseFailure,recoveryVisitorId:lead.visitorIds[0] || '',failureReference:lead.failureReference,failureSource:lead.failureSource,failureProductName:lead.failureProductName,paymentAmount:lead.failureAmount,paymentGateway:lead.failureGateway,failureOrderId:lead.failureOrderId,failureReason:lead.failureReason,failureCheckoutBound:lead.failureCheckoutBound} as FlowCustomer,lead.flow)
      if(!refreshed || refreshed.contactKey!==lead.contactKey){report.skipped++;continue}
      const fresh=await preview(refreshed,await getRecoverySettings(),options.now || new Date())
      if(fresh.status!=='due' || !fresh.message || !fresh.channel){report.skipped++;continue}
      const ledger=await collection(RECOVERY_COLLECTIONS.deliveries)
      try {await ledger.insertOne({_id:fresh.id,userId:lead.userId,contactKey:lead.contactKey,identity:lead.identity,flow:lead.flow,step:fresh.step,channel:fresh.channel,status:'sending',name:lead.name,subject:fresh.message.subject,productId:fresh.product!.id,createdAt:options.now || new Date(),updatedAt:new Date()})} catch(error) {if((error as {code?:number}).code===11000){report.skipped++;continue}throw error}
      // Last cancellation gate after reservation, immediately before the provider call.
      const stop=await stopReason(refreshed,options.now || new Date())
      if(stop){await ledger.updateOne({_id:fresh.id},{$set:{status:'suppressed',reason:stop,updatedAt:new Date()}});report.skipped++;continue}
      const spec=fresh.channel==='whatsapp'?(await getRecoverySettings())[lead.flow].steps[fresh.step-1]:null
      // Gateway lookups and settings reads may take time. Check orders again after
      // those awaits, directly before handing the message to either provider.
      if(await orderCreated(refreshed,options.now || new Date())){
        await ledger.updateOne({_id:fresh.id},{$set:{status:'suppressed',reason:'An order was created; reminders stopped',updatedAt:new Date()}})
        report.skipped++;continue
      }
      let status:'sent'|'failed'|'unknown'='unknown'
      try {
        if(fresh.channel==='whatsapp') {
          const response=await sendWhatsAppTemplate(refreshed.phone,{name:spec!.templateName,language:{policy:'deterministic',code:'en'},components:[{type:'body',parameters:fresh.message.bodyParams.map(text=>({type:'text',text}))}]},undefined,'Recovery')
          status=response.success?'sent':response.deliveryUnknown?'unknown':'failed'
        } else {
          const response=await getEmailTransport().sendMail({from:process.env.EMAIL_FROM!,to:refreshed.email,subject:fresh.message.subject,text:fresh.message.text,html:fresh.message.html,
            headers:{'List-Unsubscribe':`<${origin()}/recovery/unsubscribe?token=${recoveryUnsubscribeToken(lead.contactKey)}>`}})
          status=response.accepted?.length?'sent':response.rejected?.length?'failed':'unknown'
        }
      } catch {status='unknown'}
      await ledger.updateOne({_id:fresh.id},{$set:{status,updatedAt:new Date()}})
      report[status==='sent'?'sent':status==='failed'?'failed':'unknown']++
    } finally {await locks.updateOne({_id:lead.contactKey,owner},{$set:{expiresAt:new Date(0)}})}
  }
  // Rotate bounded pages so old blocked visitors do not starve newer candidates.
  if(!dryRun && report.completed)await settingsCollection.updateOne({_id:cursorId},{$set:{page:page*25>=batch.total?1:page+1,updatedAt:new Date()}},{upsert:true})
  return report
}
