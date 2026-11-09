import { redirect } from 'next/navigation'
import { requireFullAdmin } from '@/lib/auth'
import { pageMetadata } from '@/lib/seo-page'
import CustomerFlowCanvas from './customer-flow-canvas'
export const generateMetadata = pageMetadata({ path:'/admin/customer-flow',title:'Customer Flow',description:'Private customer journey explorer.',noIndex:true })
export default async function CustomerFlowPage() {
  const guard = await requireFullAdmin()
  if (!guard.ok) redirect('/admin/dashboard')
  return <CustomerFlowCanvas />
}
