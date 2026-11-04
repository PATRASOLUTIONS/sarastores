import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DiwaliEmailNotifications from '@/components/diwali/DiwaliEmailNotifications'

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login?redirect=/admin/diwali/notifications')
  if (!['admin', 'superadmin'].includes(session.user.role)) redirect('/admin/diwali')
  return <DiwaliEmailNotifications />
}
