"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  Key, 
  Eye, 
  EyeOff, 
  Play, 
  Copy, 
  Check, 
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Code,
  Zap,
  Package,
  ShoppingCart,
  Wallet,
  CreditCard,
  RefreshCw,
  Send,
  FileJson,
  Terminal,
  XCircle,
  Info,
  Settings,
  Globe,
  Shield
} from "lucide-react"
import Link from "next/link"
import { toast, Toaster } from "react-hot-toast"

// Types
interface Endpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  category: 'products' | 'orders' | 'wallet' | 'registration' | 'razorpay' | 'settings'
  params?: Parameter[]
  queryParams?: Parameter[]
  bodyTemplate?: object
  requiresAuth: boolean
}

interface Parameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  required: boolean
  description: string
  placeholder?: string
  default?: string | number | boolean
}

// All Partner API Endpoints
const endpoints: Endpoint[] = [
  // Products
  {
    id: 'products-list',
    name: 'List Products',
    method: 'GET',
    path: '/api/v1/partner/products',
    description: 'Get a list of all products with pagination and filters',
    category: 'products',
    requiresAuth: true,
    queryParams: [
      { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)', placeholder: '1', default: 1 },
      { name: 'limit', type: 'number', required: false, description: 'Items per page (max: 100)', placeholder: '20', default: 20 },
      { name: 'search', type: 'string', required: false, description: 'Search by name, SKU, or description', placeholder: 'laptop' },
      { name: 'category', type: 'string', required: false, description: 'Filter by category', placeholder: 'electronics' },
      { name: 'subCategory', type: 'string', required: false, description: 'Filter by sub-category', placeholder: 'laptops' },
      { name: 'brand', type: 'string', required: false, description: 'Filter by brand', placeholder: 'samsung' },
      { name: 'minPrice', type: 'number', required: false, description: 'Minimum price filter', placeholder: '1000' },
      { name: 'maxPrice', type: 'number', required: false, description: 'Maximum price filter', placeholder: '50000' },
      { name: 'inStock', type: 'boolean', required: false, description: 'Only show in-stock items', default: false },
    ]
  },
  {
    id: 'products-detail',
    name: 'Get Product Details',
    method: 'GET',
    path: '/api/v1/partner/products/{productId}',
    description: 'Get detailed information about a specific product',
    category: 'products',
    requiresAuth: true,
    params: [
      { name: 'productId', type: 'string', required: true, description: 'The product ID', placeholder: '507f1f77bcf86cd799439011' }
    ]
  },
  {
    id: 'products-specifications',
    name: 'Get Product Specifications',
    method: 'GET',
    path: '/api/v1/partner/products/{productId}/specifications',
    description: 'Get rich product specifications including technical details, manufacturer info, and features',
    category: 'products',
    requiresAuth: true,
    params: [
      { name: 'productId', type: 'string', required: true, description: 'The product ID', placeholder: '507f1f77bcf86cd799439011' }
    ]
  },
  {
    id: 'products-stock-check',
    name: 'Check Stock',
    method: 'POST',
    path: '/api/v1/partner/products/stock-check',
    description: 'Check stock and pricing for multiple products at once (max 50)',
    category: 'products',
    requiresAuth: true,
    bodyTemplate: {
      productIds: ['product_id_1', 'product_id_2']
    }
  },
  
  // Orders
  {
    id: 'orders-create',
    name: 'Create Order',
    method: 'POST',
    path: '/api/v1/partner/orders',
    description: 'Create a new order with customer and product details',
    category: 'orders',
    requiresAuth: true,
    bodyTemplate: {
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        address: {
          line1: '123 Main Street',
          line2: 'Apt 4B',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        }
      },
      items: [
        { productId: 'product_id_here', quantity: 1 }
      ],
      paymentMethod: 'prepaid',
      paymentDetails: {
        razorpayOrderId: 'order_xxxxx',
        transactionId: 'pay_xxxxx',
        method: 'razorpay'
      },
      partnerOrderId: 'YOUR_ORDER_123',
      notes: 'Optional order notes'
    }
  },
  {
    id: 'orders-list',
    name: 'List Orders',
    method: 'GET',
    path: '/api/v1/partner/orders',
    description: 'Get a list of all your orders with pagination',
    category: 'orders',
    requiresAuth: true,
    queryParams: [
      { name: 'page', type: 'number', required: false, description: 'Page number', placeholder: '1', default: 1 },
      { name: 'limit', type: 'number', required: false, description: 'Items per page (max: 100)', placeholder: '20', default: 20 },
      { name: 'status', type: 'string', required: false, description: 'Filter by status (pending, confirmed, shipped, delivered, cancelled)', placeholder: 'pending' },
      { name: 'fromDate', type: 'string', required: false, description: 'Start date (ISO format)', placeholder: '2024-01-01' },
      { name: 'toDate', type: 'string', required: false, description: 'End date (ISO format)', placeholder: '2024-12-31' },
    ]
  },
  {
    id: 'orders-detail',
    name: 'Get Order Details',
    method: 'GET',
    path: '/api/v1/partner/orders/{orderId}',
    description: 'Get detailed information about a specific order',
    category: 'orders',
    requiresAuth: true,
    params: [
      { name: 'orderId', type: 'string', required: true, description: 'The order ID', placeholder: 'ORD-20240101-XXXXX' }
    ]
  },
  {
    id: 'orders-status',
    name: 'Get Order Status',
    method: 'GET',
    path: '/api/v1/partner/orders/status/{id}',
    description: 'Get real-time order status and tracking. Accepts internal order ID or your partner order ID.',
    category: 'orders',
    requiresAuth: true,
    params: [
      { name: 'id', type: 'string', required: true, description: 'Internal Order ID or your Partner Order ID', placeholder: 'PO-12345 or BW-ORD-xxx' }
    ]
  },
  {
    id: 'orders-cancel',
    name: 'Cancel Order',
    method: 'POST',
    path: '/api/v1/partner/orders/{orderId}/cancel',
    description: 'Cancel an existing order',
    category: 'orders',
    requiresAuth: true,
    params: [
      { name: 'orderId', type: 'string', required: true, description: 'The order ID to cancel', placeholder: 'ORD-20240101-XXXXX' }
    ],
    bodyTemplate: {
      reason: 'Customer requested cancellation'
    }
  },
  
  // Wallet
  {
    id: 'wallet-balance',
    name: 'Get Wallet Balance',
    method: 'GET',
    path: '/api/v1/partner/wallet/balance',
    description: 'Get your current wallet balance',
    category: 'wallet',
    requiresAuth: true,
  },
  {
    id: 'wallet-transactions',
    name: 'Get Transactions',
    method: 'GET',
    path: '/api/v1/partner/wallet/transactions',
    description: 'Get wallet transaction history',
    category: 'wallet',
    requiresAuth: true,
    queryParams: [
      { name: 'page', type: 'number', required: false, description: 'Page number', placeholder: '1', default: 1 },
      { name: 'limit', type: 'number', required: false, description: 'Items per page', placeholder: '20', default: 20 },
      { name: 'type', type: 'string', required: false, description: 'Filter by type (credit, debit, hold, release)', placeholder: 'credit' },
      { name: 'category', type: 'string', required: false, description: 'Filter by category', placeholder: 'order_commission' },
      { name: 'fromDate', type: 'string', required: false, description: 'Start date (ISO format)', placeholder: '2024-01-01' },
      { name: 'toDate', type: 'string', required: false, description: 'End date (ISO format)', placeholder: '2024-12-31' },
    ]
  },
  {
    id: 'wallet-bank-accounts-list',
    name: 'List Bank Accounts',
    method: 'GET',
    path: '/api/v1/partner/wallet/bank-accounts',
    description: 'Get all linked bank accounts',
    category: 'wallet',
    requiresAuth: true,
  },
  {
    id: 'wallet-bank-accounts-add',
    name: 'Add Bank Account',
    method: 'POST',
    path: '/api/v1/partner/wallet/bank-accounts',
    description: 'Add a new bank account for payouts',
    category: 'wallet',
    requiresAuth: true,
    bodyTemplate: {
      accountNumber: '1234567890123456',
      accountHolderName: 'John Doe',
      bankName: 'HDFC Bank',
      ifsc: 'HDFC0001234',
      isDefault: true
    }
  },
  {
    id: 'wallet-payout-request',
    name: 'Request Payout',
    method: 'POST',
    path: '/api/v1/partner/wallet/payout',
    description: 'Request a payout to your bank account',
    category: 'wallet',
    requiresAuth: true,
    bodyTemplate: {
      amount: 5000,
      bankAccountId: 'bank_account_id_here',
      notes: 'Monthly payout request'
    }
  },
  {
    id: 'wallet-payouts-list',
    name: 'List Payouts',
    method: 'GET',
    path: '/api/v1/partner/wallet/payouts',
    description: 'Get payout history',
    category: 'wallet',
    requiresAuth: true,
    queryParams: [
      { name: 'page', type: 'number', required: false, description: 'Page number', placeholder: '1', default: 1 },
      { name: 'limit', type: 'number', required: false, description: 'Items per page', placeholder: '20', default: 20 },
      { name: 'status', type: 'string', required: false, description: 'Filter by status (pending_approval, approved, processing, completed, failed, rejected)', placeholder: 'completed' },
    ]
  },
  
  // Registration (No Auth Required)
  {
    id: 'partner-register',
    name: 'Register Partner',
    method: 'POST',
    path: '/api/v1/partner/register',
    description: 'Register as a new partner (no API key required)',
    category: 'registration',
    requiresAuth: false,
    bodyTemplate: {
      name: 'Your Business Name',
      email: 'business@example.com',
      phone: '9876543210',
      website: 'https://yourwebsite.com',
      businessDetails: {
        gstin: '22AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
        businessType: 'private_limited',
        registeredAddress: {
          line1: '123 Business Park',
          line2: 'Suite 456',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        }
      }
    }
  },
  
  // Razorpay Payment Endpoints
  {
    id: 'razorpay-create-order',
    name: 'Create Razorpay Order',
    method: 'POST',
    path: '/api/v1/partner/orders/razorpay/create',
    description: 'Create a Razorpay order for payment processing. Returns order ID and key for frontend integration.',
    category: 'razorpay',
    requiresAuth: true,
    bodyTemplate: {
      orderId: 'YOUR_ORDER_ID_123',
      amount: 999.99,
      currency: 'INR',
      receipt: 'receipt_123',
      notes: {
        customerName: 'John Doe',
        customerPhone: '9876543210'
      }
    }
  },
  {
    id: 'razorpay-verify-payment',
    name: 'Verify Razorpay Payment',
    method: 'POST',
    path: '/api/v1/partner/orders/razorpay/verify',
    description: 'Verify Razorpay payment signature after successful payment. Confirms payment authenticity.',
    category: 'razorpay',
    requiresAuth: true,
    bodyTemplate: {
      razorpay_payment_id: 'pay_xxxxx',
      razorpay_order_id: 'order_xxxxx',
      razorpay_signature: 'signature_xxxxx'
    }
  },

  // Settings / Domain Management Endpoints
  {
    id: 'get-allowed-domains',
    name: 'Get Allowed Domains & Methods',
    method: 'GET',
    path: '/api/v1/partner/api-keys/domains',
    description: 'Get the list of whitelisted domains and HTTP methods for your API key',
    category: 'settings',
    requiresAuth: true,
  },
  {
    id: 'update-allowed-domains',
    name: 'Update Allowed Domains & Methods',
    method: 'PUT',
    path: '/api/v1/partner/api-keys/domains',
    description: 'Update the whitelisted domains and HTTP methods that can use your API key',
    category: 'settings',
    requiresAuth: true,
    bodyTemplate: {
      domains: [
        'https://yourwebsite.com',
        '*.yourwebsite.com',
        'localhost:3000'
      ],
      methods: [
        'GET',
        'POST',
        'OPTIONS'
      ]
    }
  },
]

