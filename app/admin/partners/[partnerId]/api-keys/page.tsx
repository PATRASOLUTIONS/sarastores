"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, use } from "react"
import { 
  ArrowLeft, 
  Key,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react"
import Link from "next/link"
import { toast } from "react-hot-toast"

interface APIKey {
  id: string;

  key?: string;
  prefix: string;
  tier: string;
  permissions: string[];
  environment: 'live' | 'test';
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  hasFullKey?: boolean;
}

interface Partner {
  id: string;
  name: string;
  tier: string;
}

export default function PartnerAPIKeysPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = use(params)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newKeyData, setNewKeyData] = useState<{ key: string; environment: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    fetchData()
  }, [partnerId])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch partner details
      const partnerRes = await apiFetch(`/api/admin/partners/${partnerId}`)
      const partnerData = await partnerRes.json()
      if (partnerData.success) {
        setPartner(partnerData.data.partner)
      }

      // Fetch API keys
      const keysRes = await apiFetch(`/api/admin/partners/${partnerId}/api-keys`)
      const keysData = await keysRes.json()
      if (keysData.success) {
        setApiKeys(keysData.data.apiKeys || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateKey = async (environment: 'live' | 'test') => {
    setIsGenerating(true)
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment }),
      })
      
      const data = await response.json()
      if (data.success) {
        setNewKeyData({ key: data.data.apiKey.key, environment })
        fetchData()
        toast.success('API key generated successfully')
      } else {
        toast.error(data.error?.message || 'Failed to generate API key')
      }
    } catch (error) {
      toast.error('Failed to generate API key')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone. Any applications using this key will stop working.')) {
      return
    }
    
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/api-keys?keyId=${keyId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success('API key revoked successfully')
        fetchData()
      } else {
        toast.error(data.error?.message || 'Failed to revoke API key')
      }
    } catch (error) {
      toast.error('Failed to revoke API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/partners/${partnerId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-600 mt-1">
            Manage API keys for {partner?.name || 'Partner'}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Generate Key Section */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate New API Key</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleGenerateKey('test')}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Generate Test Key
          </button>
          <button
            onClick={() => handleGenerateKey('live')}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Generate Live Key
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Test keys work in sandbox mode. Live keys are for production use.
        </p>
      </div>

      {/* New Key Display */}
      {newKeyData && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-800">
                New {newKeyData.environment === 'live' ? 'Live' : 'Test'} API Key Generated
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Copy this key now! For security reasons, it won't be shown again.
              </p>
              <div className="flex items-center gap-2 bg-white p-4 rounded-lg border border-yellow-300 mt-4">
                <code className="flex-1 break-all font-mono text-sm">{newKeyData.key}</code>
                <button
                  onClick={() => copyToClipboard(newKeyData.key)}
                  className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
                  title="Copy to clipboard"
                >
                  <Copy className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <button
                onClick={() => setNewKeyData(null)}
                className="mt-4 text-sm text-yellow-700 hover:underline"
              >
                I've copied the key, dismiss this message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Existing API Keys</h3>
        </div>
        
        {apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Key className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No API keys yet</p>
            <p className="text-sm mt-1">Generate a key to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Environment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded break-all max-w-md">
                          {key.hasFullKey && key.key ? key.key : `${key.prefix}...`}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.hasFullKey && key.key ? key.key : key.prefix)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 flex-shrink-0"
                          title={key.hasFullKey ? "Copy full key" : "Copy prefix"}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {key.hasFullKey && (
                        <p className="text-xs text-green-600 mt-1">✓ Full key available</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        key.environment === 'live' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {key.environment === 'live' ? (
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        ) : (
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        )}
                        {key.environment.charAt(0).toUpperCase() + key.environment.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {key.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <Trash2 className="h-3 w-3" />
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(key.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {key.lastUsedAt ? (
                        new Date(key.lastUsedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      ) : (
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Never
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {key.status === 'active' && (
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* API Key Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-2">API Key Usage</h4>
        <p className="text-sm text-blue-800 mb-4">
          Partners use API keys to authenticate requests. Include the key in the Authorization header:
        </p>
        <code className="block bg-white p-4 rounded-lg text-sm font-mono text-blue-900 border border-blue-200">
          Authorization: Bearer sk_live_ptnr_xxxxx...
        </code>
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm text-blue-800 mb-3">
            Share the integration documentation with partners:
          </p>
          <a
            href="/partner-api-docs"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            View Partner API Documentation
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
