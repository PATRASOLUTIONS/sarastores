import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import IndexNowSettings from '@/components/admin/IndexNowSettings'

export default async function Page() {
  const session = await getSession()
  if (!session || !['admin', 'superadmin'].includes(session.user.role)) redirect('/admin')
  return <IndexNowSettings />
}
