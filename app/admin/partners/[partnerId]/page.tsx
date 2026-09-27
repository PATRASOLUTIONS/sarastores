"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, use } from "react"
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  Key,
  Wallet,
  Package,
  TrendingUp,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Book,
  ExternalLink,
  ShoppingCart,
  CreditCard,
  Link as LinkIcon,
  Shield,
  Settings,
  Save
} from "lucide-react"
import Link from "next/link"
import { toast } from "react-hot-toast"

interface Partner {
  id: string;

  name: string;
  email: string;
  phone: string;
  website?: string;
  tier: 'starter' | 'growth' | 'professional' | 'enterprise';
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  commissionRate: number;
  businessDetails?: {
    gstin?: string;
    pan?: string;
    businessType?: string;
    registeredAddress?: {
      line1?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  };
  contactPerson?: {
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
  };
  walletId?: string;
  razorpayIntegration?: RazorpayIntegration;
  createdAt: string;
  lastActiveAt?: string;
}

interface APIKey {
  id: string;
  key?: string; // Full API key (only available for new keys with encryption)
  prefix: string;
  tier: string;
  permissions: string[];
  environment: 'live' | 'test';
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  hasFullKey?: boolean; // Whether full key is available
}

interface WalletInfo {
  id: string;
  balance: {
    available: number;
    pending: number;
    held: number;
  };
  currency: string;
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
  }>;
}

interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'hold' | 'release';
  category: string;
  amount: number;
  balanceAfter: number;
  description: string;
  status: string;
  createdAt: string;
  environment?: 'live' | 'test';
  orderId?: string;
  paymentReference?: string;
  paymentMethod?: string;
}

interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalCommission: number;
}

