"use client"

import { useState, useCallback, useEffect, Suspense } from "react"
import {
  Book,
  Code,
  Key,
  ShoppingCart,
  Package,
  Wallet,
  Shield,
  Zap,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Terminal,
  FileJson,
  AlertCircle,
  Play,
  Loader2,
  Globe,
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Settings
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast, Toaster } from "react-hot-toast"

type TabId = 'overview' | 'authentication' | 'products' | 'orders' | 'wallet' | 'razorpay' | 'errors' | 'sdks' | 'playground' | 'integration-modes';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

function CodeBlock({ code, language = "json", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden my-4">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-sm text-gray-400">{title}</span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <div className="relative">
        {!title && (
          <button
            onClick={copyCode}
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
        <pre className="p-4 overflow-x-auto text-sm">
          <code className="text-gray-100">{code}</code>
        </pre>
      </div>
    </div>
  )
}

interface EndpointCardProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  id?: string;
  children: React.ReactNode;
}

function EndpointCard({ method, path, description, id, children }: EndpointCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const methodColors = {
    GET: 'bg-green-500',
    POST: 'bg-blue-500',
    PUT: 'bg-yellow-500',
    DELETE: 'bg-red-500',
  }

  return (
    <div id={id} className="border rounded-lg overflow-hidden mb-4 scroll-mt-20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <span className={`${methodColors[method]} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
          {method}
        </span>
        <code className="flex-1 font-mono text-sm">{path}</code>
        <span className="text-gray-500 text-sm hidden md:block">{description}</span>
        {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
      </button>
      {isOpen && (
        <div className="border-t p-4 bg-gray-50">
          <p className="text-gray-600 mb-4 md:hidden">{description}</p>
          {children}
        </div>
      )}
    </div>
  )
}

// API Playground Component
interface APIPlaygroundProps {
  apiKey: string;
  baseUrl: string;
}

function APIPlayground({ apiKey, baseUrl }: APIPlaygroundProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('products-list')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states for different endpoints
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productLimit, setProductLimit] = useState('10')

  // Order form states
  const [orderCustomerName, setOrderCustomerName] = useState('')
  const [orderCustomerEmail, setOrderCustomerEmail] = useState('')
  const [orderCustomerPhone, setOrderCustomerPhone] = useState('')
  const [orderAddressLine1, setOrderAddressLine1] = useState('')
  const [orderAddressCity, setOrderAddressCity] = useState('')
  const [orderAddressState, setOrderAddressState] = useState('')
  const [orderAddressPincode, setOrderAddressPincode] = useState('')
  const [orderItems, setOrderItems] = useState<Array<{ productId: string, quantity: number }>>([{ productId: '', quantity: 1 }])
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<'prepaid' | 'cod'>('prepaid')
  const [orderPartnerOrderId, setOrderPartnerOrderId] = useState('')

  const endpoints = [
    { id: 'products-list', name: 'List Products', method: 'GET', path: '/products' },
    { id: 'products-detail', name: 'Get Product', method: 'GET', path: '/products/{id}' },
    { id: 'products-specifications', name: 'Get Specifications', method: 'GET', path: '/products/{id}/specifications' },
    { id: 'products-stock', name: 'Check Stock', method: 'POST', path: '/products/stock-check' },
    { id: 'orders-create', name: 'Create Order', method: 'POST', path: '/orders' },
    { id: 'orders-list', name: 'List Orders', method: 'GET', path: '/orders' },
    { id: 'orders-status', name: 'Check Order Status', method: 'GET', path: '/orders/status/{id}' },
    { id: 'wallet-balance', name: 'Get Wallet Balance', method: 'GET', path: '/wallet/balance' },
    { id: 'wallet-transactions', name: 'Get Transactions', method: 'GET', path: '/wallet/transactions' },
  ]

  const executeRequest = async () => {
    if (!apiKey) {
      toast.error('Please enter your API key first')
      return
    }

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      let url = baseUrl
      let method = 'GET'
      let body: any = null

      switch (selectedEndpoint) {
        case 'products-list':
          url += `/products?limit=${productLimit}`
          if (productSearchQuery) url += `&search=${encodeURIComponent(productSearchQuery)}`
          if (productCategory) url += `&category=${encodeURIComponent(productCategory)}`
          break
        case 'products-detail':
          url += `/products/${orderItems[0].productId || '{id}'}`
          break
        case 'products-specifications':
          url += `/products/${orderItems[0].productId || '{id}'}/specifications`
          break
        case 'products-stock':
          url += '/products/stock-check'
          method = 'POST'
          body = { productIds: orderItems.filter(i => i.productId).map(i => i.productId) }
          break
        case 'orders-create':
          url += '/orders'
          method = 'POST'
          body = {
            customer: {
              name: orderCustomerName,
              email: orderCustomerEmail,
              phone: orderCustomerPhone,
              address: {
                line1: orderAddressLine1,
                city: orderAddressCity,
                state: orderAddressState,
                pincode: orderAddressPincode,
                country: 'India'
              }
            },
            items: orderItems.filter(i => i.productId),
            paymentMethod: orderPaymentMethod,
            ...(orderPaymentMethod === 'prepaid' ? {
              paymentDetails: {
                razorpayOrderId: 'order_xxxxx',
                transactionId: 'pay_xxxxx',
                method: 'razorpay'
              }
            } : {}),
            partnerOrderId: orderPartnerOrderId || undefined
          }
          break
        case 'orders-list':
          url += '/orders?limit=10'
          break
        case 'orders-status':
          url += `/orders/status/${orderPartnerOrderId || orderItems[0].productId || '{id}'}`
          break
        case 'wallet-balance':
          url += '/wallet/balance'
          break
        case 'wallet-transactions':
          url += '/wallet/transactions?limit=10'
          break
        default:
          throw new Error('Unknown endpoint')
      }

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }

      if (body) {
        fetchOptions.body = JSON.stringify(body)
      }

      const res = await fetch(url, fetchOptions)
      const data = await res.json()

      setResponse(data)

      if (!res.ok) {
        setError(`HTTP ${res.status}: ${data.error?.message || 'Request failed'}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute request')
    } finally {
      setIsLoading(false)
    }
  }

  const addOrderItem = () => {
    setOrderItems([...orderItems, { productId: '', quantity: 1 }])
  }

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const updateOrderItem = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    const updated = [...orderItems]
    updated[index] = { ...updated[index], [field]: value }
    setOrderItems(updated)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Request Panel */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900">Request</h4>

        {/* Endpoint Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint</label>
          <select
            value={selectedEndpoint}
            onChange={(e) => { setSelectedEndpoint(e.target.value); setResponse(null); setError(null); }}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <optgroup label="Products">
              <option value="products-list">GET /products - List Products</option>
              <option value="products-detail">GET /products/[id] - Product Detail</option>
              <option value="products-specifications">GET /products/[id]/specifications - Product Specifications</option>
              <option value="products-stock">POST /products/stock-check - Check Stock</option>
            </optgroup>
            <optgroup label="Orders">
              <option value="orders-create">POST /orders - Create Order</option>
              <option value="orders-list">GET /orders - List Orders</option>
              <option value="orders-status">GET /orders/status/[id] - Order Status</option>
            </optgroup>
            <optgroup label="Wallet">
              <option value="wallet-balance">GET /wallet/balance - Get Balance</option>
              <option value="wallet-transactions">GET /wallet/transactions - Get Transactions</option>
            </optgroup>
          </select>
        </div>

        {/* Products List Form */}
        {selectedEndpoint === 'products-list' && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-medium text-gray-700">Query Parameters</h5>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Category</label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  placeholder="e.g., televisions"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Limit</label>
                <input
                  type="number"
                  value={productLimit}
                  onChange={(e) => setProductLimit(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Product ID Form for detail/specifications */}
        {(selectedEndpoint === 'products-detail' || selectedEndpoint === 'products-specifications') && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-medium text-gray-700">Parameters</h5>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Product ID (Internal ID)</label>
              <input
                type="text"
                value={orderItems[0].productId}
                onChange={(e) => updateOrderItem(0, 'productId', e.target.value)}
                placeholder="Enter product ID..."
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        )}

        {/* Stock Check Form */}
        {selectedEndpoint === 'products-stock' && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-medium text-gray-700">Product IDs to Check</h5>
            {orderItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item.productId}
                  onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                  placeholder="Product ID"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
                />
                {orderItems.length > 1 && (
                  <button
                    onClick={() => removeOrderItem(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addOrderItem}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add another product
            </button>
          </div>
        )}

        {/* Create Order Form */}
        {selectedEndpoint === 'orders-create' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
            <h5 className="text-sm font-medium text-gray-700">Customer Information</h5>
            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                value={orderCustomerName}
                onChange={(e) => setOrderCustomerName(e.target.value)}
                placeholder="Customer Name *"
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  value={orderCustomerEmail}
                  onChange={(e) => setOrderCustomerEmail(e.target.value)}
                  placeholder="Email *"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="tel"
                  value={orderCustomerPhone}
                  onChange={(e) => setOrderCustomerPhone(e.target.value)}
                  placeholder="Phone *"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <h5 className="text-sm font-medium text-gray-700 pt-2">Delivery Address</h5>
            <div className="space-y-3">
              <input
                type="text"
                value={orderAddressLine1}
                onChange={(e) => setOrderAddressLine1(e.target.value)}
                placeholder="Address Line 1 *"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={orderAddressCity}
                  onChange={(e) => setOrderAddressCity(e.target.value)}
                  placeholder="City *"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={orderAddressState}
                  onChange={(e) => setOrderAddressState(e.target.value)}
                  placeholder="State *"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={orderAddressPincode}
                  onChange={(e) => setOrderAddressPincode(e.target.value)}
                  placeholder="Pincode *"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <h5 className="text-sm font-medium text-gray-700 pt-2">Order Items</h5>
            {orderItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item.productId}
                  onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                  placeholder="Product ID *"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  min="1"
                  placeholder="Qty"
                  className="w-20 px-3 py-2 border rounded-lg text-sm"
                />
                {orderItems.length > 1 && (
                  <button
                    onClick={() => removeOrderItem(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addOrderItem}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add another item
            </button>

            <h5 className="text-sm font-medium text-gray-700 pt-2">Payment & Reference</h5>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={orderPaymentMethod}
                onChange={(e) => setOrderPaymentMethod(e.target.value as 'prepaid' | 'cod')}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="prepaid">Prepaid</option>
                <option value="cod">Cash on Delivery</option>
              </select>
              <input
                type="text"
                value={orderPartnerOrderId}
                onChange={(e) => setOrderPartnerOrderId(e.target.value)}
                placeholder="Your Order ID (optional)"
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        {/* Execute Button */}
        <button
          onClick={executeRequest}
          disabled={isLoading || !apiKey}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Send Request
            </>
          )}
        </button>
      </div>

      {/* Response Panel */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900">Response</h4>

        {!response && !error && (
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Terminal className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Response will appear here</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <XCircle className="h-4 w-4" />
              Error
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {response && (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
              <span className="text-sm text-gray-400">
                {response.success ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Success
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> Failed
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(response, null, 2))
                  toast.success('Copied to clipboard')
                }}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-auto max-h-96 text-sm">
              <code className="text-gray-100">
                {JSON.stringify(response, null, 2)}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PartnerAPIDocsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading API Documentation...</p>
        </div>
      </div>
    }>
      <PartnerAPIDocsContent />
    </Suspense>
  )
}

function PartnerAPIDocsContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState('/api/v1/partner')

  useEffect(() => {
    console.log("SaraMobiles Partner API Docs - New Changes Loaded (Order Status API)");
    setBaseUrl(`${window.location.origin}/api/v1/partner`)
  }, [])

  // Set tab from URL params on load
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabId | null
    const validTabs: TabId[] = ['overview', 'integration-modes', 'authentication', 'products', 'orders', 'wallet', 'razorpay', 'playground', 'errors', 'sdks']
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Book className="h-4 w-4" /> },
    { id: 'integration-modes', label: 'Integration Modes', icon: <Settings className="h-4 w-4" /> },
    { id: 'authentication', label: 'Authentication', icon: <Key className="h-4 w-4" /> },
    { id: 'products', label: 'Products API', icon: <Package className="h-4 w-4" /> },
    { id: 'orders', label: 'Orders API', icon: <ShoppingCart className="h-4 w-4" /> },
    { id: 'wallet', label: 'Wallet API', icon: <Wallet className="h-4 w-4" /> },
    { id: 'razorpay', label: 'Razorpay API', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'playground', label: 'API Playground', icon: <Play className="h-4 w-4" /> },
    { id: 'errors', label: 'Error Handling', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'sdks', label: 'SDKs & Libraries', icon: <Code className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <Code className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SaraMobiles Partner API</h1>
                <p className="text-xs text-gray-500">v1.0.0</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* API Key Input */}
              <div className="hidden md:flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-400" />
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-64 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 pr-8"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? '🙈' : '👁️'}
                  </button>
                </div>
                {apiKey && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Key Set
                  </span>
                )}
              </div>
              <Link
                href="/partner-api-test"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
              >
                <Play className="h-4 w-4" />
                Test Your API
              </Link>
              <a
                href="mailto:support@sarastores.com"
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                API Support
              </a>
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-blue-600"
              >
                Main Site
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <nav className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-lg border p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Documentation</h2>
              <ul className="space-y-1">
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.id === 'orders' && (
                        <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                          NEW
                        </span>
                      )}
                    </button>
                    {tab.id === 'products' && (
                      <ul className="ml-9 mt-1 space-y-1 mb-2">
                        <li>
                          <button
                            onClick={() => {
                              setActiveTab('products');
                              setTimeout(() => {
                                document.getElementById('product-specs')?.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            }}
                            className="text-[11px] text-gray-500 hover:text-blue-600 py-1 block w-full text-left transition-colors"
                          >
                            • Product Specifications
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-6 border-t">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Quick Links
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#rate-limits" className="text-gray-600 hover:text-blue-600">
                      Rate Limits
                    </a>
                  </li>
                  <li>
                    <a href="#webhooks" className="text-gray-600 hover:text-blue-600">
                      Webhooks
                    </a>
                  </li>
                  <li>
                    <a href="#sandbox" className="text-gray-600 hover:text-blue-600">
                      Sandbox Testing
                    </a>
                  </li>
                </ul>
              </div>

              {/* Test Your API Button */}
              <div className="mt-6 pt-6 border-t">
                <Link
                  href="/partner-api-test"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-semibold"
                >
                  <Play className="h-5 w-5" />
                  Test Your API
                </Link>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Interactive API testing console
                </p>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border p-6 lg:p-8">

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to SaraMobiles Partner API</h2>
                  <p className="text-gray-600 mb-6">
                    Integrate our product catalog and order management system into your platform.
                    Sell our products on your website and earn commissions on every sale.
                  </p>

                  {/* Features Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                      <Package className="h-8 w-8 text-blue-600 mb-2" />
                      <h3 className="font-semibold text-gray-900">Product Catalog</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Access our complete product catalog with real-time pricing and stock information.
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                      <ShoppingCart className="h-8 w-8 text-green-600 mb-2" />
                      <h3 className="font-semibold text-gray-900">Order Management</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Create and track orders seamlessly. We handle fulfillment and delivery.
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <Wallet className="h-8 w-8 text-purple-600 mb-2" />
                      <h3 className="font-semibold text-gray-900">Wallet & Payouts</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Track your earnings in real-time and request payouts to your bank account.
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                      <Shield className="h-8 w-8 text-orange-600 mb-2" />
                      <h3 className="font-semibold text-gray-900">Secure & Reliable</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Enterprise-grade security with API key authentication and rate limiting.
                      </p>
                    </div>
                  </div>

                  {/* Important: Server-Side Requirement */}
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 my-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-red-900 mb-2">⚠️ Important: Use Server-Side API Calls</h3>
                        <p className="text-red-800 mb-3">
                          All API calls <strong>must be made from your server</strong>, not from browser JavaScript.
                          Browser-based requests will be blocked by security protection.
                        </p>
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">✅ Correct: Server-Side (Node.js, PHP, Python)</p>
                          <code className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded block mb-3">
                            Your Server → SaraMobiles API → Response → Your Frontend
                          </code>
                          <p className="text-sm font-semibold text-gray-900 mb-2">❌ Wrong: Browser JavaScript</p>
                          <code className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded block">
                            Browser → SaraMobiles API → BLOCKED
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bypass Protection for Testing */}
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-6 my-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <Key className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-amber-900 mb-2">🔑 Protection Bypass for Development</h3>
                        <p className="text-amber-800 mb-3">
                          For development and testing, you can bypass security protection by adding a special header to your requests.
                          Contact us to get your <strong>Protection Bypass Secret</strong>.
                        </p>
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">Add this header to your requests:</p>
                          <code className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded block font-mono">
                            x-vercel-protection-bypass: YOUR_BYPASS_SECRET
                          </code>
                          <p className="text-xs text-gray-500 mt-2">
                            This allows browser-based testing. For production, always use server-side calls.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Base URL</h3>
                  <CodeBlock
                    code="https://sarastores.com/api/v1/partner"
                    title="Production API Base URL"
                  />

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Quick Start</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Get Your API Key</h4>
                        <p className="text-sm text-gray-600">
                          Contact us to register as a partner and receive your API credentials.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Test in Sandbox</h4>
                        <p className="text-sm text-gray-600">
                          Use your test API key (sk_test_...) to integrate and test without real transactions.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Go Live</h4>
                        <p className="text-sm text-gray-600">
                          Switch to your live API key (sk_live_...) and start processing real orders.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div id="rate-limits" className="mt-8 pt-8 border-t">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Rate Limits</h3>
                    <p className="text-gray-600 mb-4">
                      Rate limits vary by your partner tier. Exceeding limits returns a 429 status code.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium text-gray-900">Tier</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-900">Requests/Min</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-900">Requests/Day</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-900">Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="px-4 py-2">Starter</td>
                            <td className="px-4 py-2">60</td>
                            <td className="px-4 py-2">1,000</td>
                            <td className="px-4 py-2">15%</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">Growth</td>
                            <td className="px-4 py-2">300</td>
                            <td className="px-4 py-2">10,000</td>
                            <td className="px-4 py-2">12%</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">Professional</td>
                            <td className="px-4 py-2">1,000</td>
                            <td className="px-4 py-2">100,000</td>
                            <td className="px-4 py-2">10%</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2">Enterprise</td>
                            <td className="px-4 py-2">5,000</td>
                            <td className="px-4 py-2">1,000,000</td>
                            <td className="px-4 py-2">Custom</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Integration Modes Tab */}
              {activeTab === 'integration-modes' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Integration Modes</h2>
                  <p className="text-gray-600 mb-6">
                    Choose the integration mode that best fits your business model. Each mode has different payment flows and requirements.
                  </p>

                  {/* Mode Comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Wallet Mode */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-600 rounded-lg">
                          <Wallet className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">Wallet Mode</h3>
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Recommended</span>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-4">
                        Use your API key to place orders. Payments are managed through your partner wallet with automatic commission deduction.
                      </p>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Centralized payment management</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Automatic commission deduction</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Track earnings in real-time</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Request payouts anytime</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Full API access from any origin</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">How it works:</h4>
                        <ol className="text-sm text-gray-600 space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                            <span>Customer places order on your website</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                            <span>You collect payment from customer</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                            <span>Call our API with your API key to create order</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                            <span>Amount is deducted from your wallet</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                            <span>We fulfill the order and ship to customer</span>
                          </li>
                        </ol>
                      </div>
                    </div>

                    {/* Razorpay Integration Mode */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border-2 border-green-300 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-600 rounded-lg">
                          <CreditCard className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">Razorpay Integration</h3>
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Domain Restricted</span>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-4">
                        Accept payments directly on your website using Razorpay. Orders are placed from whitelisted domains only.
                      </p>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Direct payments to your Razorpay account</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Seamless checkout experience</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Domain-based security</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Commission invoiced separately</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Requires domain whitelisting</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">How it works:</h4>
                        <ol className="text-sm text-gray-600 space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                            <span>Admin whitelists your website domains</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                            <span>Customer places order on your website</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                            <span>Customer pays via Razorpay on your site</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                            <span>Order is created via API (origin verified)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                            <span>We fulfill the order and ship to customer</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* API Key Requirements */}
                  <div className="bg-white rounded-lg border p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      API Key Requirements by Mode
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left font-medium text-gray-900">Feature</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-900">Wallet Mode</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-900">Razorpay Integration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="px-4 py-3">API Key Required</td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3">Domain Whitelisting Required</td>
                            <td className="px-4 py-3 text-center"><XCircle className="h-5 w-5 text-gray-400 mx-auto" /></td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3">Wallet Balance Required</td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                            <td className="px-4 py-3 text-center"><XCircle className="h-5 w-5 text-gray-400 mx-auto" /></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3">Backend API Calls</td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                            <td className="px-4 py-3 text-center"><span className="text-gray-600">Frontend allowed</span></td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3">Real-time Inventory Check</td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                            <td className="px-4 py-3 text-center"><CheckCircle className="h-5 w-5 text-green-600 mx-auto" /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Code Examples for Each Mode */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">Integration Examples</h3>

                    <div className="bg-white rounded-lg border p-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-600" />
                        Wallet Mode - Create Order
                      </h4>
                      <CodeBlock
                        code={`// Backend API call with your API key
const response = await fetch('https://sarastores.com/api/v1/partner/orders', {
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
      { productId: 'prod_abc123', quantity: 1 }
    ],
    paymentMethod: 'prepaid', // You already collected payment
    partnerOrderId: 'YOUR_ORDER_123'
  })
});

const data = await response.json();
console.log('Order created:', data.data.orderId);`}
                        title="Wallet Mode - Server-side Order Creation"
                      />
                    </div>

                    <div className="bg-white rounded-lg border p-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-green-600" />
                        Razorpay Integration - Create Order with Payment
                      </h4>
                      <CodeBlock
                        code={`// Frontend code on your whitelisted domain
// Step 1: Create Razorpay order
const orderResponse = await fetch('https://sarastores.com/api/v1/partner/orders/razorpay/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderId: 'YOUR_ORDER_ID_123',   // Your internal order ID
    amount: 999.99,                  // Amount in INR
    currency: 'INR',
    notes: {
      customerName: 'John Doe',
      customerPhone: '9876543210'
    }
  })
});

