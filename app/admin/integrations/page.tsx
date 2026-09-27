"use client"

import Link from 'next/link'
import { INTEGRATIONS } from '@/lib/integrations'

export default function AdminIntegrationsIndex() {
  const sorted = [...INTEGRATIONS].sort((a, b) => {
    if (a.status === 'connected' && b.status !== 'connected') return -1
    if (b.status === 'connected' && a.status !== 'connected') return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">Connect external services and third-party integrations. Connected integrations are shown first.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((intg) => (
          <article key={intg.id} className="group bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow p-4 flex flex-col h-full">
            <header className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 group-hover:text-maroon-600">{intg.name}</h2>
                {intg.description && <p className="text-sm text-gray-600 mt-1">{intg.description}</p>}
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${intg.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  {intg.status === 'connected' ? 'Connected' : 'Not configured'}
                </span>
              </div>
            </header>

            <div className="mt-4 mt-auto flex items-center gap-2">
              {intg.available ? (
                <Link href={intg.path} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Open</Link>
              ) : (
                <span className="px-3 py-2 border rounded text-sm text-gray-400">No admin page yet</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
