"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, ChevronRight, Loader2, RefreshCw, Search, Menu, X } from "lucide-react"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import { apiFetchJson } from "@/lib/api-client"

type NotificationItem = {
  id: string
  label: string
  description: string
  count: number
  href: string
  tone: "amber" | "blue" | "red"
}

type NotificationResponse = { items: NotificationItem[]; total: number }

export function AdminHeader({ toggleSidebar, isSidebarOpen }: { toggleSidebar: () => void; isSidebarOpen: boolean }) {
  const { user } = useAdminAuth()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationResponse | null>(null)
  const [notificationsError, setNotificationsError] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const loadNotifications = async () => {
    setNotificationsLoading(true)
    setNotificationsError(false)
    try {
      setNotifications(await apiFetchJson<NotificationResponse>("/api/admin/notifications"))
    } catch {
      setNotificationsError(true)
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

  useEffect(() => {
    if (!isNotificationsOpen) return
    const close = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) setIsNotificationsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsNotificationsOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [isNotificationsOpen])

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 md:hidden">
            <button
              onClick={toggleSidebar}
              className="-ml-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
            >
              {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          <div
            onClick={() => router.push("/")}
            role="link"
            aria-label="Go to homepage"
            className="ml-2 md:ml-0 text-lg font-semibold text-gray-800 md:text-xl cursor-pointer"
          >
            {isSearchOpen ? null : "Admin Dashboard"}
          </div>
        </div>

        <div className={`${isSearchOpen ? "flex-1 mx-2" : "hidden md:flex md:flex-1"} max-w-md ml-4`}>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-maroon-500 focus:border-maroon-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!isSearchOpen && (
            <button
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open search"
              className="md:hidden flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              <Search className="h-6 w-6" />
            </button>
          )}

          {isSearchOpen && (
            <button onClick={() => setIsSearchOpen(false)} aria-label="Close search" className="md:hidden flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
              Cancel
            </button>
          )}

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label="View notifications"
              aria-haspopup="dialog"
              aria-expanded={isNotificationsOpen}
              onClick={() => setIsNotificationsOpen((open) => !open)}
              className="relative flex h-10 w-10 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f2557]"
            >
              <Bell className="h-5 w-5" />
              {(notifications?.total || 0) > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
                  {notifications!.total > 99 ? "99+" : notifications!.total}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div role="dialog" aria-label="Admin notifications" className="fixed inset-x-3 top-16 z-50 overflow-hidden border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-950">Notifications</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Work that needs attention</p>
                  </div>
                  <button type="button" title="Refresh notifications" disabled={notificationsLoading} onClick={() => void loadNotifications()} className="flex h-9 w-9 items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${notificationsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="max-h-[min(65vh,440px)] overflow-y-auto">
                  {notificationsLoading && !notifications ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading notifications</div>
                  ) : notificationsError ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm font-semibold text-slate-800">Notifications could not load</p>
                      <button type="button" onClick={() => void loadNotifications()} className="mt-3 text-sm font-bold text-[#0f2557] hover:underline">Try again</button>
                    </div>
                  ) : !notifications?.items.length ? (
                    <div className="px-5 py-10 text-center">
                      <span className="mx-auto flex h-10 w-10 items-center justify-center bg-emerald-50 text-emerald-700"><Bell className="h-5 w-5" /></span>
                      <p className="mt-3 text-sm font-bold text-slate-900">You are all caught up</p>
                      <p className="mt-1 text-xs text-slate-500">No operational alerts right now.</p>
                    </div>
                  ) : notifications.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => { setIsNotificationsOpen(false); router.push(item.href) }}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <span className={`flex h-10 min-w-10 items-center justify-center text-sm font-bold ${item.tone === "red" ? "bg-red-50 text-red-700" : item.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{item.count > 99 ? "99+" : item.count}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <img
              className="h-8 w-8 rounded-full"
              src="https://placehold.co/32x32/222222/FFFFFF?text=A"
              alt="User avatar"
            />
            <span className="ml-2 text-gray-700 font-medium hidden md:block">{user?.name || "Admin User"}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AdminHeader