const { data } = await orderResponse.json();
const { razorpayOrderId, keyId, amount } = data;

// Step 2: Open Razorpay payment modal
const options = {
  key: keyId,                        // Use keyId from response
  amount: amount,                    // Amount already in paise
  currency: 'INR',
  name: 'Your Store Name',
  order_id: razorpayOrderId,
  handler: async function(response) {
    // Step 3: Verify payment
    const verifyResponse = await fetch('https://sarastores.com/api/v1/partner/orders/razorpay/verify', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature
      })
    });
    
    const result = await verifyResponse.json();
    if (result.success && result.data.verified) {
      // Payment successful!
      window.location.href = '/order-success';
    }
  },
  prefill: {
    name: 'John Doe',
    email: 'john@example.com',
    contact: '+919876543210'
  },
  theme: { color: '#3B82F6' }
};

const rzp = new Razorpay(options);
rzp.open();`}
                        title="Razorpay Integration - Client-side Payment Flow"
                      />
                    </div>
                  </div>

                  {/* Setup Instructions */}
                  <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Getting Started
                    </h3>
                    <p className="text-yellow-800 mb-4">
                      Contact our partner support team to configure your integration mode. We'll help you set up:
                    </p>
                    <ul className="text-yellow-800 space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>Partner account with appropriate tier</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>API keys for test and production environments</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>Wallet balance (for wallet mode)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>Domain whitelisting (for Razorpay integration)</span>
                      </li>
                    </ul>
                    <div className="mt-4">
                      <a href="mailto:support@sarastores.com" className="inline-flex items-center gap-2 text-yellow-900 font-medium hover:underline">
                        <ExternalLink className="h-4 w-4" />
                        Contact Partner Support
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Authentication Tab */}
              {activeTab === 'authentication' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
                  <p className="text-gray-600 mb-6">
                    All API requests must include your API key in the Authorization header.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3">API Key Format</h3>
                  <p className="text-gray-600 mb-4">
                    API keys follow this format:
                  </p>
                  <CodeBlock
                    code={`# Test Environment