// Method color mapping
const methodColors: Record<string, { bg: string; text: string }> = {
  GET: { bg: 'bg-green-100', text: 'text-green-700' },
  POST: { bg: 'bg-blue-100', text: 'text-blue-700' },
  PUT: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-700' },
}

// Category icons
const categoryIcons: Record<string, React.ReactNode> = {
  products: <Package className="h-4 w-4" />,
  orders: <ShoppingCart className="h-4 w-4" />,
  wallet: <Wallet className="h-4 w-4" />,
  registration: <Key className="h-4 w-4" />,
  razorpay: <CreditCard className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
}

export default function PartnerAPITestPage() {
  const [apiKey, setApiKey] = useState('')
  const [bypassSecret, setBypassSecret] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showBypassSecret, setShowBypassSecret] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isCheckingAccess, setIsCheckingAccess] = useState(false)
  const [accessStatus, setAccessStatus] = useState<'idle' | 'allowed' | 'denied' | 'error'>('idle')
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(endpoints[0])
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [queryParamValues, setQueryParamValues] = useState<Record<string, string>>({})
  const [requestBody, setRequestBody] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load API key and bypass secret from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('partner_api_key')
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
    const savedBypassSecret = localStorage.getItem('partner_bypass_secret')
    if (savedBypassSecret) {
      setBypassSecret(savedBypassSecret)
    }
  }, [])

  // Save API key to localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('partner_api_key', apiKey)
    }
  }, [apiKey])

  // Save bypass secret to localStorage
  useEffect(() => {
    if (bypassSecret) {
      localStorage.setItem('partner_bypass_secret', bypassSecret)
    }
  }, [bypassSecret])

  // Update request body when endpoint changes
  useEffect(() => {
    if (selectedEndpoint.bodyTemplate) {
      setRequestBody(JSON.stringify(selectedEndpoint.bodyTemplate, null, 2))
    } else {
      setRequestBody('')
    }
    setParamValues({})
    
    // Set default values for query params
    const defaults: Record<string, string> = {}
    if (selectedEndpoint.queryParams) {
      selectedEndpoint.queryParams.forEach(param => {
        if (param.default !== undefined) {
          defaults[param.name] = String(param.default)
        }
      })
    }
    setQueryParamValues(defaults)
    
    setResponse(null)
    setStatusCode(null)
    setResponseTime(null)
    setError(null)
  }, [selectedEndpoint])

  // Build full URL with path params and query params
  const buildUrl = useCallback(() => {
    let url = selectedEndpoint.path
    
    // Replace path parameters
    if (selectedEndpoint.params) {
      for (const param of selectedEndpoint.params) {
        const value = paramValues[param.name] || ''
        url = url.replace(`{${param.name}}`, encodeURIComponent(value))
      }
    }
    
    // Add query parameters
    if (selectedEndpoint.queryParams) {
      const queryParts: string[] = []
      for (const param of selectedEndpoint.queryParams) {
        const value = queryParamValues[param.name]
        // Include if value is set and not empty string (but include '0' and 'false')
        if (value !== undefined && value !== '') {
          // Skip 'false' for boolean params unless it's meant to be included
          if (param.type === 'boolean' && value === 'false') {
            continue
          }
          queryParts.push(`${param.name}=${encodeURIComponent(value)}`)
        }
      }
      if (queryParts.length > 0) {
        url += '?' + queryParts.join('&')
      }
    }
    
    return url
  }, [selectedEndpoint, paramValues, queryParamValues])

  // Execute API request
  const executeRequest = async () => {
    // Only require API key for authenticated endpoints
    if (selectedEndpoint.requiresAuth && !apiKey) {
      toast.error('Please enter your API key')
      return
    }

    // Validate required params
    if (selectedEndpoint.params) {
      for (const param of selectedEndpoint.params) {
        if (param.required && !paramValues[param.name]) {
          toast.error(`Missing required parameter: ${param.name}`)
          return
        }
      }
    }

    setIsLoading(true)
    setError(null)
    setResponse(null)
    setStatusCode(null)
    setResponseTime(null)

    const startTime = performance.now()

    try {
      const url = buildUrl()
      
      console.log('[API Test] Sending request to:', url)
      console.log('[API Test] Method:', selectedEndpoint.method)
      console.log('[API Test] Requires Auth:', selectedEndpoint.requiresAuth)
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // Only add Authorization header for authenticated endpoints
      if (selectedEndpoint.requiresAuth && apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
        console.log('[API Test] Using API Key')
      }
      
      // Add bypass secret header if provided (for bypassing Vercel Attack Challenge)
      if (bypassSecret) {
        headers['x-vercel-protection-bypass'] = bypassSecret
        console.log('[API Test] Using Protection Bypass Secret')
      }
      
      const fetchOptions: RequestInit = {
        method: selectedEndpoint.method,
        headers,
      }

      if (selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') {
        if (requestBody) {
          try {
            JSON.parse(requestBody)
            fetchOptions.body = requestBody
            console.log('[API Test] Request body:', requestBody)
          } catch (e) {
            toast.error('Invalid JSON in request body')
            setIsLoading(false)
            return
          }
        }
      }

      const res = await fetch(url, fetchOptions)
      const endTime = performance.now()
      
      console.log('[API Test] Response status:', res.status)
      
      setResponseTime(Math.round(endTime - startTime))
      setStatusCode(res.status)

      const data = await res.json()
      console.log('[API Test] Response data:', data)
      setResponse(data)

      if (!res.ok) {
        setError(data.error?.message || data.error || 'Request failed')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute request')
      setResponse({ error: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  // Copy response to clipboard
  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2))
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Format JSON with syntax highlighting
  const formatJSON = (obj: any): string => {
    return JSON.stringify(obj, null, 2)
  }

  // Group endpoints by category
  const groupedEndpoints = endpoints.reduce((acc, endpoint) => {
    if (!acc[endpoint.category]) {
      acc[endpoint.category] = []
    }
    acc[endpoint.category].push(endpoint)
    return acc
  }, {} as Record<string, Endpoint[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                <Terminal className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Partner API Tester</h1>
                <p className="text-sm text-gray-500">Test all Partner API endpoints in real-time</p>
              </div>
            </div>
            <Link 
              href="/partner-api-docs" 
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <FileJson className="h-4 w-4" />
              View Documentation
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* API Key Input */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">API Authentication</h2>
          </div>
          
          {/* API Key Field */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Partner API Key (e.g., pk_live_xxxxx or pk_test_xxxxx)"
                className="w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {apiKey && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg h-fit mt-7">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Key Saved</span>
              </div>
            )}
          </div>
          
          {/* Protection Bypass Secret (Optional) */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-amber-500" />
              <label className="text-sm font-medium text-gray-700">Protection Bypass Secret (Optional)</label>
            </div>
            <div className="relative">
              <input
                type={showBypassSecret ? 'text' : 'password'}
                value={bypassSecret}
                onChange={(e) => setBypassSecret(e.target.value)}
                placeholder="Enter your protection bypass secret (contact admin if needed)"
                className="w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
              />
              <button
                onClick={() => setShowBypassSecret(!showBypassSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showBypassSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              For bypassing Vercel security protection during browser testing. Not needed for server-side API calls.
            </p>
          </div>

          {/* Website Access Checker */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-purple-500" />
              <label className="text-sm font-medium text-gray-700">Check Website Access</label>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => {
                    setWebsiteUrl(e.target.value)
                    setAccessStatus('idle')
                  }}
                  placeholder="https://your-website.com"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
              <button
                onClick={async () => {
                  if (!websiteUrl) {
                    toast.error('Please enter a website URL')
                    return
                  }
                  if (!apiKey) {
                    toast.error('Please enter your API key first')
                    return
                  }
                  setIsCheckingAccess(true)
                  setAccessStatus('idle')
                  try {
                    const response = await fetch('/api/v1/partner/api-keys/domains', {
                      headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                      }
                    })
                    const data = await response.json()
                    if (!response.ok) {
                      throw new Error(data.error?.message || 'Failed to check access')
                    }
                    
                    const allowedDomains = data.data?.allowedDomains || []
                    const urlObj = new URL(websiteUrl)
                    const hostname = urlObj.hostname
                    
                    // If no domains are configured, all are allowed
                    if (allowedDomains.length === 0) {
                      setAccessStatus('allowed')
                      toast.success('No restrictions - all domains are allowed')
                    } else {
                      // Check if domain is in allowed list (including wildcards)
                      const isAllowed = allowedDomains.some((domain: string) => {
                        if (domain.startsWith('*.')) {
                          const baseDomain = domain.slice(2)
                          return hostname === baseDomain || hostname.endsWith('.' + baseDomain)
                        }
                        return hostname === domain || hostname === domain.replace(/^www\./, '')
                      })
                      
                      if (isAllowed) {
                        setAccessStatus('allowed')
                        toast.success('Website has access!')
                      } else {
                        setAccessStatus('denied')
                        toast.error('Website does not have access')
                      }
                    }
                  } catch (err: any) {
                    setAccessStatus('error')
                    toast.error(err.message || 'Failed to check access')
                  } finally {
                    setIsCheckingAccess(false)
                  }
                }}
                disabled={isCheckingAccess || !websiteUrl}
                className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              >
                {isCheckingAccess ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Check Access
              </button>
            </div>
            
            {/* Access Status Display */}
            {accessStatus !== 'idle' && (
              <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                accessStatus === 'allowed' ? 'bg-green-50 text-green-700' :
                accessStatus === 'denied' ? 'bg-red-50 text-red-700' :
                'bg-yellow-50 text-yellow-700'
              }`}>
                {accessStatus === 'allowed' && <CheckCircle className="h-4 w-4" />}
                {accessStatus === 'denied' && <XCircle className="h-4 w-4" />}
                {accessStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                <span className="text-sm font-medium">
                  {accessStatus === 'allowed' && 'This website has access to the API'}
                  {accessStatus === 'denied' && 'This website is not in the allowed domains list'}
                  {accessStatus === 'error' && 'Error checking access status'}
                </span>
              </div>
            )}
            
            <p className="mt-2 text-xs text-gray-500">
              Check if a website URL is allowed to access the Partner API based on your domain whitelist.
            </p>
          </div>
          
          <p className="mt-4 text-sm text-gray-500">
            Your credentials are stored locally and never sent to our servers. Get your API key from the{' '}
            <Link href="/partner-api-docs?tab=authentication" className="text-blue-600 hover:underline">
              Partner Dashboard
            </Link>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Panel */}
          <div className="space-y-6">
            {/* Endpoint Selection */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">Select Endpoint</h2>
              </div>
              
              <select
                value={selectedEndpoint.id}
                onChange={(e) => {
                  const endpoint = endpoints.find(ep => ep.id === e.target.value)
                  if (endpoint) setSelectedEndpoint(endpoint)
                }}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {Object.entries(groupedEndpoints).map(([category, eps]) => (
                  <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                    {eps.map(ep => (
                      <option key={ep.id} value={ep.id}>
                        {ep.method} {ep.path} - {ep.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* Selected Endpoint Info */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[selectedEndpoint.method].bg} ${methodColors[selectedEndpoint.method].text}`}>
                    {selectedEndpoint.method}
                  </span>
                  <code className="text-sm font-mono text-gray-700 flex-1 break-all">
                    {buildUrl()}
                  </code>
                </div>
                <p className="mt-2 text-sm text-gray-600">{selectedEndpoint.description}</p>
              </div>
            </div>

            {/* Path Parameters */}
            {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Code className="h-5 w-5 text-purple-500" />
                  <h2 className="text-lg font-semibold">Path Parameters</h2>
                </div>
                <div className="space-y-4">
                  {selectedEndpoint.params.map(param => (
                    <div key={param.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {param.name}
                        {param.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={paramValues[param.name] || ''}
                        onChange={(e) => setParamValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                        placeholder={param.placeholder}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">{param.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Query Parameters */}
            {selectedEndpoint.queryParams && selectedEndpoint.queryParams.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold">Query Parameters</h2>
                </div>
                <div className="space-y-4">
                  {selectedEndpoint.queryParams.map(param => (
                    <div key={param.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {param.name}
                        {param.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {param.type === 'boolean' ? (
                        <select
                          value={queryParamValues[param.name] || 'false'}
                          onChange={(e) => setQueryParamValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : (
                        <input
                          type={param.type === 'number' ? 'number' : 'text'}
                          value={queryParamValues[param.name] || ''}
                          onChange={(e) => setQueryParamValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                          placeholder={param.placeholder}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                      )}
                      <p className="mt-1 text-xs text-gray-500">{param.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Body */}
            {(selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-orange-500" />
                    <h2 className="text-lg font-semibold">Request Body</h2>
                  </div>
                  {selectedEndpoint.bodyTemplate && (
                    <button
                      onClick={() => setRequestBody(JSON.stringify(selectedEndpoint.bodyTemplate, null, 2))}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Reset to Template
                    </button>
                  )}
                </div>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none bg-gray-900 text-gray-100"
                  placeholder='{"key": "value"}'
                />
                <p className="mt-2 text-xs text-gray-500">
                  Edit the JSON body above. Make sure to replace placeholder values with actual data.
                </p>
              </div>
            )}

            {/* Request Preview */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border-2 border-blue-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">Request Preview</h3>
              </div>
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 px-2 py-0.5 text-xs font-bold rounded ${methodColors[selectedEndpoint.method].bg} ${methodColors[selectedEndpoint.method].text}`}>
                  {selectedEndpoint.method}
                </span>
                <code className="flex-1 text-xs font-mono text-gray-700 break-all">
                  {buildUrl()}
                </code>
              </div>
              {selectedEndpoint.requiresAuth && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                  <Key className="h-3 w-3" />
                  <span>Auth: {apiKey ? '✓ API Key provided' : '✗ No API Key'}</span>
                </div>
              )}
            </div>

            {/* Execute Button */}
            <button
              onClick={executeRequest}
              disabled={isLoading || (selectedEndpoint.requiresAuth && !apiKey)}
              className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-white transition-all ${
                isLoading || (selectedEndpoint.requiresAuth && !apiKey)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Request
                </>
              )}
            </button>
          </div>

          {/* Response Panel */}
          <div className="bg-white rounded-xl shadow-sm border p-6 h-fit sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold">Response</h2>
              </div>
              {response && (
                <button
                  onClick={copyResponse}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {/* Status Bar */}
            {(statusCode || responseTime) && (
              <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                {statusCode && (
                  <div className={`flex items-center gap-2 ${
                    statusCode >= 200 && statusCode < 300 
                      ? 'text-green-600' 
                      : statusCode >= 400 
                        ? 'text-red-600' 
                        : 'text-yellow-600'
                  }`}>
                    {statusCode >= 200 && statusCode < 300 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span className="font-mono font-semibold">Status: {statusCode}</span>
                  </div>
                )}
                {responseTime && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono text-sm">{responseTime}ms</span>
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Response Body */}
            {response ? (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-sm text-gray-400">Response Body</span>
                  <span className="text-xs text-gray-500 font-mono">JSON</span>
                </div>
                <pre className="p-4 overflow-auto max-h-[600px] text-sm text-gray-100 font-mono">
                  {formatJSON(response)}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Terminal className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-center">
                  {selectedEndpoint.requiresAuth && !apiKey 
                    ? 'Enter your API key to get started'
                    : 'Select an endpoint and click "Send Request"'}
                </p>
              </div>
            )}

            {/* Quick Tips */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Quick Tips</h4>
                  <ul className="mt-2 text-sm text-blue-700 space-y-1">
                    <li>• Use test API keys (pk_test_*) for testing</li>
                    <li>• Replace placeholder values in request bodies</li>
                    <li>• Check response times for performance insights</li>
                    <li>• Copy responses to use in your integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoint Reference Quick View */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">All Available Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupedEndpoints).map(([category, eps]) => (
              <div key={category} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {categoryIcons[category]}
                  <h3 className="font-medium text-gray-900 capitalize">{category}</h3>
                </div>
                <div className="space-y-2">
                  {eps.map(ep => (
                    <button
                      key={ep.id}
                      onClick={() => {
                        setSelectedEndpoint(ep)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 rounded transition-colors"
                    >
                      <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${methodColors[ep.method].bg} ${methodColors[ep.method].text}`}>
                        {ep.method}
                      </span>
                      <span className="text-sm text-gray-700 truncate">{ep.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500 pb-8">
          <p>
            Need help?{' '}
            <Link href="/partner-api-docs" className="text-blue-600 hover:underline">
              Read the full documentation
            </Link>
            {' '}or{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">
              contact support
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  )
}
