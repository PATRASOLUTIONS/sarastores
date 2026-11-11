import { z } from 'zod'

export const RECOVERY_NOTICE_VERSION = 'checkout-recovery-2026-11-10'
export const recoveryConsentSchema = z.object({ email:z.boolean(),whatsapp:z.boolean(),version:z.literal(RECOVERY_NOTICE_VERSION) }).strict()
export type RecoveryFlow = 'cart' | 'payment'
export type RecoveryChannel = 'email' | 'whatsapp'
const stepSchema=z.object({ delayMinutes:z.number().int().min(2).max(10080),templateName:z.string().trim().max(100).regex(/^[a-z0-9_]*$/),templateApproved:z.boolean() }).strict()
const flowSchema=z.object({enabled:z.boolean(),steps:z.array(stepSchema).length(3)}).strict().refine(v=>v.steps.every((s,i)=>!i || s.delayMinutes>v.steps[i-1].delayMinutes),'Reminder delays must increase')
export const recoverySettingsSchema=z.object({
  channels:z.array(z.enum(['whatsapp','email'])).min(1).max(2).transform(v=>[...new Set(v)]),
  quietStart:z.number().int().min(0).max(23),quietEnd:z.number().int().min(0).max(23),
  cart:flowSchema,payment:flowSchema,
}).strict().refine(v=>v.quietStart<v.quietEnd,'Sending hours must start before they end')
export type RecoverySettings=z.infer<typeof recoverySettingsSchema>
export const RECOVERY_DEFAULTS:RecoverySettings={
  channels:['whatsapp','email'],quietStart:9,quietEnd:20,
  cart:{enabled:false,steps:[60,1440,2880].map((delayMinutes,i)=>({delayMinutes,templateName:`sara_cart_recovery_${i+1}`,templateApproved:false}))},
  payment:{enabled:false,steps:[2,1440,2880].map((delayMinutes,i)=>({delayMinutes,templateName:`sara_payment_recovery_${i+1}`,templateApproved:false}))},
}
export type RecoveryProduct={id:string;name:string;itemno?:string;price:number;href:string;offers:{description:string;expiresAt:string|null}[]}
export type RecoveryMessage={subject:string;text:string;html:string;cta:string;url:string;offerText:string;deadlineText:string;bodyParams:string[]}
export type RecoveryCandidate={
  identity:string;flow:RecoveryFlow;anchorAt:string;name:string;email:string;phone:string;
  productIds:string[];userId:string|null;consent:{email:boolean;whatsapp:boolean};
}
export type RecoveryPreview={
  id:string;identity:string;flow:RecoveryFlow;name:string;email:string;phone:string;
  status:string;reason:string;step:number;dueAt:string|null;channel:RecoveryChannel|null;
  product:RecoveryProduct|null;message:RecoveryMessage|null;sent:number;
  queueProducts?:{id:string;name:string;itemno:string;quantity:number|null}[];
  customerAddress?:string;failureItemCount?:number|null;
  failureAt?:string;failureReference?:string;failureSource?:string;failureProductName?:string;failureAmount?:number|null;failureGateway?:string;failureReason?:string;
}
export type RecoveryDashboard={settings:RecoverySettings;queue:RecoveryPreview[];history:{id:string;name:string;flow:RecoveryFlow;step:number;channel:RecoveryChannel;status:string;createdAt:string;subject:string}[];
  readiness:{email:boolean;whatsapp:boolean;whatsappConfigured:boolean;whatsappEnabled:boolean;whatsappMissing:string[];cron:boolean;origin:boolean};generatedAt:string;truncated:boolean;page?:number;
  razorpay?:{status:'connected'|'not_configured'|'error';message:string;fetchedAt:string|null;hasMore:boolean;scanned?:number;failed?:number}}
