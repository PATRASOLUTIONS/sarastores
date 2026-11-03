import type { ReactNode } from 'react'
import { getSession } from '@/lib/auth'
import { getConfig, accessFor } from '@/lib/diwali/service'
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession(); if (!session) redirect('/login?redirect=/admin/diwali');
  try { accessFor(session.user, await getConfig()) } catch { redirect('/admin') }
  return children
}

