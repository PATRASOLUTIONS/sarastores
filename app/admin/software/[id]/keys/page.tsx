'use client'

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Plus, Download, Ban, Copy, Check, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

interface LicenseKey {
  _id: string
  key: string
  status: string
  validityYears: number
  maxDevices: number
  assignedTo?: {
    customerName: string
    customerEmail: string
    orderNumber: string
  }
  assignedAt?: string
  expiresAt?: string
}

export default function LicenseKeysPage() {
  const params = useParams()
  const router = useRouter()
  const [keys, setKeys] = useState<LicenseKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingKey, setDeletingKey] = useState<{id: string, isAssigned: boolean} | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingKey, setEditingKey] = useState<LicenseKey | null>(null)
  const [newValidity, setNewValidity] = useState(1)
  const [newMaxDevices, setNewMaxDevices] = useState(1)
  const [bulkKeys, setBulkKeys] = useState('')
  const [selectedValidity, setSelectedValidity] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [maxDevices, setMaxDevices] = useState<number>(1)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null)
  const [showRevokeModal, setShowRevokeModal] = useState(false)
  const [revokeTargetKey, setRevokeTargetKey] = useState<LicenseKey | null>(null)
  const [revokePassword, setRevokePassword] = useState<string>('')
  const [isRevoking, setIsRevoking] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const response = await apiFetch(`/api/software/license-keys?softwareId=${params.id}`)
      const data = await response.json()
      if (data.success) {
        setKeys(data.keys)
      }
    } catch (error) {
      console.error('Error fetching keys:', error)
      toast.error('Failed to load license keys')
    } finally {
      setLoading(false)
    }
  }

  const addKeys = async () => {
    const keyLines = bulkKeys.trim().split('\n').filter(line => line.trim())
    
    if (keyLines.length === 0) {
      toast.error('Please enter at least one license key')
      return
    }

    try {
      const keysToAdd = keyLines.map(key => ({
        key: key.trim(),
        validityYears: selectedValidity,
        maxDevices: maxDevices || 1
      }))

      const response = await apiFetch('/api/software/license-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          softwareId: params.id,
          keys: keysToAdd
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add keys')
      }

      if (data.success) {
        toast.success(`${keysToAdd.length} license key(s) added successfully`)
        setBulkKeys('')
        setShowAddModal(false)
        // Force refresh the keys list with a small delay to ensure the database has updated
        setTimeout(() => {
          fetchKeys()
        }, 500)
      } else {
        throw new Error(data.error || 'Failed to add keys')
      }
    } catch (error: any) {
      console.error('Error adding keys:', error)
      toast.error(error.message || 'Failed to add keys')
    }
  }

  const revokeKey = async (keyId: string, password?: string) => {
    if (!password) {
      toast.error('Password is required to revoke a key')
      return false
    }

    try {
      setIsRevoking(true)
      const response = await apiFetch('/api/software/license-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId,
          action: 'revoke',
          reason: 'Revoked by admin',
          password
        })
      })

      const data = await response.json()

      if (response.status === 401) {
        toast.error('Invalid admin password')
        setIsRevoking(false)
        return false
      }

      if (data.success) {
        toast.success('License key revoked')
        await fetchKeys()
        setIsRevoking(false)
        return true
      } else {
        toast.error(data.error || 'Failed to revoke key')
        setIsRevoking(false)
        return false
      }
    } catch (error) {
      console.error('Error revoking key:', error)
      toast.error('Failed to revoke key')
      setIsRevoking(false)
      return false
    }
  }

  const openRevokeModal = (key: LicenseKey) => {
    setRevokeTargetKey(key)
    setRevokePassword('')
    setShowRevokeModal(true)
  }

  const openDeleteModal = (keyId: string, isAssigned: boolean) => {
    console.log('Opening delete modal for key:', { keyId, isAssigned });

    console.log('Current keys:', keys.find(k => k._id === keyId));
    setDeletingKey({ id: keyId, isAssigned });
    setShowDeleteModal(true);
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setDeletingKey(null)
    setIsDeleting(false)
  }

  const deleteKey = async () => {
    if (!deletingKey) {
      console.error('No key selected for deletion');
      return;
    }
    
    const { id, isAssigned } = deletingKey;
    console.log('Deleting key:', { id, isAssigned });
    
    if (isAssigned) {
      const errorMsg = 'Cannot delete an assigned license key';
      console.error(errorMsg);
      toast.error(errorMsg);
      closeDeleteModal();
      return;
    }

    setIsDeleting(true);
    console.log('Sending delete request for key ID:', id);

    try {
      const response = await apiFetch(`/api/software/license-keys/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin'
      });

      console.log('Delete response status:', response.status);
      
      let data;
      try {
        data = await response.json();
        console.log('Delete response data:', data);
      } catch (jsonError) {
        const errorMsg = 'Error parsing server response';
        console.error(errorMsg, { status: response.status, statusText: response.statusText, jsonError });
        throw new Error(`${errorMsg}: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        const errorMsg = data?.error || `Server returned ${response.status}: ${response.statusText}`;
        console.error('Delete failed:', errorMsg);
        throw new Error(errorMsg);
      }

      if (data.success) {
        console.log('Key deleted successfully, refreshing list...');
        toast.success('License key deleted successfully');
        await fetchKeys(); // Wait for the keys to refresh
        closeDeleteModal();
      } else {
        const errorMsg = data?.error || 'Failed to delete key';
        console.error('Delete operation failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error in deleteKey:', {
        error: error.message,
        stack: error.stack,
        keyId: id
      });
      toast.error(error.message || 'Failed to delete key. Check console for details.');
    } finally {
      setIsDeleting(false);
    }
  }

  const openUpdateModal = (key: LicenseKey) => {
    setEditingKey(key)
    setNewValidity(key.validityYears)
    setNewMaxDevices(key.maxDevices || 1)
    setShowUpdateModal(true)
  }

  const closeUpdateModal = () => {
    setShowUpdateModal(false)
    setEditingKey(null)
  }

  const updateKey = async () => {
    if (!editingKey) return

    try {
      const response = await apiFetch(`/api/software/license-keys/${editingKey._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validityYears: newValidity,
          maxDevices: newMaxDevices
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update key')
      }

      if (data.success) {
        toast.success('License key updated successfully')
        fetchKeys()
        closeUpdateModal()
      } else {
        throw new Error(data.error || 'Failed to update key')
      }
    } catch (error: any) {
      console.error('Error updating key:', error)
      toast.error(error.message || 'Failed to update key')
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    toast.success('Key copied to clipboard')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const exportKeys = () => {
    const csv = [
      ['Key', 'Status', 'Validity (Years)', 'Customer', 'Email', 'Order', 'Assigned Date', 'Expires Date'].join(','),
      ...keys.map(k => [
        k.key,
        k.status,
        k.validityYears,
        k.assignedTo?.customerName || '-',
        k.assignedTo?.customerEmail || '-',
        k.assignedTo?.orderNumber || '-',
        k.assignedAt ? new Date(k.assignedAt).toLocaleDateString() : '-',
        k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '-'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `license-keys-${params.id}.csv`
    a.click()
  }

  const stats = {
    total: keys.length,
    available: keys.filter(k => k.status === 'available').length,
    assigned: keys.filter(k => k.status === 'assigned').length,
    expired: keys.filter(k => k.status === 'expired').length,
    revoked: keys.filter(k => k.status === 'revoked').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin/software"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Software Products
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">License Key Management</h1>
          <div className="flex gap-3">
            <button
              onClick={exportKeys}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Keys
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Keys</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-green-600">Available</div>
          <div className="text-2xl font-bold text-green-600">{stats.available}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-blue-600">Assigned</div>
          <div className="text-2xl font-bold text-blue-600">{stats.assigned}</div>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4">
          <div className="text-sm text-orange-600">Expired</div>
          <div className="text-2xl font-bold text-orange-600">{stats.expired}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-red-600">Revoked</div>
          <div className="text-2xl font-bold text-red-600">{stats.revoked}</div>
        </div>
      </div>

      {/* Keys Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Devices
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {keys.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                  No license keys found. Add some keys to get started.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {visibleKeyId === key._id ? (
                          key.key
                        ) : (
                          // masked representation: keep last 4 chars visible if possible
                          (() => {
                            const raw = String(key.key || '')
                            if (raw.length <= 8) return '••••••••'
                            const last = raw.slice(-4)
                            return `••••-••••-••••-${last}`
                          })()
                        )}
                      </code>

                      <button
                        onClick={() => {
                          if (visibleKeyId === key._id) setVisibleKeyId(null)
                          else setVisibleKeyId(key._id)
                        }}
                        className="text-gray-500 hover:text-gray-700"
                        title={visibleKeyId === key._id ? 'Hide key' : 'Show key'}
                        type="button"
                      >
                        {visibleKeyId === key._id ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => copyKey(key.key)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy key"
                      >
                        {copiedKey === key.key ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        key.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : key.status === 'assigned'
                          ? 'bg-blue-100 text-blue-800'
                          : key.status === 'expired'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {key.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{key.validityYears} year(s)</td>
                  <td className="px-6 py-4 text-sm">
                    {key.assignedTo ? (
                      <div>
                        <div className="font-medium">{key.assignedTo.customerName}</div>
                        <div className="text-gray-500 text-xs">{key.assignedTo.customerEmail}</div>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {key.assignedTo?.orderNumber || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {key.assignedAt ? new Date(key.assignedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {key.maxDevices || 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {key.assignedTo ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Assigned
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Available
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => openUpdateModal(key)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50"
                        title="Edit Key"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      {key.status === 'assigned' ? (
                        <>
                          <button
                            onClick={() => openRevokeModal(key)}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="Revoke Key"
                          >
                            <Ban className="w-5 h-5" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Update Key Modal */}
      {showUpdateModal && editingKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Update License Key</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                License Key
              </label>
              <input
                type="text"
                value={editingKey.key}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Validity (Years)
              </label>
              <select
                value={newValidity}
                onChange={(e) => setNewValidity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Year' : 'Years'}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Number of Devices
              </label>
              <select
                value={newMaxDevices}
                onChange={(e) => setNewMaxDevices(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>
                    {num} Device{num !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeUpdateModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={updateKey}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Update Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Key Modal */}
      {showRevokeModal && revokeTargetKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Ban className="text-yellow-600" />
              Revoke License Key
            </h2>

            <div className="mb-4 text-sm text-gray-700">
              <p className="mb-2">You're about to revoke the following license key. This action cannot be undone.</p>
              <div className="flex items-center gap-3">
                <code className="font-mono bg-gray-100 px-3 py-2 rounded text-sm">
                  {visibleKeyId === revokeTargetKey._id ? revokeTargetKey.key : (revokeTargetKey.key ? `••••-••••-••••-${String(revokeTargetKey.key).slice(-4)}` : '—')}
                </code>
                <div className="text-xs text-gray-500">
                  <div>{revokeTargetKey.assignedTo?.customerName || '-'}</div>
                  <div className="text-gray-400">{revokeTargetKey.assignedTo?.customerEmail || '-'}</div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
              <input
                type="password"
                value={revokePassword}
                onChange={(e) => setRevokePassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter admin password to confirm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowRevokeModal(false); setRevokeTargetKey(null); setRevokePassword('') }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isRevoking}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!revokeTargetKey) return
                  const ok = await revokeKey(revokeTargetKey._id, revokePassword)
                  if (ok) {
                    setShowRevokeModal(false)
                    setRevokeTargetKey(null)
                    setRevokePassword('')
                  }
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 flex items-center"
                disabled={isRevoking || !revokePassword}
              >
                {isRevoking ? (
                  <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
                ) : null}
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Keys Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Add License Keys</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Validity Period</label>
              <select
                value={selectedValidity}
                onChange={(e) => setSelectedValidity(Number(e.target.value) as any)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={4}>4 Years</option>
                <option value={5}>5 years</option>
              </select>
            </div>

            <div className="mt-4">
              <label htmlFor="maxDevices" className="block text-sm font-medium text-gray-700 mb-1">
                Max Number of Devices
              </label>
              <select
                id="maxDevices"
                value={maxDevices}
                onChange={(e) => setMaxDevices(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5].map(num => (
                  <option key={num} value={num}>
                    {num} Device{num !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                License Keys (one per line)
              </label>
              <textarea
                rows={10}
                value={bulkKeys}
                onChange={(e) => setBulkKeys(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX&#10;YYYYY-YYYYY-YYYYY-YYYYY&#10;ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ"
              />
              <p className="text-sm text-gray-600 mt-1">
                Enter one license key per line
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addKeys}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Add Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
