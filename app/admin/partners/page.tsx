"use client"
import { apiFetch } from "@/lib/api-client"
;

import { useState, useEffect } from "react"
import { 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Key,
  Building2,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Users,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { toast } from "react-hot-toast"

interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: 'starter' | 'growth' | 'professional' | 'enterprise';
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  commissionRate: number;
  businessDetails?: {
    gstin?: string;
    pan?: string;
    businessType?: string;
  };
  walletId?: string;
  createdAt: string;
  lastActiveAt?: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, suspended: 0 })
  const [showAddModal, setShowAddModal] = useState(false)
  
  const itemsPerPage = 10

  useEffect(() => {
    fetchPartners()
  }, [currentPage, statusFilter, tierFilter])

  const fetchPartners = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (tierFilter !== 'all') params.append('tier', tierFilter)

      const response = await apiFetch(`/api/admin/partners?${params}`)
      const data = await response.json()

      if (data.success) {
        setPartners(data.data.partners || [])
        setTotalPages(data.data.pagination?.totalPages || 1)
        
        // Calculate stats
        const allPartners = data.data.partners || []
        setStats({
          total: data.data.pagination?.total || allPartners.length,
          active: allPartners.filter((p: Partner) => p.status === 'active').length,
          pending: allPartners.filter((p: Partner) => p.status === 'pending').length,
          suspended: allPartners.filter((p: Partner) => p.status === 'suspended').length,
        })
      } else {
        toast.error(data.error?.message || 'Failed to fetch partners')
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
      toast.error('Failed to fetch partners')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (partnerId: string, newStatus: string) => {
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success(`Partner ${newStatus} successfully`)
        fetchPartners()
      } else {
        toast.error(data.error?.message || 'Failed to update partner')
      }
    } catch (error) {
      toast.error('Failed to update partner status')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
      terminated: 'bg-gray-100 text-gray-800',
    }
    const icons: Record<string, React.ReactNode> = {
      active: <CheckCircle className="h-3 w-3" />,
      pending: <Clock className="h-3 w-3" />,
      suspended: <AlertCircle className="h-3 w-3" />,
      terminated: <XCircle className="h-3 w-3" />,
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      starter: 'bg-gray-100 text-gray-800',
      growth: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-orange-100 text-orange-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[tier] || styles.starter}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    )
  }

  const filteredPartners = partners.filter(partner =>
    partner.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.businessDetails?.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
          <p className="text-gray-600 mt-1">Manage B2B partners and their API access</p>
        </div>
        <Link
          href="/admin/partners/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Partner
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Partners</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Suspended</p>
              <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Tiers</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button
            onClick={fetchPartners}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Building2 className="h-12 w-12 mb-4" />
            <p>No partners found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GSTIN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{partner.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {partner.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {partner.phone}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getTierBadge(partner.tier)}
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(partner.status)}
                    </td>
                    <td className="px-4 py-4 text-gray-900">
                      {partner.commissionRate}%
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-sm font-mono">
                      {partner.businessDetails?.gstin || '-'}
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-sm">
                      {new Date(partner.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/partners/${partner.id}`}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/admin/partners/${partner.id}/edit`}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/admin/partners/${partner.id}/api-keys`}
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="API Keys"
                        >
                          <Key className="h-4 w-4" />
                        </Link>
                        {partner.status !== 'suspended' && partner.status !== 'terminated' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(partner.id, 'suspended'); }}
                            className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Suspend"
                          >
                            <AlertCircle className="h-4 w-4" />
                          </button>
                        )}
                        {partner.status === 'suspended' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(partner.id, 'active'); }}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                            title="Activate"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