sk_test_ptnr_{partner_id}_{random_string}

# Production Environment
sk_live_ptnr_{partner_id}_{random_string}`}
                    title="API Key Format"
                  />

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Making Authenticated Requests</h3>
                  <p className="text-gray-600 mb-4">
                    Include your API key in the Authorization header as a Bearer token:
                  </p>

                  <CodeBlock
                    code={`curl -X GET "https://sarastores.com/api/v1/partner/products" \\
  -H "Authorization: Bearer sk_live_ptnr_abc123_..." \\
  -H "Content-Type: application/json"`}
                    title="cURL Example"
                  />

                  <CodeBlock
                    code={`// JavaScript / Node.js
const response = await fetch('https://sarastores.com/api/v1/partner/products', {
  headers: {
    'Authorization': 'Bearer sk_live_ptnr_abc123_...',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);`}
                    title="JavaScript Example"
                  />

                  <CodeBlock
                    code={`# Python
import requests

headers = {
    'Authorization': 'Bearer sk_live_ptnr_abc123_...',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://sarastores.com/api/v1/partner/products',
    headers=headers
)

data = response.json()
print(data)`}
                    title="Python Example"
                  />

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Security Best Practices</h4>
                        <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                          <li>• Never expose your API key in client-side code</li>
                          <li>• Use environment variables to store keys</li>
                          <li>• Rotate keys periodically</li>
                          <li>• Use test keys for development</li>
                          <li>• Whitelist your domains for additional security</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Domain Whitelisting Section */}
                  <div className="mt-8 pt-8 border-t">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-600" />
                      Domain Whitelisting
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Restrict your API key to only work from specific domains. This adds an extra layer of security
                      by preventing unauthorized use of your API key from other websites.
                    </p>

                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Shield className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">How Domain Whitelisting Works</h4>
                          <ul className="text-gray-600 text-sm mt-2 space-y-1">
                            <li>• When enabled, API requests are only accepted from whitelisted origins</li>
                            <li>• Server-to-server requests (no origin header) are always allowed</li>
                            <li>• Use wildcards like <code className="bg-white px-1 rounded">*.example.com</code> to allow all subdomains</li>
                            <li>• Add localhost for development: <code className="bg-white px-1 rounded">localhost:3000</code></li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold text-gray-900 mb-3">Get Current Configuration</h4>
                    <CodeBlock
                      code={`GET /api/v1/partner/api-keys/domains
Authorization: Bearer YOUR_API_KEY`}
                      title="Request"
                    />
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "apiKeyId": "key_abc123",
    "apiKeyName": "Production Key",
    "allowedDomains": [
      "https://mystore.com",
      "*.mystore.com",
      "localhost:3000"
    ],
    "allowedMethods": ["GET", "POST", "OPTIONS"],
    "domainRestrictionEnabled": true
  }
}`}
                      title="Response"
                    />

                    <h4 className="font-semibold text-gray-900 mb-3 mt-6">Update Configuration</h4>
                    <CodeBlock
                      code={`PUT /api/v1/partner/api-keys/domains
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "domains": [
    "https://mystore.com",
    "https://shop.mystore.com",
    "*.mystore.com",
    "localhost:3000"
  ],
  "methods": ["GET", "POST", "PUT", "OPTIONS"]
}`}
                      title="Request"
                    />
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "apiKeyId": "key_abc123",
    "allowedDomains": [
      "https://mystore.com",
      "https://shop.mystore.com",
      "*.mystore.com",
      "localhost:3000"
    ],
    "allowedMethods": ["GET", "POST", "PUT", "OPTIONS"],
    "domainRestrictionEnabled": true,
    "message": "API key restricted to 4 domain(s)"
  }
}`}
                      title="Response"
                    />

                    <h4 className="font-semibold text-gray-900 mb-3 mt-6">Supported Domain Formats</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left font-medium">Format</th>
                            <th className="px-4 py-2 text-left font-medium">Example</th>
                            <th className="px-4 py-2 text-left font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-4 py-2 font-mono text-xs">Full URL</td><td className="px-4 py-2 font-mono text-xs">https://example.com</td><td className="px-4 py-2">Exact domain match</td></tr>
                          <tr><td className="px-4 py-2 font-mono text-xs">Domain only</td><td className="px-4 py-2 font-mono text-xs">example.com</td><td className="px-4 py-2">Matches both http and https</td></tr>
                          <tr><td className="px-4 py-2 font-mono text-xs">Wildcard</td><td className="px-4 py-2 font-mono text-xs">*.example.com</td><td className="px-4 py-2">All subdomains</td></tr>
                          <tr><td className="px-4 py-2 font-mono text-xs">Localhost</td><td className="px-4 py-2 font-mono text-xs">localhost:3000</td><td className="px-4 py-2">Development server</td></tr>
                          <tr><td className="px-4 py-2 font-mono text-xs">Any origin</td><td className="px-4 py-2 font-mono text-xs">*</td><td className="px-4 py-2">Allow all (not recommended)</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                      <div className="flex gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-green-800">Remove Domain Restrictions</h4>
                          <p className="text-sm text-green-700 mt-1">
                            To remove all domain restrictions and allow your API key from any origin,
                            send an empty domains array:
                          </p>
                          <code className="block mt-2 bg-green-100 p-2 rounded text-xs">
                            {`{ "domains": [] }`}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Products API Tab */}
              {activeTab === 'products' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Products API</h2>
                  <p className="text-gray-600 mb-6">
                    Access our complete product catalog with real-time pricing and inventory.
                  </p>

                  <EndpointCard method="GET" path="/products" description="List all products">
                    <h4 className="font-medium text-gray-900 mb-2">Query Parameters</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Parameter</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">page</td><td className="px-3 py-2">number</td><td className="px-3 py-2">Page number (default: 1)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">limit</td><td className="px-3 py-2">number</td><td className="px-3 py-2">Items per page (max: 100)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">category</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Filter by category</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">search</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Search by name/itemno</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">inStock</td><td className="px-3 py-2">boolean</td><td className="px-3 py-2">Only in-stock items</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_abc123",
        "itemno": "BW-TV-55-4K",
        "name": "55 inch 4K Smart TV",
        "description": "Ultra HD Smart Television",
        "category": "televisions",
        "price": 45999,
        "mrp": 59999,
        "discount": 23,
        "stock": 150,
        "inStock": true,
        "images": ["https://cdn.sarastores.com/products/tv.jpg"],
        "brand": "Samsung"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "totalPages": 63
    }
  }
}`}
                      title="Response"
                    />
                  </EndpointCard>

                  <EndpointCard method="GET" path="/products/{productId}" description="Get product details">
                    <h4 className="font-medium text-gray-900 mb-2">Path Parameters</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Parameter</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td className="px-3 py-2 font-mono text-xs">productId</td><td className="px-3 py-2">Unique product identifier</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "id": "prod_abc123",
    "itemno": "BW-TV-55-4K",
    "name": "55 inch 4K Smart TV",
    "description": "Ultra HD Smart Television with HDR support...",
    "category": "televisions",
    "subCategory": "smart-tv",
    "price": 45999,
    "mrp": 59999,
    "discount": 23,
    "stock": 150,
    "inStock": true,
    "images": [
      {
        "url": "https://cdn.sarastores.com/products/tv-1.jpg",
        "alt": "Front view",
        "isPrimary": true
      }
    ],
    "specifications": {
      "screenSize": "55 inches",
      "resolution": "3840 x 2160",
      "refreshRate": "60Hz"
    },
    "brand": "Samsung",
    "warranty": "2 years",
    "deliveryInfo": {
      "estimatedDays": 3,
      "freeDelivery": true
    }
  }
}`}
                      title="Response"
                    />
                  </EndpointCard>

                  <EndpointCard
                    id="product-specs"
                    method="GET"
                    path="/products/{productId}/specifications"
                    description="Get rich product specifications"
                  >
                    <h4 className="font-medium text-gray-900 mb-2">Path Parameters</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Parameter</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td className="px-3 py-2 font-mono text-xs">productId</td><td className="px-3 py-2">Unique product identifier</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "productId": "prod_abc123",
    "itemno": "BW-TV-55-4K",
    "name": "55 inch 4K Smart TV",
    "mrp": 59999,
    "technical_details": {
      "Display Type": "LED",
      "Resolution": "3840 x 2160",
      "HDMI Ports": "3"
    },
    "from_manufacturer": [
      {
        "title": "Crystal Processor 4K",
        "description": "Powerful 4K upscaling ensures you get up to 4K resolution...",
        "image": "https://cdn.sarastores.com/manufacturer/proc.jpg"
      }
    ],
    "specification_images": ["https://cdn.sarastores.com/specs/spec-1.jpg"],
    "overview": "Experience ultra-sharp images with this 4K Smart TV...",
    "features": [
      {
        "title": "Smart Connectivity",
        "description": "Voice control with Alexa and Google Assistant"
      }
    ],
    "included_components": ["TV Unit", "Remote Control", "Power Cable", "User Manual"],
    "updatedAt": "2026-02-01T12:00:00.000Z"
  }
}`}
                      title="Response"
                    />
                  </EndpointCard>

                  <EndpointCard method="POST" path="/products/stock-check" description="Bulk stock check">
                    <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "productIds": ["prod_abc123", "prod_def456", "prod_ghi789"]
}`}
                      title="Request"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Response</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_abc123",
        "itemno": "BW-TV-55-4K",
        "price": 45999,
        "mrp": 59999,
        "stock": 150,
        "inStock": true
      },
      {
        "id": "prod_def456",
        "itemno": "BW-WM-7KG",
        "price": 32999,
        "mrp": 39999,
        "stock": 0,
        "inStock": false
      }
    ]
  }
}`}
                      title="Response"
                    />
                  </EndpointCard>
                </div>
              )}

              {/* Orders API Tab */}
              {activeTab === 'orders' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Orders API</h2>
                  <p className="text-gray-600 mb-6">
                    Create and manage orders. We handle fulfillment, shipping, and delivery tracking.
                  </p>

                  <EndpointCard method="POST" path="/orders" description="Create a new order">
                    <p className="text-gray-600 mb-4">
                      Creates a new order. Supports both <strong>prepaid</strong> (online payment via Razorpay) and <strong>COD</strong> (Cash on Delivery) payment methods.
                    </p>

                    <h4 className="font-medium text-gray-900 mb-2">Payment Methods</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Method</th>
                            <th className="px-3 py-2 text-left">Aliases</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">prepaid</td><td className="px-3 py-2">razorpay, stripe</td><td className="px-3 py-2">Online payment — requires <code className="bg-gray-100 px-1 rounded">paymentDetails</code></td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">cod</td><td className="px-3 py-2">cash</td><td className="px-3 py-2">Cash on Delivery — no payment details required</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h4 className="font-medium text-gray-900 mb-2">Request Body (Prepaid / Razorpay)</h4>
                    <CodeBlock
                      code={`{
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "address": {
      "line1": "123 Main Street",
      "line2": "Apartment 4B",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    }
  },
  "items": [
    {
      "productId": "prod_abc123",
      "quantity": 1
    },
    {
      "productId": "prod_def456",
      "quantity": 2
    }
  ],
  "paymentMethod": "prepaid",
  "paymentDetails": {
    "razorpayOrderId": "order_N4VuN4QFjWIBNS",
    "transactionId": "pay_N4Vu123456789",
    "method": "razorpay"
  },
  "partnerOrderId": "PO-12345",
  "notes": "Gift wrapping requested"
}`}
                      title="Prepaid Order Request"
                    />

                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Request Body (Cash on Delivery)</h4>
                    <CodeBlock
                      code={`{
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "address": {
      "line1": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    }
  },
  "items": [
    { "productId": "prod_abc123", "quantity": 1 }
  ],
  "paymentMethod": "cod",
  "partnerOrderId": "PO-12346"
}`}
                      title="COD Order Request"
                    />

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                      <p className="text-sm text-red-800">
                        <strong>Important:</strong> For <code className="bg-red-100 px-1 rounded">prepaid</code> orders, you must first create a Razorpay order using <code className="bg-red-100 px-1 rounded">POST /orders/razorpay/create</code>, complete the payment on your frontend, verify it via <code className="bg-red-100 px-1 rounded">POST /orders/razorpay/verify</code>, and then pass the <code className="bg-red-100 px-1 rounded">paymentDetails</code> when creating the order.
                      </p>
                    </div>

                    <h4 className="font-medium text-gray-900 mb-2 mt-4">paymentDetails Object (Prepaid Only)</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Field</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Required</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">razorpayOrderId</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">The Razorpay order ID from create endpoint</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">transactionId</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Yes</td><td className="px-3 py-2">The Razorpay payment ID (pay_xxx)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">method</td><td className="px-3 py-2">string</td><td className="px-3 py-2">No</td><td className="px-3 py-2">Payment gateway used (default: "razorpay")</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Response</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "orderId": "BW-ORD-2026020112345",
    "partnerOrderId": "PO-12345",
    "status": "pending",
    "paymentMethod": "prepaid",
    "paymentStatus": "verified",
    "items": [
      {
        "productId": "prod_abc123",
        "name": "55 inch 4K Smart TV",
        "price": 45999,
        "quantity": 1,
        "subtotal": 45999
      }
    ],
    "summary": {
      "subtotal": 111997,
      "tax": 20159,
      "shipping": 0,
      "total": 132156
    },
    "partnerEarnings": {
      "orderValue": 132156,
      "commissionRate": 12,
      "commissionAmount": 15859,
      "status": "pending"
    },
    "estimatedDelivery": "2026-02-04"
  }
}`}
                      title="Response"
                    />

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-amber-800">
                        <strong>Test Mode:</strong> If your API key is a test key (<code className="bg-amber-100 px-1 rounded">sk_test_ptnr_...</code>), order creation will return a simulated response without persisting the order. Use this for integration testing.
                      </p>
                    </div>
                  </EndpointCard>

                  <EndpointCard method="GET" path="/orders" description="List all orders">
                    <h4 className="font-medium text-gray-900 mb-2">Query Parameters</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Parameter</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">page</td><td className="px-3 py-2">number</td><td className="px-3 py-2">Page number</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">limit</td><td className="px-3 py-2">number</td><td className="px-3 py-2">Items per page (max: 50)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">status</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Filter by status</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">fromDate</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Start date (ISO 8601)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">toDate</td><td className="px-3 py-2">string</td><td className="px-3 py-2">End date (ISO 8601)</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">Order Statuses</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'].map(status => (
                        <span key={status} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{status}</span>
                      ))}
                    </div>
                  </EndpointCard>

                  <EndpointCard method="GET" path="/orders/{orderId}" description="Get order details">
                    <h4 className="font-medium text-gray-900 mb-2">Response includes</h4>
                    <ul className="text-sm text-gray-600 space-y-1 mb-4">
                      <li>• Order status and history</li>
                      <li>• Item details</li>
                      <li>• Tracking information</li>
                      <li>• Partner earnings breakdown</li>
                    </ul>
                  </EndpointCard>

                  <EndpointCard method="GET" path="/orders/status/{id}" description="Get streamlined order status">
                    <p className="text-gray-600 mb-4">
                      Retrieve real-time status and tracking updates for an order. You can use either our internal <code className="bg-gray-100 px-1 rounded text-blue-600 font-mono">orderId</code> or your own <code className="bg-gray-100 px-1 rounded text-purple-600 font-mono">partnerOrderId</code>.
                    </p>
                    <h4 className="font-medium text-gray-900 mb-2">Path Parameters</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Parameter</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr>
                            <td className="px-3 py-2 font-mono text-xs">id</td>
                            <td className="px-3 py-2">Internal Order ID (e.g., PO-...) OR Partner External ID</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">Response Fields</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Field</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">status</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Current order status</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">shipmentNumber</td><td className="px-3 py-2">string | null</td><td className="px-3 py-2">Tracking ID (present only if order is shipped)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">tracking</td><td className="px-3 py-2">object | null</td><td className="px-3 py-2">Full tracking details (carrier, URL, etc.)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">paymentStatus</td><td className="px-3 py-2">string</td><td className="px-3 py-2">verified or pending</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">Response Sample</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "orderId": "PO-TEST12345",
    "partnerOrderId": "EXT-98765",
    "status": "shipped",
    "statusHistory": [
      {
        "status": "pending",
        "timestamp": "2026-02-26T10:00:00Z"
      },
      {
        "status": "shipped",
        "timestamp": "2026-02-26T14:30:00Z",
        "details": { "carrier": "Delhivery" }
      }
    ],
    "tracking": {
      "carrier": "Delhivery",
      "trackingNumber": "DEL123456789",
      "trackingUrl": "https://delhivery.com/track/...",
      "estimatedDelivery": "2026-02-28T18:00:00Z"
    },
    "shipmentNumber": "DEL123456789",
    "paymentStatus": "verified",
    "summary": {
      "total": 1499,
      "itemCount": 1
    },
    "updatedAt": "2026-02-26T14:35:00Z"
  }
}`}
                      title="Success Response"
                    />
                  </EndpointCard>

                  <EndpointCard method="POST" path="/orders/{orderId}/cancel" description="Cancel an order">
                    <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "reason": "customer_request",
  "notes": "Customer changed their mind"
}`}
                      title="Request"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Cancellation Reasons</h4>
                    <div className="flex flex-wrap gap-2">
                      {['customer_request', 'out_of_stock', 'pricing_error', 'duplicate_order', 'other'].map(reason => (
                        <span key={reason} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{reason}</span>
                      ))}
                    </div>
                  </EndpointCard>
                </div>
              )}

              {/* Wallet API Tab */}
              {activeTab === 'wallet' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Wallet API</h2>
                  <p className="text-gray-600 mb-6">
                    Track your earnings and request payouts to your registered bank account.
                  </p>

                  <EndpointCard method="GET" path="/wallet/balance" description="Get wallet balance">
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "walletId": "wallet_abc123",
    "balance": {
      "available": 125000,
      "pending": 45000,
      "held": 5000,
      "total": 175000
    },
    "currency": "INR",
    "minimumPayout": 1000,
    "autoPayout": false,
    "updatedAt": "2026-03-06T12:00:00Z"
  }
}`}
                      title="Response"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Balance Types</h4>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li><strong>Available:</strong> Ready for withdrawal</li>
                      <li><strong>Pending:</strong> Earnings from orders not yet delivered</li>
                      <li><strong>Held:</strong> Under review due to disputes/refunds</li>
                    </ul>
                  </EndpointCard>

                  <EndpointCard method="GET" path="/wallet/transactions" description="Get transaction history">
                    <h4 className="font-medium text-gray-900 mb-2">Query Parameters</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Parameter</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">page</td><td className="px-3 py-2">number</td><td className="px-3 py-2">Page number (default: 1)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">limit</td><td className="px-3 py-2">number</td><td className="px-3 py-2">Items per page (max: 100)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">type</td><td className="px-3 py-2">string</td><td className="px-3 py-2">credit, debit, hold, release</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">category</td><td className="px-3 py-2">string</td><td className="px-3 py-2">order_commission, payout, refund_adjustment, bonus, penalty, refund_hold, dispute_hold, hold_release</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">fromDate</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Start date (ISO 8601)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">toDate</td><td className="px-3 py-2">string</td><td className="px-3 py-2">End date (ISO 8601)</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </EndpointCard>

                  <EndpointCard method="POST" path="/wallet/payout" description="Request a payout">
                    <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "amount": 100000,
  "bankAccountId": "bank_acc_123",
  "notes": "Monthly payout - January 2026"
}`}
                      title="Request"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Response</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "payoutId": "payout_abc123",
    "amount": 100000,
    "status": "pending_approval",
    "bankAccount": {
      "accountNumber": "****1234",
      "bankName": "HDFC Bank",
      "ifsc": "HDFC0001234"
    },
    "estimatedArrival": "2026-03-09T00:00:00Z",
    "requestedAt": "2026-03-06T12:00:00Z",
    "message": "Payout request submitted successfully"
  }
}`}
                      title="Response"
                    />
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Minimum payout amount is ₹1,000. Payouts require admin approval and are processed within 2-3 business days. The amount must not exceed your available balance.
                      </p>
                    </div>
                  </EndpointCard>

                  <EndpointCard method="GET" path="/wallet/payouts" description="Get payout history">
                    <p className="text-gray-600 mb-4">
                      Returns a list of all payout requests with their status and transaction details.
                    </p>
                    <h4 className="font-medium text-gray-900 mb-2">Payout Statuses</h4>
                    <div className="flex flex-wrap gap-2">
                      {['pending_approval', 'approved', 'processing', 'completed', 'rejected', 'failed'].map(status => (
                        <span key={status} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{status}</span>
                      ))}
                    </div>
                  </EndpointCard>

                  <EndpointCard method="GET" path="/wallet/bank-accounts" description="List linked bank accounts">
                    <p className="text-gray-600 mb-4">
                      Returns all bank accounts linked to your partner wallet. Account numbers are masked for security.
                    </p>
                    <h4 className="font-medium text-gray-900 mb-2">Required Permission</h4>
                    <div className="flex gap-2 mb-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">wallet:read</span>
                    </div>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "bankAccounts": [
      {
        "id": "bank_acc_123",
        "accountHolderName": "John Doe",
        "accountNumber": "****1234",
        "ifsc": "HDFC0001234",
        "bankName": "HDFC Bank",
        "isDefault": true,
        "addedAt": "2026-01-15T10:00:00Z"
      }
    ]
  }
}`}
                      title="Response"
                    />
                  </EndpointCard>

                  <EndpointCard method="POST" path="/wallet/bank-accounts" description="Add a bank account">
                    <p className="text-gray-600 mb-4">
                      Link a new bank account for receiving payouts.
                    </p>
                    <h4 className="font-medium text-gray-900 mb-2">Required Permission</h4>
                    <div className="flex gap-2 mb-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">wallet:write</span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "accountNumber": "1234567890123",
  "accountHolderName": "John Doe",
  "ifsc": "HDFC0001234",
  "bankName": "HDFC Bank",
  "isDefault": true
}`}
                      title="Request"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Validation Rules</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Field</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Validation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="px-3 py-2 font-mono text-xs">accountNumber</td><td className="px-3 py-2">string</td><td className="px-3 py-2">9-18 digits</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">accountHolderName</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Required</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">ifsc</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Format: XXXX0XXXXXX (11 chars)</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">bankName</td><td className="px-3 py-2">string</td><td className="px-3 py-2">Required</td></tr>
                          <tr><td className="px-3 py-2 font-mono text-xs">isDefault</td><td className="px-3 py-2">boolean</td><td className="px-3 py-2">Optional, defaults to false</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "id": "bank_acc_456",
    "accountHolderName": "John Doe",
    "accountNumber": "****0123",
    "ifsc": "HDFC0001234",
    "bankName": "HDFC Bank",
    "isDefault": true,
    "addedAt": "2026-03-06T10:00:00Z"
  },
  "message": "Bank account added successfully"
}`}
                      title="Response"
                    />
                  </EndpointCard>
                </div>
              )}
              {activeTab === 'razorpay' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Razorpay Payment API</h2>
                      <p className="text-gray-600 mt-1">
                        Accept payments directly on your website using Razorpay integration.
                      </p>
                    </div>
                    <Link
                      href="/partner-api-test"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      Test Razorpay API
                    </Link>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-green-100 p-3 rounded-lg">
                        <CreditCard className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Payment Integration Made Easy</h3>
                        <p className="text-gray-600 text-sm mt-1">
                          Create Razorpay orders, process payments, and verify transactions securely through our API.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Secure</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Real-time</span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Auto-capture</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Flow Diagram */}
                  <div className="bg-white border rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Flow Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
                        <h4 className="font-medium text-gray-900 text-sm">Create Razorpay Order</h4>
                        <p className="text-xs text-gray-500 mt-1">POST /orders/razorpay/create</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
                        <h4 className="font-medium text-gray-900 text-sm">Customer Pays</h4>
                        <p className="text-xs text-gray-500 mt-1">Razorpay Checkout on your site</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
                        <h4 className="font-medium text-gray-900 text-sm">Verify Payment</h4>
                        <p className="text-xs text-gray-500 mt-1">POST /orders/razorpay/verify</p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-bold">4</div>
                        <h4 className="font-medium text-gray-900 text-sm">Create Order</h4>
                        <p className="text-xs text-gray-500 mt-1">POST /orders with paymentDetails</p>
                      </div>
                    </div>
                  </div>

                  {/* Supported Payment Methods */}
                  <div className="bg-white border rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Payment Methods</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Razorpay supports the following payment methods. Your customers can choose any of these at checkout:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Credit / Debit Card</p>
                          <p className="text-xs text-gray-500">Visa, Mastercard, RuPay</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Zap className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">UPI</p>
                          <p className="text-xs text-gray-500">GPay, PhonePe, Paytm</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Globe className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Net Banking</p>
                          <p className="text-xs text-gray-500">All major banks</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Wallet className="h-4 w-4 text-amber-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Wallets</p>
                          <p className="text-xs text-gray-500">Paytm, Amazon Pay</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Partner Razorpay Credentials */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Key className="h-5 w-5 text-indigo-600" />
                      Partner-Specific Razorpay Credentials
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      You can configure your own Razorpay credentials so payments go directly to your Razorpay account. If not configured, payments are processed through our shared Razorpay account and settled via wallet payouts.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700"><strong>Test Mode:</strong> Use your Razorpay test key ID and secret for sandbox testing. No real charges are made.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700"><strong>Live Mode:</strong> Use your Razorpay live key ID and secret for production payments. Funds go directly to your account.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700"><strong>Security:</strong> Your Razorpay key secret is encrypted (AES-256) and never exposed via API responses.</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Contact API support to configure your Razorpay credentials for your partner account.
                    </p>
                  </div>

                  <EndpointCard method="POST" path="/orders/razorpay/create" description="Create Razorpay order for payment">
                    <p className="text-gray-600 mb-4">
                      Creates a Razorpay order and returns the order ID needed to initiate payment on your frontend.
                    </p>
                    <h4 className="font-medium text-gray-900 mb-2">Required Permissions</h4>
                    <div className="flex gap-2 mb-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">razorpay:create</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">orders:create</span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "orderId": "YOUR_ORDER_ID_123",    // Your internal order ID (required)
  "amount": 999.99,                   // Amount in INR (required)
  "currency": "INR",                  // Currency code (optional, default: INR)
  "receipt": "receipt_123",           // Receipt reference (optional)
  "notes": {                          // Additional metadata (optional)
    "customerName": "John Doe",
    "customerPhone": "9876543210"
  }
}`}
                      title="Request Body"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Response</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "razorpayOrderId": "order_N4VuN4QFjWIBNS",
    "amount": 99999,                  // Amount in paise
    "amountInRupees": 999.99,         // Amount in rupees
    "currency": "INR",
    "receipt": "receipt_123",
    "status": "created",
    "keyId": "rzp_live_xxxxxxxxx",    // Use this in frontend
    "notes": {
      "partnerId": "partner_abc",
      "orderId": "YOUR_ORDER_ID_123",
      "customerName": "John Doe"
    }
  },
  "requestId": "req_abc123"
}`}
                      title="Response"
                    />
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Use the returned <code className="bg-blue-100 px-1 rounded">razorpayOrderId</code> and <code className="bg-blue-100 px-1 rounded">keyId</code> to initialize the Razorpay checkout on your frontend.
                      </p>
                    </div>
                  </EndpointCard>

                  <EndpointCard method="POST" path="/orders/razorpay/verify" description="Verify Razorpay payment signature">
                    <p className="text-gray-600 mb-4">
                      Verifies the payment signature after successful payment. This confirms the payment is authentic and not tampered with.
                    </p>
                    <h4 className="font-medium text-gray-900 mb-2">Required Permissions</h4>
                    <div className="flex gap-2 mb-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">razorpay:write</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">orders:write</span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "razorpay_payment_id": "pay_N4Vu123456789",   // From Razorpay callback
  "razorpay_order_id": "order_N4VuN4QFjWIBNS",  // From create order response
  "razorpay_signature": "9ef4dffbfd84f1318668b..."  // From Razorpay callback
}`}
                      title="Request Body"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Success Response</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "data": {
    "verified": true,
    "razorpayPaymentId": "pay_N4Vu123456789",
    "razorpayOrderId": "order_N4VuN4QFjWIBNS",
    "amount": 999.99,
    "currency": "INR",
    "status": "captured",
    "method": "upi",              // upi, card, netbanking, wallet
    "orderId": "YOUR_ORDER_ID_123",
    "paidAt": "2026-02-03T10:30:00.000Z"
  },
  "requestId": "req_def456"
}`}
                      title="Success Response"
                    />
                    <h4 className="font-medium text-gray-900 mb-2 mt-4">Verification Failed Response</h4>
                    <CodeBlock
                      code={`{
  "success": false,
  "error": {
    "code": "SIGNATURE_VERIFICATION_FAILED",
    "message": "Payment signature verification failed"
  }
}`}
                      title="Verification Failed Response"
                    />
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                      <p className="text-sm text-red-800">
                        <strong>Important:</strong> Never fulfill an order until you receive a successful verification response. A failed signature indicates potential tampering.
                      </p>
                    </div>
                  </EndpointCard>

                  {/* Complete Integration Example */}
                  <div className="mt-8 bg-gray-900 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-green-400" />
                      Complete Frontend Integration Example
                    </h3>
                    <CodeBlock
                      code={`// Step 1: Create Razorpay order via your backend
