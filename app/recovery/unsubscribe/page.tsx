import { unsubscribeRecovery, verifyRecoveryUnsubscribe } from '@/lib/recovery-automation'
import { redirect } from 'next/navigation'
export const dynamic='force-dynamic'
export const metadata={title:'Stop recovery reminders | Sara Stores',robots:{index:false,follow:false},referrer:'no-referrer' as const}
async function stop(form:FormData){'use server';const token=String(form.get('token') || '');const ok=await unsubscribeRecovery(token);redirect(`/recovery/unsubscribe?result=${ok?'stopped':'invalid'}`)}
export default async function Page({searchParams}:{searchParams:Promise<{token?:string;result?:string}>}){
  const q=await searchParams,valid=q.token && verifyRecoveryUnsubscribe(q.token)
  return <main className="mx-auto my-16 max-w-lg rounded-xl border bg-white p-8"><h1 className="mb-4 text-2xl font-semibold">Recovery reminders</h1>{q.result==='stopped'?<p>You have stopped cart and payment recovery reminders. Your order updates are unaffected.</p>:valid?<><p className="mb-6">Stop Sara’s cart and unfinished-payment reminders for this contact?</p><form action={stop}><input type="hidden" name="token" value={q.token}/><button className="rounded-lg bg-blue-900 px-5 py-3 text-white">Stop reminders</button></form></>:<p>This reminder link is invalid or expired. Contact Sara Stores if you need help.</p>}</main>
}
