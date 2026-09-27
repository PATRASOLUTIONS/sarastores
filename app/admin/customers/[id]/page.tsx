"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, use } from "react"
import { ArrowLeft, Mail, Phone, MapPin, Calendar, ShoppingBag, DollarSign } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
}

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  createdAt: string
  orders?: Order[]
  totalSpent?: number
}

export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()

  useEffect(() => {
    const fetchCustomerData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch customer
        const customerResponse = await apiFetch(`/api/users/${id}`)
        if (!customerResponse.ok) {
          throw new Error("Failed to fetch customer")
        }
        const customerData = await customerResponse.json()

        // Fetch orders for this customer
        const ordersResponse = await apiFetch(`/api/orders?userId=${id}`)
        if (!ordersResponse.ok) {
          throw new Error("Failed to fetch customer orders")
        }
        const ordersData = await ordersResponse.json()

        // Calculate total spent
        const totalSpent = ordersData.reduce((total: number, order: any) => total + order.total, 0)

        setCustomer({
          ...customerData,
          orders: ordersData,
          totalSpent,
        })
      } catch (err) {
        console.error("Error fetching customer data:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        // A sample customer here would be indistinguishable from a real record.
        setCustomer(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomerData()
  }, [id])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "shipped":
        return "bg-purple-100 text-purple-800"
      case "delivered":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (authLoading) return null

  if (!user || !canAccessAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/admin/customers">
          <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </button>
        </Link>
        <h1 className="text-2xl font-semibold">Customer Details</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      ) : customer ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col items-center mb-6">
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-4xl mb-4">
                  {customer.name.charAt(0)}
                </div>
                <h2 className="text-xl font-semibold">{customer.name}</h2>
                <p className="text-gray-500">Customer ID: {customer.id.slice(0, 8)}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900">{customer.email}</p>
                  </div>
                </div>

                {customer.phone && (
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="text-gray-900">{customer.phone}</p>
                    </div>
                  </div>
                )}

                {customer.address && (
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="text-gray-900">
                        {typeof customer.address === "string"
                          ? customer.address
                          : customer.address && typeof customer.address === "object"
                          ? Object.values(customer.address).filter(Boolean).join(", ")
                          : "No address"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start">
                  <Calendar className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Joined</p>
                    <p className="text-gray-900">{formatDate(customer.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Customer Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <ShoppingBag className="h-5 w-5 text-blue-500 mr-2" />
                    <p className="text-sm text-blue-500">Total Orders</p>
                  </div>
                  <p className="text-2xl font-semibold">{customer.orders?.length || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <DollarSign className="h-5 w-5 text-green-500 mr-2" />
                    <p className="text-sm text-green-500">Total Spent</p>
                  </div>
                  <p className="text-2xl font-semibold">₹{(customer.totalSpent || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Order History</h3>

              {customer.orders && customer.orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Order ID
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Date
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Total
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customer.orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">#{order.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDate(order.createdAt)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                            >
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">₹{order.total.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/admin/orders/${order.id}`}>
                              <button className="text-indigo-600 hover:text-indigo-900">View</button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No orders found for this customer.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Customer not found.</p>
        </div>
      )}
    </div>
  )
}
