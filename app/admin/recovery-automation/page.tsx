import { redirect } from 'next/navigation'
import { requireFullAdmin } from '@/lib/auth'
import { pageMetadata } from '@/lib/seo-page'
import RecoveryAutomation from './recovery-automation'
export const generateMetadata=pageMetadata({path:'/admin/recovery-automation',title:'Sales Recovery',description:'Private cart and payment recovery controls.',noIndex:true})
export default async function Page(){const guard=await requireFullAdmin();if(!guard.ok)redirect('/admin/dashboard');return <RecoveryAutomation/>}