export const RECOVERY_MAX_TOUCHES=3
export const RECOVERY_WINDOW_MS=14*86400000
export const RECOVERY_MIN_GAP_MS=20*3600000
export function recoverySendWindow(now:Date,settings:RecoverySettings):boolean {
  const hour=new Date(now.getTime()+330*60000).getUTCHours()
  return hour>=settings.quietStart && hour<settings.quietEnd
}
const money=(price:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(price)
const html=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function buildRecoveryMessage(flow:RecoveryFlow,step:number,name:string,product:RecoveryProduct,origin:string,unsubscribeUrl:string,now:Date):RecoveryMessage {
  const first=name.trim().split(/\s+/)[0] || 'there'
  const offers=product.offers.filter(o=>!o.expiresAt || Date.parse(o.expiresAt)>now.getTime()).slice(0,3)
  const deadline=offers.flatMap(o=>o.expiresAt?[o.expiresAt]:[]).sort()[0]
  const ending=deadline && Date.parse(deadline)<=now.getTime()+48*3600000
  const deadlineText=deadline?`The earliest listed offer ends ${new Date(deadline).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})} IST. Offers apply only while eligible stock is available.`:'No confirmed offer deadline is available. Prices and availability can change; the final price and eligibility are checked at checkout.'
  const offerText=offers.length?offers.map(o=>o.description).join(' '):'No additional verified offer is available right now. You can review the current price before deciding.'
  const url=new URL(product.href,origin);url.searchParams.set('utm_source','sara_recovery');url.searchParams.set('utm_medium','reminder');url.searchParams.set('utm_campaign',`${flow}_${step}`)
  const subject=flow==='cart'
    ? [ `${first}, ready to make ${product.name} yours?`, `Your current price and offers for ${product.name}`, ending?`An offer for ${product.name} is ending soon`:`One last reminder about ${product.name}` ][step-1]
    : [ `Need help finishing your ${product.name} purchase?`, `Your ${product.name} checkout options are still here`, ending?`Last reminder: review your ${product.name} offer`:`Your final checkout reminder for ${product.name}` ][step-1]
  const intro=flow==='cart'
    ? [ `You added ${product.name} to your cart. Would you like to complete your purchase?`, `Still considering ${product.name}? Here is the current price and the offers you can review today.`, `This is our last reminder about ${product.name}. Take a look at the latest price${ending?' before the listed offer ends':''}.` ][step-1]
    : [ `Your checkout for ${product.name} did not complete. If you still want it, review your order and choose an available payment method.`, `We would be happy to help you finish purchasing ${product.name}. Review the current price and any eligible offers before you continue.`, `This is our final reminder to complete your ${product.name} purchase, if you still want it${ending?' before the listed offer ends':''}.` ][step-1]
  const safety=flow==='payment'?'If money was deducted or payment is still pending, check your order status or contact Sara before trying again.':''
  const cta=flow==='cart'?'Review product and buy':'Review product and checkout'
  const text=`Hi ${first},\n\n${intro}\n\nCurrent price: ${money(product.price)} per item.\n${step>1?`${offerText}\n${deadlineText}\n`:''}${safety?`\n${safety}\n`:''}\n${cta}: ${url}\n\nAlready placed your order? You are all set. You do not need to purchase again. Need help? Reply to this message or contact Sara Stores.\nStop recovery reminders: ${unsubscribeUrl}`
  const body=`<h1 style="font-size:24px;color:#0f2557">${html(subject)}</h1><p>Hi ${html(first)},</p><p>${html(intro)}</p><p><strong>Current price: ${html(money(product.price))} per item</strong></p>${step>1?`<p>${html(offerText)}</p><p>${html(deadlineText)}</p>`:''}${safety?`<p>${html(safety)}</p>`:''}<p><a href="${html(String(url))}" style="display:inline-block;padding:14px 20px;background:#0f2557;color:white;text-decoration:none;border-radius:8px">${html(cta)}</a></p><p>Already ordered? You do not need to purchase again. Need help? Reply to this email.</p><p style="font-size:12px;color:#64748b"><a href="${html(unsubscribeUrl)}">Stop recovery reminders</a></p>`
  return {subject,text,html:`<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;padding:28px;background:white;border-radius:12px"><p style="color:#ff6a2c;font-weight:bold">SARA STORES</p>${body}</main></body></html>`,cta,url:String(url),offerText,deadlineText,
    // Six parameters; approved WhatsApp copy must also contain the opt-out URL.
    bodyParams:[first,product.name,money(product.price),step>1?offerText:intro,step>1?deadlineText:safety || 'Review the product and current availability before checkout.',`${url} Stop reminders: ${unsubscribeUrl}`].map(value=>value.replace(/\s+/g,' ').trim())}
}
