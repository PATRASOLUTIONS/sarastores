import { redirect } from 'next/navigation'
import { requireFullAdmin } from '@/lib/auth'
import { pageMetadata } from '@/lib/seo-page'
import PageFlowCanvas from './page-flow-canvas'
export const generateMetadata=pageMetadata({path:'/admin/page-flow',title:'Page Flow',description:'Private Google Analytics page visitor explorer.',noIndex:true})
export default async function PageFlowPage() {
  const guard=await requireFullAdmin()
  if(!guard.ok)redirect('/admin/dashboard')
  return <PageFlowCanvas />
}