interface RazorpayIntegration {
  enabled: boolean;
  paymentMode: 'wallet' | 'direct';
  commissionPercent: number;
  allowedDomains: string[];
  webhookSecret?: string;
  razorpayAccountId?: string;
  razorpayAccountStatus?: 'pending' | 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

interface EnabledProduct {
  _id: string;
  name: string;
  sku?: string;
  price: number;
  images?: string[];
  category?: string;
}

interface PartnerOrder {
  id: string
  orderId: string
  partnerId: string
  partnerOrderId?: string
  customer: {
    name: string
    email: string
    phone: string
    address?: any
  }
  items: Array<{
    productId: string
    name: string
    price: number
    quantity: number
    sku?: string
  }>
  summary: {
    subtotal: number
    tax: number
    shipping: number
    total: number
  }
  paymentMethod: string
  status: string
  statusHistory: Array<{ status: string; timestamp: string; note?: string }>
  commission: {
    rate: number
    amount: number
    status: string
  } | null
  tracking?: {
    carrier?: string
    trackingNumber?: string
  } | null
  notes?: string
  paymentDetails?: {
    razorpayOrderId?: string
    transactionId?: string
    method?: string
    amount?: number
  }
  paymentVerification?: {
    verified: boolean
    verifiedAt?: string
    verifiedBy?: string
  }
  createdAt: string
  updatedAt: string
}

export default function PartnerDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = use(params)
  const currencyFormatter = new Intl.NumberFormat('en-IN')
  const formatCurrency = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value)
    const safeValue = Number.isFinite(parsed) ? parsed : 0
    return currencyFormatter.format(safeValue)
  }

  const [partner, setPartner] = useState<Partner | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([])
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null)
  const [enabledProducts, setEnabledProducts] = useState<EnabledProduct[]>([])
  const [partnerOrders, setPartnerOrders] = useState<PartnerOrder[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'api-keys' | 'orders' | 'payment' | 'products' | 'transactions' | 'api-docs'>('overview')
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyData, setNewKeyData] = useState<{ key: string } | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set()) // Track which keys are visible

  // Wallet view mode toggle (live/test)
  const [walletViewMode, setWalletViewMode] = useState<'live' | 'test'>('test')

  // Wallet fund adding state
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [fundMode, setFundMode] = useState<'test' | 'prod'>('test')
  const [fundAmount, setFundAmount] = useState('')
  const [fundDescription, setFundDescription] = useState('')
  const [fundPaymentRef, setFundPaymentRef] = useState('')
  const [fundNotes, setFundNotes] = useState('')
  const [isAddingFunds, setIsAddingFunds] = useState(false)
  const [isRemovingTransaction, setIsRemovingTransaction] = useState(false)

  // Razorpay Integration state
  const [razorpayEnabled, setRazorpayEnabled] = useState(false)
  const [razorpayPaymentMode, setRazorpayPaymentMode] = useState<'wallet' | 'direct'>('wallet')
  const [razorpayCommission, setRazorpayCommission] = useState('')
  const [razorpayDomains, setRazorpayDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [razorpayAccountId, setRazorpayAccountId] = useState('')
  const [isSavingRazorpay, setIsSavingRazorpay] = useState(false)
  const [paymentSubTab, setPaymentSubTab] = useState<'wallet' | 'razorpay'>('wallet')
  const [defaultRazorpayEnv, setDefaultRazorpayEnv] = useState<'test' | 'live'>('test')
  const [testKeyId, setTestKeyId] = useState('')
  const [testKeySecret, setTestKeySecret] = useState('')
  const [liveKeyId, setLiveKeyId] = useState('')
  const [liveKeySecret, setLiveKeySecret] = useState('')

  useEffect(() => {
    fetchPartnerDetails()
  }, [partnerId])

  const fetchPartnerDetails = async () => {
    setIsLoading(true)
    try {
      // Fetch partner details
      const partnerRes = await apiFetch(`/api/admin/partners/${partnerId}`)
      const partnerData = await partnerRes.json()

      if (partnerData.success) {
        setPartner(partnerData.data.partner)
      } else {
        toast.error('Failed to fetch partner details')
        return
      }

      // Fetch API keys
      const keysRes = await apiFetch(`/api/admin/partners/${partnerId}/api-keys`)
      const keysData = await keysRes.json()
      if (keysData.success) {
        setApiKeys(keysData.data.apiKeys || [])
      }

      // Fetch wallet data
      const walletRes = await apiFetch(`/api/admin/partners/${partnerId}/wallet`)
      const walletData = await walletRes.json()
      if (walletData.success) {
        setWallet(walletData.data.wallet)
        setWalletTransactions(walletData.data.transactions || [])
      }

      // Fetch enabled products for this partner (cache-bust to ensure fresh data)
      const productsRes = await apiFetch(`/api/admin/partners/${partnerId}/products?t=${Date.now()}`)
      const productsData = await productsRes.json()

      if (productsData.success && productsData.data) {
        // Prefer detailed product objects when available
        const enabledDetails = productsData.data.enabledProductDetails || productsData.data.enabledProducts || productsData.enabledProductDetails || productsData.enabledProducts || []
        console.log('[Partner Details] Enabled products from API:', (enabledDetails || []).length)
        setEnabledProducts(enabledDetails)
      } else {
        console.log('[Partner Details] Failed to fetch partner products:', productsData)
        setEnabledProducts([])
      }

      // Fetch partner orders
      try {
        const ordersRes = await apiFetch(`/api/admin/partners/${partnerId}/orders`)
        const ordersData = await ordersRes.json()
        if (ordersData.success && ordersData.data) {
          setPartnerOrders(ordersData.data.orders || [])
          console.log('[Partner Details] Partner orders:', ordersData.data.orders?.length || 0)
        }
      } catch (orderErr) {
        console.warn('[Partner Details] Failed to fetch partner orders:', orderErr)
      }

    } catch (error) {
      console.error('Error fetching partner details:', error)
      toast.error('Failed to fetch partner details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`Partner ${newStatus} successfully`)
        setPartner(prev => prev ? { ...prev, status: newStatus as any } : null)
      } else {
        toast.error(data.error?.message || 'Failed to update partner')
      }
    } catch (error) {
      toast.error('Failed to update partner status')
    }
  }

  const handleGenerateKey = async (environment: 'live' | 'test') => {
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment }),
      })

      const data = await response.json()
      if (data.success) {
        setNewKeyData({ key: data.data.key })
        fetchPartnerDetails()
        toast.success('API key generated successfully')
      } else {
        toast.error(data.error?.message || 'Failed to generate API key')
      }
    } catch (error) {
      toast.error('Failed to generate API key')
    }
  }

  const handleAddFunds = async () => {
    const amount = parseFloat(fundAmount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (fundMode === 'prod' && !fundPaymentRef) {
      toast.error('Payment reference is required in production mode')
      return
    }

    setIsAddingFunds(true)
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          mode: fundMode,
          description: fundDescription,
          paymentReference: fundPaymentRef,
          notes: fundNotes,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message || 'Funds added successfully')
        setShowAddFundsModal(false)
        setFundAmount('')
        setFundDescription('')
        setFundPaymentRef('')
        setFundNotes('')
        fetchPartnerDetails()
      } else {
        toast.error(data.error?.message || 'Failed to add funds')
      }
    } catch (error) {
      toast.error('Failed to add funds')
    } finally {
      setIsAddingFunds(false)
    }
  }

  const handleRemoveTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to remove this transaction? This action cannot be undone.')) {
      return
    }

    setIsRemovingTransaction(true)
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/wallet/transaction/${transactionId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Transaction removed successfully')
        fetchPartnerDetails()
      } else {
        toast.error(data.error?.message || 'Failed to remove transaction')
      }
    } catch (error) {
      toast.error('Failed to remove transaction')
    } finally {
      setIsRemovingTransaction(false)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/api-keys?keyId=${keyId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        toast.success('API key revoked successfully')
        fetchPartnerDetails()
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

  // Initialize Razorpay state when partner data is loaded
  useEffect(() => {
    if (partner?.razorpayIntegration) {
      setRazorpayEnabled(partner.razorpayIntegration.enabled || false)
      setRazorpayPaymentMode(partner.razorpayIntegration.paymentMode || 'wallet')
      setRazorpayCommission(partner.razorpayIntegration.commissionPercent?.toString() || '')
      setRazorpayDomains(partner.razorpayIntegration.allowedDomains || [])
      setRazorpayAccountId(partner.razorpayIntegration.razorpayAccountId || '')
      setDefaultRazorpayEnv((partner.razorpayIntegration as any).defaultEnvironment || 'test')
      const creds = (partner.razorpayIntegration as any)?.credentials || {}
      setTestKeyId(creds.test?.keyId || '')
      setLiveKeyId(creds.live?.keyId || '')
    }
  }, [partner])

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) {
      toast.error('Please enter a domain')
      return
    }

    // Validate domain format
    const domainPattern = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
    const localhostPattern = /^localhost(:\d+)?$/
    const vercelPattern = /^[a-zA-Z0-9-]+\.vercel\.app$/

    if (!domainPattern.test(domain) && !localhostPattern.test(domain) && !vercelPattern.test(domain) && domain !== '*') {
      toast.error('Please enter a valid domain (e.g., example.com, *.example.com, or myapp.vercel.app)')
      return
    }

    if (razorpayDomains.includes(domain)) {
      toast.error('Domain already added')
      return
    }

    setRazorpayDomains([...razorpayDomains, domain])
    setNewDomain('')
    toast.success('Domain added')
  }

  const handleRemoveDomain = (domain: string) => {
    setRazorpayDomains(razorpayDomains.filter(d => d !== domain))
    toast.success('Domain removed')
  }

  const handleSaveRazorpayIntegration = async () => {
    const commission = parseFloat(razorpayCommission)
    if (razorpayEnabled && (isNaN(commission) || commission < 0 || commission > 100)) {
      toast.error('Please enter a valid commission percentage (0-100)')
      return
    }

    if (razorpayEnabled && razorpayDomains.length === 0) {
      toast.error('Please add at least one allowed domain')
      return
    }

    setIsSavingRazorpay(true)
    try {
      const response = await apiFetch(`/api/admin/partners/${partnerId}/razorpay-integration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: razorpayEnabled,
          paymentMode: razorpayPaymentMode,
          commissionPercent: commission || 0,
          allowedDomains: razorpayDomains,
          razorpayAccountId: razorpayAccountId || null,
          defaultEnvironment: defaultRazorpayEnv,
          credentials: {
            test: (testKeyId || testKeySecret) ? { keyId: testKeyId || undefined, keySecret: testKeySecret || undefined } : undefined,
            live: (liveKeyId || liveKeySecret) ? { keyId: liveKeyId || undefined, keySecret: liveKeySecret || undefined } : undefined,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Razorpay integration settings saved successfully')
        fetchPartnerDetails()
      } else {
        toast.error(data.error?.message || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save Razorpay integration settings')
    } finally {
      setIsSavingRazorpay(false)
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys)
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId)
    } else {
      newVisibleKeys.add(keyId)
    }
    setVisibleKeys(newVisibleKeys)
  }

  const maskKey = (key: string) => {
    if (key.length <= 24) return key
    return key.slice(0, 20) + '••••••••••••••••••••••••'
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
      terminated: 'bg-gray-100 text-gray-800',
    }
    const icons: Record<string, React.ReactNode> = {
      active: <CheckCircle className="h-4 w-4" />,
      pending: <Clock className="h-4 w-4" />,
      suspended: <AlertCircle className="h-4 w-4" />,
      terminated: <XCircle className="h-4 w-4" />,
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${styles[status] || styles.pending}`}>
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
      <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${styles[tier] || styles.starter}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Building2 className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Partner not found</h2>
        <Link href="/admin/partners" className="mt-4 text-blue-600 hover:underline">
          Back to Partners
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/partners"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
            {getStatusBadge(partner.status)}
            {getTierBadge(partner.tier)}
          </div>
          <p className="text-gray-600 mt-1">Partner ID: {partner.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/partners/${partnerId}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
          {partner.status !== 'active' && (
            <button
              onClick={() => handleStatusChange('active')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Activate
            </button>
          )}
          {partner.status === 'active' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <AlertCircle className="h-4 w-4" />
              Suspend
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4 overflow-x-auto">
          {(['overview', 'api-keys', 'products', 'orders', 'transactions', 'payment', 'api-docs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Information */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{partner.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{partner.phone}</p>
                </div>
              </div>
              {partner.website && (
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Website</p>
                    <a href={partner.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                      {partner.website}
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Joined</p>
                  <p className="font-medium">{new Date(partner.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">GSTIN</p>
                <p className="font-medium font-mono">{partner.businessDetails?.gstin || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PAN</p>
                <p className="font-medium font-mono">{partner.businessDetails?.pan || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Business Type</p>
                <p className="font-medium capitalize">{partner.businessDetails?.businessType?.replace('_', ' ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Commission Rate</p>
                <p className="font-medium text-green-600">{partner.commissionRate}%</p>
              </div>
            </div>
          </div>

          {/* Contact Person */}
          {partner.contactPerson && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Person</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{partner.contactPerson.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{partner.contactPerson.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{partner.contactPerson.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Designation</p>
                  <p className="font-medium">{partner.contactPerson.designation || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          {partner.businessDetails?.registeredAddress && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Registered Address</h3>
              <div className="space-y-2">
                <p>{partner.businessDetails.registeredAddress.line1}</p>
                <p>
                  {partner.businessDetails.registeredAddress.city}, {partner.businessDetails.registeredAddress.state}
                </p>
                <p>{partner.businessDetails.registeredAddress.pincode}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          {/* Generate Key Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => handleGenerateKey('test')}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Generate Test Key
            </button>
            <button
              onClick={() => handleGenerateKey('live')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Generate Live Key
            </button>
          </div>

          {/* New Key Display */}
          {newKeyData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                ⚠️ Copy this key now! It won't be shown again.
              </p>
              <div className="flex items-center gap-2 bg-white p-3 rounded border font-mono text-sm">
                <code className="flex-1 break-all">{newKeyData.key}</code>
                <button
                  onClick={() => copyToClipboard(newKeyData.key)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setNewKeyData(null)}
                className="mt-3 text-sm text-yellow-700 hover:underline"
              >
                I've copied the key, dismiss this message
              </button>
            </div>
          )}

          {/* API Keys Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            {apiKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Key className="h-12 w-12 mb-4" />
                <p>No API keys generated yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys.map((key) => {
                    const isFullKeyAvailable = key.hasFullKey || (key.key && key.key.length > 25);
                    return (
                      <tr key={key.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="break-all">
                                {visibleKeys.has(key.id) ? (key.key || key.prefix) : maskKey(key.key || key.prefix)}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => toggleKeyVisibility(key.id)}
                                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                                  title={visibleKeys.has(key.id) ? "Hide key" : "Show key"}
                                >
                                  {visibleKeys.has(key.id) ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    if (isFullKeyAvailable) {
                                      copyToClipboard(key.key || key.prefix);
                                    } else {
                                      toast.error('Full key not available. Please revoke and generate a new key.');
                                    }
                                  }}
                                  className={`p-1 hover:bg-gray-100 rounded ${isFullKeyAvailable ? 'text-gray-500 hover:text-gray-700' : 'text-orange-500 hover:text-orange-700'}`}
                                  title={isFullKeyAvailable ? "Copy full key" : "Full key not available - legacy key"}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            {!isFullKeyAvailable && (
                              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded inline-block">
                                ⚠️ Legacy key - revoke & regenerate for full access
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${key.environment === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {key.environment}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${key.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {key.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {key.status === 'active' && (
                            <button
                              onClick={() => handleRevokeKey(key.id)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Partner Products Access</h3>
              <p className="text-sm text-gray-500">{enabledProducts.length} products enabled for this partner</p>
            </div>
            <Link
              href={`/admin/partners/${partnerId}/products`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Package className="h-4 w-4" />
              Manage Products
            </Link>
          </div>

          {enabledProducts.length === 0 ? (
            <div className="bg-white rounded-lg border p-6">
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No products enabled for this partner yet.</p>
                <p className="text-sm text-gray-500 mt-2">Click "Manage Products" to enable products for this partner.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {enabledProducts.slice(0, 12).map((product, index) => (
                  <div key={`enabled-${product._id}-${index}`} className="border rounded-lg p-3 bg-green-50 border-green-200">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{product.name}</h4>
                        <p className="text-xs text-gray-500">{product.sku || 'No SKU'}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">₹{formatCurrency(product.price)}</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
              {enabledProducts.length > 12 && (
                <div className="px-4 pb-4">
                  <Link
                    href={`/admin/partners/${partnerId}/products`}
                    className="block text-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View all {enabledProducts.length} enabled products →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Partner Orders</h3>
              <p className="text-sm text-gray-500">{partnerOrders.length} orders placed by this partner</p>
            </div>
            <button
              onClick={fetchPartnerDetails}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {partnerOrders.length === 0 ? (
            <div className="bg-white rounded-lg border p-6">
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No orders placed by this partner yet.</p>
                <p className="text-sm text-gray-500 mt-2">Orders will appear here once the partner starts using the API.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Razorpay ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verification</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {partnerOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{order.orderId}</div>
                        {order.partnerOrderId && (
                          <div className="text-xs text-gray-500">Ref: {order.partnerOrderId}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{order.customer?.name}</div>
                        <div className="text-xs text-gray-500">{order.customer?.email}</div>
                        <div className="text-xs text-gray-500">{order.customer?.phone}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-xs text-gray-700">
                              {item.name} × {item.quantity}
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-xs text-gray-400">+{order.items.length - 2} more</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {/* <div className="text-sm font-semibold text-gray-900">₹{order.summary.total.toLocaleString()}</div> */}
                        <div className="text-sm font-semibold text-gray-900">payment amount: ₹{formatCurrency(order.summary?.subtotal)}</div>
                      </td>
                      <td className="px-4 py-4">
                        {order.commission ? (
                          <div>
                            <div className="text-sm font-medium text-green-700">₹{formatCurrency(order.commission?.amount)}</div>
                            <div className="text-xs text-gray-500">{order.commission.rate}%</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                order.status === 'returned' ? 'bg-orange-100 text-orange-800' :
                                  'bg-yellow-100 text-yellow-800'
                          }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {order.paymentDetails?.razorpayOrderId ? (
                          <div className="font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border">
                            OrderID: {order.paymentDetails.razorpayOrderId}
                            {order.paymentDetails.transactionId && (
                              <div className="mt-1">Txn: {order.paymentDetails.transactionId}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.paymentMethod === 'prepaid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                          {order.paymentMethod === 'prepaid' ? 'Prepaid' : 'COD'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {order.paymentMethod === 'prepaid' ? (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.paymentVerification?.verified
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}>
                              {order.paymentVerification?.verified ? 'Verified' : 'Unverified'}
                            </span>
                            {order.paymentVerification?.verified && order.paymentVerification.verifiedBy && (
                              <div className="text-[10px] text-gray-500">
                                {order.paymentVerification.verifiedBy}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Order Transactions</h3>
              <p className="text-sm text-gray-500">All payment transactions for partner orders</p>
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setWalletViewMode('live')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${walletViewMode === 'live'
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                🟢 Live
              </button>
              <button
                onClick={() => setWalletViewMode('test')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${walletViewMode === 'test'
                  ? 'bg-yellow-500 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                🧪 Test
              </button>
            </div>
          </div>

          {/* Transaction Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {walletTransactions.filter(t => t.category === 'order' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test')).length}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Order Payments</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{formatCurrency(walletTransactions
                  .filter(t => t.type === 'credit' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Refunds</p>
              <p className="text-2xl font-bold text-red-600">
                ₹{formatCurrency(walletTransactions
                  .filter(t => t.type === 'debit' && t.category === 'refund' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Commission Earned</p>
              <p className="text-2xl font-bold text-blue-600">
                ₹{formatCurrency(walletTransactions
                  .filter(t => t.category === 'order_commission' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                  .reduce((sum, t) => sum + t.amount, 0)
                )}
              </p>
            </div>
          </div>

          {/* Transaction Table */}
          <div className={`rounded-lg border overflow-hidden ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">
                Transaction History
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${walletViewMode === 'test' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                  {walletViewMode === 'test' ? '🧪 Test' : '🟢 Live'}
                </span>
              </h4>
            </div>
            {walletTransactions.filter(t => walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test').length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Package className="h-12 w-12 mb-4" />
                <p>No {walletViewMode} transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`border-b ${walletViewMode === 'test' ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {walletTransactions
                      .filter(t => walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test')
                      .map((txn) => (
                        <tr key={txn.id} className={`hover:bg-opacity-75 ${walletViewMode === 'test' ? 'hover:bg-yellow-100' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${txn.type === 'credit' ? 'bg-green-100 text-green-800' :
                              txn.type === 'debit' ? 'bg-red-100 text-red-800' :
                                txn.type === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                              }`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 capitalize">
                            {txn.category?.replace('_', ' ') || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {txn.description}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {txn.orderId ? (
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{txn.orderId}</span>
                            ) : '-'}
                          </td>
                          <td className={`px-4 py-4 text-right font-medium ${txn.type === 'credit' || txn.type === 'release' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {txn.type === 'credit' || txn.type === 'release' ? '+' : '-'}₹{formatCurrency(txn.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-4">
          {/* Payment Sub-Navigation */}
          <div className="flex gap-1 border-b bg-white rounded-t-lg px-2">
            <button
              onClick={() => setPaymentSubTab('wallet')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${paymentSubTab === 'wallet' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Wallet
            </button>
            <button
              onClick={() => setPaymentSubTab('razorpay')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${paymentSubTab === 'razorpay' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Razorpay Integration
            </button>
          </div>

          {paymentSubTab === 'wallet' && (
        <div className="space-y-6">
          {/* Razorpay Integration Warning */}
          {partner.razorpayIntegration?.enabled && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-900">Razorpay Integration is Active</p>
                  <p className="text-sm text-orange-800 mt-1">
                    This partner is using Razorpay integration with {partner.razorpayIntegration.paymentMode === 'wallet' ? 'wallet mode' : 'direct payment mode'}.
                    {partner.razorpayIntegration.paymentMode === 'direct' && ' Manual wallet operations are disabled when using direct payment mode.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Live/Test Mode Toggle */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Wallet Mode</h3>
                <p className="text-sm text-gray-500">View transactions and balances for different environments</p>
              </div>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setWalletViewMode('live')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${walletViewMode === 'live'
                    ? 'bg-green-600 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  🟢 Live
                </button>
                <button
                  onClick={() => setWalletViewMode('test')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${walletViewMode === 'test'
                    ? 'bg-yellow-500 text-white shadow'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  🟡 Test
                </button>
              </div>
            </div>
          </div>

          {/* Mode Indicator Banner */}
          {walletViewMode === 'test' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">
                🧪 Test Mode - Viewing simulated/test transactions. These funds are not real.
              </p>
            </div>
          )}

          {/* Wallet Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Available Balance</p>
              <p className={`text-2xl font-bold ${walletViewMode === 'test' ? 'text-yellow-600' : 'text-green-600'}`}>
                ₹{formatCurrency(wallet?.balance?.available)}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Pending</p>
              <p className={`text-2xl font-bold ${walletViewMode === 'test' ? 'text-yellow-600' : 'text-yellow-600'}`}>
                ₹{formatCurrency(wallet?.balance?.pending)}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Held</p>
              <p className="text-2xl font-bold text-red-600">
                ₹{formatCurrency(wallet?.balance?.held)}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <p className="text-sm text-gray-600">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{formatCurrency((wallet?.balance?.available || 0) + (wallet?.balance?.pending || 0) + (wallet?.balance?.held || 0))}
              </p>
            </div>
          </div>

          {/* Payment Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Order Payments */}
            <div className={`rounded-lg border p-5 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Client Order Payments
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Orders</span>
                  <span className="font-semibold">{walletTransactions.filter(t => t.category === 'order' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test')).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Order Payments Received</span>
                  <span className="font-semibold text-green-600">
                    ₹{formatCurrency(walletTransactions
                      .filter(t => t.type === 'credit' && t.category === 'order' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                      .reduce((sum, t) => sum + t.amount, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Refunds Issued</span>
                  <span className="font-semibold text-red-600">
                    ₹{formatCurrency(walletTransactions
                      .filter(t => t.type === 'debit' && t.category === 'refund' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                      .reduce((sum, t) => sum + t.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Client Payments to Company */}
            <div className={`rounded-lg border p-5 ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Partner Wallet Summary
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Credits</span>
                  <span className="font-semibold text-green-600">
                    ₹{formatCurrency(walletTransactions
                      .filter(t => t.type === 'credit' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                      .reduce((sum, t) => sum + t.amount, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Debits</span>
                  <span className="font-semibold text-red-600">
                    ₹{formatCurrency(walletTransactions
                      .filter(t => t.type === 'debit' && (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                      .reduce((sum, t) => sum + t.amount, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-gray-900 font-medium">Net Balance Change</span>
                  <span className="font-bold text-gray-900">
                    ₹{formatCurrency((walletTransactions
                      .filter(t => (walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test'))
                      .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0))
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Add Funds Button */}
          <div className="flex gap-4">
            <button
              onClick={() => { setFundMode('test'); setShowAddFundsModal(true); }}
              disabled={partner.razorpayIntegration?.enabled && partner.razorpayIntegration?.paymentMode === 'direct'}
              className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${walletViewMode === 'test' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                }`}
            >
              <Plus className="h-4 w-4" />
              Add Test Funds
            </button>
            <button
              onClick={() => { setFundMode('prod'); setShowAddFundsModal(true); }}
              disabled={partner.razorpayIntegration?.enabled && partner.razorpayIntegration?.paymentMode === 'direct'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Funds (Production)
            </button>
          </div>

          {/* Transactions Table */}
          <div className={`rounded-lg border overflow-hidden ${walletViewMode === 'test' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Transaction History
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${walletViewMode === 'test' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                  {walletViewMode === 'test' ? '🧪 Test' : '🟢 Live'}
                </span>
              </h3>
              <span className="text-sm text-gray-500">
                {walletTransactions.filter(t => walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test').length} transactions
              </span>
            </div>
            {walletTransactions.filter(t => walletViewMode === 'test' ? t.environment === 'test' : t.environment !== 'test').length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Wallet className="h-12 w-12 mb-4" />
                <p>No {walletViewMode} transactions yet</p>
                {walletViewMode === 'test' && (
                  <p className="text-sm mt-2">Add test funds to simulate transactions</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`border-b ${walletViewMode === 'test' ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {walletTransactions
                      .filter(txn => walletViewMode === 'test' ? txn.environment === 'test' : txn.environment !== 'test')
                      .map((txn) => (
                        <tr key={txn.id} className={`hover:bg-opacity-75 ${walletViewMode === 'test' ? 'hover:bg-yellow-100' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${txn.type === 'credit' ? 'bg-green-100 text-green-800' :
                              txn.type === 'debit' ? 'bg-red-100 text-red-800' :
                                txn.type === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                              }`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 capitalize">
                            {txn.category || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div>{txn.description}</div>
                            {txn.orderId && (
                              <div className="text-xs text-gray-500">Order: {txn.orderId}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {txn.paymentReference ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{txn.paymentReference}</span>
                                <button
                                  onClick={() => copyToClipboard(txn.paymentReference!)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className={`px-4 py-4 text-right font-medium ${txn.type === 'credit' || txn.type === 'release' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {txn.type === 'credit' || txn.type === 'release' ? '+' : '-'}₹{formatCurrency(txn.amount)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-gray-600">
                            ₹{formatCurrency(txn.balanceAfter)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {walletViewMode === 'test' && (
                              <button
                                onClick={() => handleRemoveTransaction(txn.id)}
                                disabled={isRemovingTransaction}
                                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                                title="Remove transaction"
                              >
                                <Trash2 className="h-4 w-4" />
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
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Funds {fundMode === 'test' ? '(Test Mode)' : '(Production)'}
            </h3>

            {fundMode === 'test' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Test Mode:</strong> No payment proof required. These are simulated funds for testing.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={fundDescription}
                  onChange={(e) => setFundDescription(e.target.value)}
                  placeholder="e.g., Initial deposit"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {fundMode === 'prod' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference *
                  </label>
                  <input
                    type="text"
                    value={fundPaymentRef}
                    onChange={(e) => setFundPaymentRef(e.target.value)}
                    placeholder="e.g., UTR number, transaction ID"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={fundNotes}
                  onChange={(e) => setFundNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddFundsModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFunds}
                disabled={isAddingFunds || !fundAmount}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white disabled:opacity-50 ${fundMode === 'test' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                {isAddingFunds ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Funds
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
          )}

          {paymentSubTab === 'razorpay' && (
        <div className="space-y-6">
          {/* Integration Overview */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="h-8 w-8" />
              <h3 className="text-2xl font-bold">Razorpay Integration</h3>
            </div>
            <p className="text-blue-100">
              Allow this partner to accept payments through Razorpay on their external websites.
              Configure allowed domains, payment modes, and commission settings.
            </p>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Integration Status
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  Enable or disable Razorpay integration for this partner
                </p>
              </div>
              <button
                onClick={() => setRazorpayEnabled(!razorpayEnabled)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${razorpayEnabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${razorpayEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
            {razorpayEnabled && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Razorpay integration is active for this partner
                </p>
              </div>
            )}
          </div>

          {/* Payment Mode Selection */}
          {/* <div className="bg-white rounded-lg border p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payment Mode
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Choose how payments should be processed for orders from this partner's websites
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setRazorpayPaymentMode('wallet')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${razorpayPaymentMode === 'wallet'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${razorpayPaymentMode === 'wallet' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900">Wallet System</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      Payments go to the partner's wallet. We deduct our commission, and they can withdraw the remaining balance.
                    </p>
                    <ul className="mt-3 text-xs text-gray-500 space-y-1">
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Centralized payment management
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Automatic commission deduction
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Easy withdrawal process
                      </li>
                    </ul>
                  </div>
                  {razorpayPaymentMode === 'wallet' && (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </div>

              <div
                onClick={() => setRazorpayPaymentMode('direct')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${razorpayPaymentMode === 'direct'
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${razorpayPaymentMode === 'direct' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900">Direct Payment</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      Payments go directly to the partner. We collect commission separately later.
                    </p>
                    <ul className="mt-3 text-xs text-gray-500 space-y-1">
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Instant payment to partner
                      </li>
                      <li className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Partner manages their funds
                      </li>
                      <li className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                        Commission collected later
                      </li>
                    </ul>
                  </div>
                  {razorpayPaymentMode === 'direct' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
              </div>
            </div>
          </div> */}

          {/* Commission Settings */}
          <div className="bg-white rounded-lg border p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Commission Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={razorpayCommission}
                    onChange={(e) => setRazorpayCommission(e.target.value)}
                    placeholder="e.g., 5"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Commission to be deducted from each transaction
                </p>
              </div>

              {razorpayPaymentMode === 'direct' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Razorpay Account ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={razorpayAccountId}
                    onChange={(e) => setRazorpayAccountId(e.target.value)}
                    placeholder="acc_xxxxxxxxxx"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Partner's Razorpay Account ID for direct transfers
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Allowed Domains */}
          <div className="bg-white rounded-lg border p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Allowed Website Domains
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Specify the domains that are allowed to process Razorpay payments for this partner.
              Orders from non-whitelisted domains will be rejected.
            </p>

            {/* Add Domain Input */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <LinkIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  placeholder="e.g., example.com or *.example.com"
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleAddDomain}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Domain
              </button>
            </div>

            {/* Domain List */}
            {razorpayDomains.length === 0 ? (
              <div className="p-8 bg-gray-50 rounded-lg text-center">
                <Globe className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">No domains added yet</p>
                <p className="text-sm text-gray-500 mt-1">Add domains to allow Razorpay payments from external websites</p>
              </div>
            ) : (
              <div className="space-y-2">
                {razorpayDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-sm">{domain}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Domain Tips */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">Domain Format Tips:</h5>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Use <code className="bg-blue-100 px-1 rounded">example.com</code> for exact domain match</li>
                <li>• Use <code className="bg-blue-100 px-1 rounded">*.example.com</code> to allow all subdomains</li>
                <li>• Use <code className="bg-blue-100 px-1 rounded">localhost:3000</code> for local development</li>
                <li>• Use <code className="bg-blue-100 px-1 rounded">myapp.vercel.app</code> for Vercel deployments</li>
              </ul>
            </div>
          </div>

          {/* Integration Code Snippet */}
          <div className="bg-white rounded-lg border p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Book className="h-5 w-5" />
              Integration Guide
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Use this code snippet to integrate Razorpay payments on your website
            </p>

            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <span className="text-sm text-gray-400">JavaScript Example</span>
                <button
                  onClick={() => copyToClipboard(`// Initialize Razorpay Payment
const options = {
  key: 'YOUR_RAZORPAY_KEY',
  amount: orderAmount * 100, // Amount in paise
  currency: 'INR',
  name: 'Your Store Name',
  description: 'Order Payment',
  order_id: razorpayOrderId,
  handler: function(response) {
    // Verify payment with partner API
    fetch('https://YOUR_SARA_DOMAIN/api/v1/partner/orders/razorpay/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        partner_order_id: yourOrderId
      })
    });
  },
  prefill: {
    name: customerName,
    email: customerEmail,
    contact: customerPhone
  }
};

const rzp = new Razorpay(options);
rzp.open();`)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-sm text-gray-100">
                <code>{`// Initialize Razorpay Payment
const options = {
  key: 'YOUR_RAZORPAY_KEY',
  amount: orderAmount * 100, // Amount in paise
  currency: 'INR',
  name: 'Your Store Name',
  description: 'Order Payment',
  order_id: razorpayOrderId,
  handler: function(response) {
    // Verify payment with partner API
    fetch('https://YOUR_SARA_DOMAIN/api/v1/partner/orders/razorpay/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        partner_order_id: yourOrderId
      })
    });
  },
  prefill: {
    name: customerName,
    email: customerEmail,
    contact: customerPhone
  }
};

const rzp = new Razorpay(options);
rzp.open();`}</code>
              </pre>
            </div>
          </div>

          {/* API Credentials */}
          <div className="bg-white rounded-lg border p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Key className="h-5 w-5" />
              Razorpay API Credentials
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Enter your Razorpay API keys. Secrets are stored encrypted and never shown again after saving.
            </p>

            {/* Default Environment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Environment</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setDefaultRazorpayEnv('test')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${defaultRazorpayEnv === 'test' ? 'border-yellow-500 bg-yellow-50 text-yellow-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  🧪 Test Mode
                </button>
                <button
                  onClick={() => setDefaultRazorpayEnv('live')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${defaultRazorpayEnv === 'live' ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  🟢 Live Mode
                </button>
              </div>
              {defaultRazorpayEnv === 'test' && (
                <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                  ⚠️ Test mode is active. Orders will NOT be saved to the orders database.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Test Credentials */}
              <div className="space-y-3 p-4 border-2 border-yellow-200 rounded-lg bg-yellow-50">
                <h5 className="font-medium text-yellow-900">🧪 Test Credentials</h5>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Test Key ID</label>
                  <input
                    type="text"
                    value={testKeyId}
                    onChange={(e) => setTestKeyId(e.target.value)}
                    placeholder="rzp_test_..."
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Test Key Secret</label>
                  <input
                    type="password"
                    value={testKeySecret}
                    onChange={(e) => setTestKeySecret(e.target.value)}
                    placeholder="Leave blank to keep existing"
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400"
                  />
                </div>
              </div>

              {/* Live Credentials */}
              <div className="space-y-3 p-4 border-2 border-green-200 rounded-lg bg-green-50">
                <h5 className="font-medium text-green-900">🟢 Live Credentials</h5>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Live Key ID</label>
                  <input
                    type="text"
                    value={liveKeyId}
                    onChange={(e) => setLiveKeyId(e.target.value)}
                    placeholder="rzp_live_..."
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-300 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Live Key Secret</label>
                  <input
                    type="password"
                    value={liveKeySecret}
                    onChange={(e) => setLiveKeySecret(e.target.value)}
                    placeholder="Leave blank to keep existing"
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-300 focus:border-green-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => fetchPartnerDetails()}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Reset Changes
            </button>
            <button
              onClick={handleSaveRazorpayIntegration}
              disabled={isSavingRazorpay}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingRazorpay ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Integration Settings
                </>
              )}
            </button>
          </div>
        </div>
          )}
        </div>
      )}

      {activeTab === 'api-docs' && (
        <div className="bg-white rounded-lg border p-6">
          <div className="max-w-4xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Partner API Documentation</h3>
            <p className="text-gray-600 mb-6">Comprehensive API documentation for integrating with our platform.</p>

            <div className="space-y-6">
              {/* Integration Mode Info */}
              <div className={`rounded-lg p-4 border-2 ${partner.razorpayIntegration?.enabled
                ? 'bg-green-50 border-green-300'
                : 'bg-blue-50 border-blue-300'
                }`}>
                <div className="flex items-center gap-3 mb-3">
                  {partner.razorpayIntegration?.enabled ? (
                    <>
                      <CreditCard className="h-6 w-6 text-green-600" />
                      <h4 className="font-semibold text-green-900">Razorpay Integration Mode</h4>
                    </>
                  ) : (
                    <>
                      <Wallet className="h-6 w-6 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Wallet Mode</h4>
                    </>
                  )}
                </div>
                <p className="text-sm mb-3">
                  {partner.razorpayIntegration?.enabled
                    ? `This partner is configured for Razorpay integration with ${partner.razorpayIntegration.paymentMode === 'wallet' ? 'wallet' : 'direct'} payment mode. Orders can be placed from whitelisted domains.`
                    : 'This partner uses the wallet system. API key is required for all requests, and order amounts are deducted from wallet balance.'
                  }
                </p>
                {partner.razorpayIntegration?.enabled && (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Allowed Domains:</p>
                    <div className="flex flex-wrap gap-2">
                      {partner.razorpayIntegration.allowedDomains?.length > 0 ? (
                        partner.razorpayIntegration.allowedDomains.map((domain) => (
                          <span key={domain} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-mono">
                            {domain}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">No domains configured</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  Quick Links
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Link
                    href="/partner-api-docs"
                    target="_blank"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Full API Documentation
                  </Link>
                  <Link
                    href="/partner-api-docs?tab=integration-modes"
                    target="_blank"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <Settings className="h-4 w-4" />
                    Integration Modes Guide
                  </Link>
                  <Link
                    href="/partner-api-docs?tab=playground"
                    target="_blank"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    API Playground
                  </Link>
                  <Link
                    href="/partner-api-docs?tab=authentication"
                    target="_blank"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <Key className="h-4 w-4" />
                    Authentication Guide
                  </Link>
                  <Link
                    href="/partner-api-docs?tab=products"
                    target="_blank"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <Package className="h-4 w-4" />
                    Products API
                  </Link>
                  <Link
                    href="/partner-api-docs?tab=orders"
                    target="_blank"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Orders API
                  </Link>
                </div>
              </div>

              {/* API Base URL */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">API Base URL</h4>
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-green-400 text-sm">{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/partner</code>
                </div>
              </div>

              {/* API Keys Section */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Your API Keys</h4>
                <p className="text-sm text-gray-600 mb-3">Use these keys to authenticate your API requests.</p>
                <div className="space-y-2">
                  {apiKeys.filter(k => k.status === 'active').map(key => (
                    <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-sm">{key.environment === 'live' ? 'Live API Key' : 'Test API Key'}</p>
                          <p className="text-xs text-gray-500">Prefix: {key.prefix}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${key.environment === 'live' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {key.environment}
                      </span>
                    </div>
                  ))}
                  {apiKeys.filter(k => k.status === 'active').length === 0 && (
                    <p className="text-sm text-gray-500">No active API keys. Generate one in the API Keys tab.</p>
                  )}
                </div>
              </div>

              {/* Sample Request */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Sample Request</h4>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-sm text-gray-400">cURL Example - List Products</span>
                    <button
                      onClick={() => {
                        const code = `curl -X GET '${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/partner/products' \\
  -H 'Authorization: Bearer YOUR_API_KEY'`
                        navigator.clipboard.writeText(code)
                        toast.success('Copied to clipboard')
                      }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm">
                    <code className="text-gray-100">{`curl -X GET '${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/partner/products' \\
  -H 'Authorization: Bearer YOUR_API_KEY'`}</code>
                  </pre>
                </div>
              </div>

              {/* Create Order Example */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Create Order Example</h4>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-sm text-gray-400">JavaScript Example</span>
                    <button
                      onClick={() => {
                        const code = `const response = await apiFetch('${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/partner/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+919876543210',
      address: {
        line1: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      }
    },
    items: [
      { productId: 'PRODUCT_ID', quantity: 1 }
    ],
    paymentMethod: 'prepaid'
  })
});

const data = await response.json();
console.log('Order created:', data);`
                        navigator.clipboard.writeText(code)
                        toast.success('Copied to clipboard')
                      }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm max-h-64 overflow-y-auto">
                    <code className="text-gray-100">{`const response = await apiFetch('${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/partner/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+919876543210',
      address: {
        line1: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      }
    },
    items: [
      { productId: 'PRODUCT_ID', quantity: 1 }
    ],
    paymentMethod: 'prepaid'
  })
});

const data = await response.json();
console.log('Order created:', data);`}</code>
                  </pre>
                </div>
              </div>

              {/* Getting Started */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Getting Started</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>Generate an API key from the API Keys tab</li>
                  <li>Include the API key in the Authorization header of your requests</li>
                  <li>Start with the Products API to fetch available products</li>
                  <li>Use the Orders API to create and manage orders</li>
                  <li>Monitor your wallet balance and transactions</li>
                </ol>
              </div>

              {/* Integration Mode Specific Instructions */}
              {partner.razorpayIntegration?.enabled ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Razorpay Integration Instructions
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-green-800">
                    <li>Ensure your website domain is whitelisted in the Razorpay Integration tab</li>
                    <li>Include CORS headers in your requests from allowed domains</li>
                    <li>Create orders using the <code className="bg-green-100 px-1 rounded">/orders/razorpay/create</code> endpoint</li>
                    <li>Handle Razorpay payment on your frontend</li>
                    <li>Verify payment using the <code className="bg-green-100 px-1 rounded">/orders/razorpay/verify</code> endpoint</li>
                  </ol>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Wallet Mode Instructions
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                    <li>Ensure you have sufficient wallet balance before placing orders</li>
                    <li>Collect payment from your customer first</li>
                    <li>Create orders using the <code className="bg-blue-100 px-1 rounded">/orders</code> endpoint</li>
                    <li>Order amount will be automatically deducted from your wallet</li>
                    <li>Track your earnings and request payouts from the Wallet section</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
