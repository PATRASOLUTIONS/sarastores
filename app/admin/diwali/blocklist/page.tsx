import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DiwaliBlocklist from '@/components/diwali/DiwaliBlocklist'

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login?redirect=/admin/diwali/blocklist')
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') redirect('/admin/diwali')
  return <DiwaliBlocklist />
}