async function initiatePayment(orderData) {
  const response = await fetch('/api/v1/partner/orders/razorpay/create', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: orderData.id,
      amount: orderData.total,
      notes: { customerName: orderData.customerName }
    })
  });
  
  const { data } = await response.json();
  return data;
}

// Step 2: Open Razorpay checkout
async function openCheckout(orderData) {
  const razorpayData = await initiatePayment(orderData);
  
  const options = {
    key: razorpayData.keyId,
    amount: razorpayData.amount,
    currency: razorpayData.currency,
    name: 'Your Store Name',
    order_id: razorpayData.razorpayOrderId,
    handler: async function(response) {
      // Step 3: Verify payment
      await verifyPayment(response);
    },
    prefill: {
      name: orderData.customerName,
      email: orderData.email,
      contact: orderData.phone
    },
    theme: { color: '#3B82F6' }
  };
  
  const rzp = new Razorpay(options);
  rzp.open();
}

// Step 4: Verify payment on success
async function verifyPayment(razorpayResponse) {
  const response = await fetch('/api/v1/partner/orders/razorpay/verify', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_signature: razorpayResponse.razorpay_signature
    })
  });
  
  const result = await response.json();
  
  if (result.success && result.data.verified) {
    // Payment successful - show success page
    window.location.href = '/order-success';
  } else {
    // Payment verification failed
    alert('Payment verification failed. Please contact support.');
  }
}`}
                      title="Complete Integration Flow"
                    />
                  </div>

                  {/* Razorpay Script Notice */}
                  <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Don't Forget the Razorpay Script
                    </h4>
                    <p className="text-sm text-yellow-800 mb-2">
                      Add the Razorpay checkout script to your HTML head:
                    </p>
                    <code className="block bg-yellow-100 p-2 rounded text-xs">
                      {'<script src="https://checkout.razorpay.com/v1/checkout.js"></script>'}
                    </code>
                  </div>
                </div>
              )}

              {/* Error Handling Tab */}
              {activeTab === 'errors' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
                  <p className="text-gray-600 mb-6">
                    All errors follow a consistent format to help you handle them gracefully.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Error Response Format</h3>
                  <CodeBlock
                    code={`{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-02-01T12:00:00Z"
  }
}`}
                    title="Error Response"
                  />

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">HTTP Status Codes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium">Code</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr><td className="px-4 py-2 font-mono">200</td><td className="px-4 py-2">OK</td><td className="px-4 py-2">Request successful</td></tr>
                        <tr><td className="px-4 py-2 font-mono">201</td><td className="px-4 py-2">Created</td><td className="px-4 py-2">Resource created successfully</td></tr>
                        <tr><td className="px-4 py-2 font-mono">400</td><td className="px-4 py-2">Bad Request</td><td className="px-4 py-2">Invalid request parameters</td></tr>
                        <tr><td className="px-4 py-2 font-mono">401</td><td className="px-4 py-2">Unauthorized</td><td className="px-4 py-2">Missing or invalid API key</td></tr>
                        <tr><td className="px-4 py-2 font-mono">403</td><td className="px-4 py-2">Forbidden</td><td className="px-4 py-2">Insufficient permissions</td></tr>
                        <tr><td className="px-4 py-2 font-mono">404</td><td className="px-4 py-2">Not Found</td><td className="px-4 py-2">Resource not found</td></tr>
                        <tr><td className="px-4 py-2 font-mono">429</td><td className="px-4 py-2">Too Many Requests</td><td className="px-4 py-2">Rate limit exceeded</td></tr>
                        <tr><td className="px-4 py-2 font-mono">500</td><td className="px-4 py-2">Server Error</td><td className="px-4 py-2">Internal server error</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Error Codes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium">Code</th>
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                          <th className="px-4 py-2 text-left font-medium">Resolution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr><td className="px-4 py-2 font-mono text-xs">INVALID_API_KEY</td><td className="px-4 py-2">API key is invalid or revoked</td><td className="px-4 py-2">Check your API key</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-xs">RATE_LIMITED</td><td className="px-4 py-2">Too many requests</td><td className="px-4 py-2">Wait and retry</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-xs">PRODUCT_NOT_FOUND</td><td className="px-4 py-2">Product doesn't exist</td><td className="px-4 py-2">Verify product ID</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-xs">INSUFFICIENT_STOCK</td><td className="px-4 py-2">Not enough inventory</td><td className="px-4 py-2">Reduce quantity or try later</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-xs">INSUFFICIENT_BALANCE</td><td className="px-4 py-2">Wallet balance too low</td><td className="px-4 py-2">Wait for pending earnings</td></tr>
                        <tr><td className="px-4 py-2 font-mono text-xs">ORDER_NOT_CANCELLABLE</td><td className="px-4 py-2">Order already shipped</td><td className="px-4 py-2">Contact support</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Handling Rate Limits</h3>
                  <p className="text-gray-600 mb-4">
                    When you receive a 429 response, check the headers for retry information:
                  </p>
                  <CodeBlock
                    code={`HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706788845
