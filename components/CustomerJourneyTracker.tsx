'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { track } from '@/lib/analytics'
import { CONSENT_CHANGE_EVENT, hasConsent } from '@/lib/consent-client'
/** Storefront-only route milestones. No recording before analytics consent. */
export default function CustomerJourneyTracker() {
  const path = usePathname(), { user,isLoading } = useAuth(), last = useRef('')
  useEffect(()=>{
    const record = () => {
      if (!path || isLoading || /^\/(admin|dashboard|vendor|api)(\/|$)/.test(path) || !hasConsent('analytics')) return
      const key = `${path}:${user?.id || 'guest'}`
      if(last.current === key)return
      last.current=key
      track('page_view')
      if(/^\/(products|categories|category|brands|brand|search)(\/|$)/.test(path))track('browse_products')
      if(path === '/checkout') {
        if(!user)track('guest_checkout')
        track('begin_checkout')
      }
    }
    record();window.addEventListener(CONSENT_CHANGE_EVENT,record)
    return ()=>window.removeEventListener(CONSENT_CHANGE_EVENT,record)
  },[path,user?.id,isLoading,user])
  return null
}