Retry-After: 45`}
                    title="Rate Limit Headers"
                  />
                </div>
              )}

              {/* API Playground Tab */}
              {activeTab === 'playground' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">API Playground</h2>
                  <p className="text-gray-600 mb-6">
                    Test API endpoints directly from your browser. Enter your API key in the header above to get started.
                  </p>

                  {/* API Key Alert */}
                  {!apiKey && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <h4 className="font-medium text-yellow-800">API Key Required</h4>
                          <p className="text-sm text-yellow-700">
                            Enter your API key in the header above to start testing API endpoints.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {apiKey && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="font-medium text-green-800">API Key Set</h4>
                          <p className="text-sm text-green-700">
                            Your API key is configured. You can now test API endpoints.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile API Key Input */}
                  <div className="md:hidden mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key (sk_test_... or sk_live_...)"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 pr-12"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showApiKey ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <APIPlayground apiKey={apiKey} baseUrl={baseUrl} />

                  {/* Tips */}
                  <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Tips</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Use your <strong>test API key</strong> (sk_test_...) for testing</li>
                      <li>• Test orders created with test keys don't affect your wallet</li>
                      <li>• Check the Products API first to get valid product IDs</li>
                      <li>• All responses are shown in JSON format</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* SDKs Tab */}
              {activeTab === 'sdks' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">SDKs & Server-Side Integration</h2>
                  <p className="text-gray-600 mb-6">
                    Get started quickly with our code examples. <strong>All API calls must be made from your server</strong> (not browser).
                  </p>

                  {/* Server-Side Requirement Alert */}
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900">Why Server-Side Only?</h4>
                        <p className="text-sm text-amber-800 mt-1">
                          Browser-based API calls are blocked by security systems. Your website should:
                        </p>
                        <ol className="text-sm text-amber-800 mt-2 list-decimal list-inside space-y-1">
                          <li>Create API routes on your own server</li>
                          <li>Call SaraMobiles API from your server</li>
                          <li>Return the data to your frontend</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Next.js API Route Example */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Next.js API Route (Recommended)</h3>
                  <CodeBlock
                    code={`// pages/api/products.js (or app/api/products/route.js)
// This runs on YOUR server, not in browser

export default async function handler(req, res) {
  try {
    const response = await fetch('https://sarastores.com/api/v1/partner/products', {
      headers: {
        'Authorization': \`Bearer \${process.env.SARAMOBILES_API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// Your frontend calls YOUR API route:
// fetch('/api/products') ← This is fine, it's your own server`}
                    title="Next.js Server-Side API Route"
                  />

                  {/* Express.js Example */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Express.js / Node.js Backend</h3>
                  <CodeBlock
                    code={`// server.js - Your Express server
const express = require('express');
const app = express();

const SARA_API_KEY = process.env.SARAMOBILES_API_KEY;
const SARA_BASE_URL = 'https://sarastores.com/api/v1/partner';

// Proxy endpoint for products
app.get('/api/products', async (req, res) => {
  const response = await fetch(\`\${SARA_BASE_URL}/products\`, {
    headers: {
      'Authorization': \`Bearer \${SARA_API_KEY}\`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  res.json(data);
});

// Proxy endpoint for creating orders
app.post('/api/orders', async (req, res) => {
  const response = await fetch(\`\${SARA_BASE_URL}/orders\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${SARA_API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
});

app.listen(3000);`}
                    title="Express.js Server Example"
                  />

                  {/* PHP Example */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">PHP Backend</h3>
                  <CodeBlock
                    code={`<?php
// api/products.php - Your PHP server endpoint

$api_key = getenv('SARAMOBILES_API_KEY');
$base_url = 'https://sarastores.com/api/v1/partner';

// Get products from SaraMobiles
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $base_url . '/products');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $api_key,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

header('Content-Type: application/json');
echo $response;

// Your frontend calls: fetch('/api/products.php')`}
                    title="PHP Server Example"
                  />

                  {/* Architecture Diagram */}
                  <div className="bg-gray-100 rounded-lg p-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Correct Architecture</h3>
                    <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
                      <div className="bg-blue-100 border border-blue-300 rounded-lg px-4 py-3 text-center">
                        <div className="font-semibold text-blue-900">Your Website</div>
                        <div className="text-blue-700 text-xs">(Browser/Frontend)</div>
                      </div>
                      <div className="text-gray-500">→</div>
                      <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-3 text-center">
                        <div className="font-semibold text-green-900">Your Server</div>
                        <div className="text-green-700 text-xs">(Node/PHP/Python)</div>
                      </div>
                      <div className="text-gray-500">→</div>
                      <div className="bg-purple-100 border border-purple-300 rounded-lg px-4 py-3 text-center">
                        <div className="font-semibold text-purple-900">SaraMobiles API</div>
                        <div className="text-purple-700 text-xs">(sarastores.com)</div>
                      </div>
                    </div>
                    <p className="text-center text-gray-600 text-sm mt-4">
                      Browser → Your Server → SaraMobiles API → Your Server → Browser
                    </p>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-8">Full JavaScript SDK</h3>
                  <CodeBlock
                    code={`// bytewise-partner-sdk.js - Use this on YOUR SERVER only
class ByteWisePartnerAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://sarastores.com/api/v1/partner';
  }

  async request(endpoint, options = {}) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || 'API request failed');
    }
    
    return data;
  }

  // Products
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(\`/products?\${query}\`);
  }

  async getProduct(productId) {
    return this.request(\`/products/\${productId}\`);
  }

  // Orders
  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrder(orderId) {
    return this.request(\`/orders/\${orderId}\`);
  }

  async listOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(\`/orders?\${query}\`);
  }

  // Wallet
  async getWalletBalance() {
    return this.request('/wallet/balance');
  }

  async requestPayout(amount, bankAccountId) {
    return this.request('/wallet/payout', {
      method: 'POST',
      body: JSON.stringify({ amount, bankAccountId }),
    });
  }
}

// Usage on YOUR SERVER
const api = new ByteWisePartnerAPI(process.env.SARAMOBILES_API_KEY);

// Get products
const products = await api.getProducts({ category: 'televisions' });

// Create order
const order = await api.createOrder({
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+919876543210',
    address: { ... }
  },
  items: [
    { productId: 'prod_abc123', quantity: 1 }
  ],
  paymentMethod: 'prepaid'
});

console.log('Order created:', order.data.orderId);`}
                    title="JavaScript SDK Example (Server-Side Only)"
                  />

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-8">Python</h3>
                  <CodeBlock
                    code={`# bytewise_partner.py
import requests
from typing import Optional, Dict, Any

class ByteWisePartnerAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://sarastores.com/api/v1/partner'
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        response = self.session.request(
            method,
            f'{self.base_url}{endpoint}',
            **kwargs
        )
        data = response.json()
        
        if not data.get('success'):
            raise Exception(data.get('error', {}).get('message', 'API request failed'))
        
        return data

    # Products
    def get_products(self, **params) -> Dict:
        return self._request('GET', '/products', params=params)

    def get_product(self, product_id: str) -> Dict:
        return self._request('GET', f'/products/{product_id}')

    # Orders
    def create_order(self, order_data: Dict) -> Dict:
        return self._request('POST', '/orders', json=order_data)

    def get_order(self, order_id: str) -> Dict:
        return self._request('GET', f'/orders/{order_id}')

    def list_orders(self, **params) -> Dict:
        return self._request('GET', '/orders', params=params)

    # Wallet
    def get_wallet_balance(self) -> Dict:
        return self._request('GET', '/wallet/balance')

    def request_payout(self, amount: int, bank_account_id: str) -> Dict:
        return self._request('POST', '/wallet/payout', json={
            'amount': amount,
            'bankAccountId': bank_account_id
        })


# Usage
api = ByteWisePartnerAPI('sk_live_ptnr_...')

# Get products
products = api.get_products(category='televisions', limit=10)

# Create order
order = api.create_order({
    'customer': {
        'name': 'John Doe',
        'email': 'john@example.com',
        'phone': '+919876543210',
        'address': { ... }
    },
    'items': [
        {'productId': 'prod_abc123', 'quantity': 1}
    ],
    'paymentMethod': 'prepaid'
})

print(f"Order created: {order['data']['orderId']}")`}
                    title="Python SDK Example"
                  />

                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-8">PHP</h3>
                  <CodeBlock
                    code={`<?php
// ByteWisePartnerAPI.php

class ByteWisePartnerAPI {
    private $apiKey;
    private $baseUrl = 'https://sarastores.com/api/v1/partner';

    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }

    private function request($method, $endpoint, $data = null) {
        $ch = curl_init();
        
        $url = $this->baseUrl . $endpoint;
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json'
        ]);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }

    // Products
    public function getProducts($params = []) {
        $query = http_build_query($params);
        return $this->request('GET', '/products?' . $query);
    }

    public function getProduct($productId) {
        return $this->request('GET', '/products/' . $productId);
    }

    // Orders
    public function createOrder($orderData) {
        return $this->request('POST', '/orders', $orderData);
    }

    public function getOrder($orderId) {
        return $this->request('GET', '/orders/' . $orderId);
    }

    // Wallet
    public function getWalletBalance() {
        return $this->request('GET', '/wallet/balance');
    }
}

// Usage
$api = new ByteWisePartnerAPI('sk_live_ptnr_...');

$products = $api->getProducts(['category' => 'televisions']);

$order = $api->createOrder([
    'customer' => [
        'name' => 'John Doe',
        'email' => 'john@example.com',
        'phone' => '+919876543210',
        'address' => [ ... ]
    ],
    'items' => [
        ['productId' => 'prod_abc123', 'quantity' => 1]
    ],
    'paymentMethod' => 'prepaid'
]);

echo "Order created: " . $order['data']['orderId'];
?>`}
                    title="PHP Example"
                  />

                  <div id="sandbox" className="mt-8 pt-8 border-t">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Sandbox Testing</h3>
                    <p className="text-gray-600 mb-4">
                      Use your test API key (sk_test_...) to test integration without processing real orders.
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 mb-2">Test Environment Features</h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>✓ Full API access with sandbox data</li>
                        <li>✓ No real payments processed</li>
                        <li>✓ Test order lifecycle simulation</li>
                        <li>✓ Same rate limits as production</li>
                      </ul>
                    </div>
                  </div>

                  <div id="webhooks" className="mt-8 pt-8 border-t">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Webhooks (Coming Soon)</h3>
                    <p className="text-gray-600 mb-4">
                      Receive real-time notifications for order status changes, payout completions, and more.
                    </p>
                    <div className="bg-gray-50 border rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Webhook integration is coming soon. Contact us if you need real-time notifications for your integration.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div >

      {/* Footer */}
      < footer className="bg-white border-t mt-12" >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                © 2026 ByteWise. All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="mailto:support@sarastores.com" className="text-gray-600 hover:text-blue-600">
                API Support
              </a>
              <Link href="/terms-and-conditions" className="text-gray-600 hover:text-blue-600">
                Terms of Service
              </Link>
              <Link href="/privacy-policy" className="text-gray-600 hover:text-blue-600">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer >
    </div >
  )
}
