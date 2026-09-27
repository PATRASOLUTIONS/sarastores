"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { Search, ArrowUpDown, Eye, Mail, Phone } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"

interface Customer {
  id: string
  name: string
  email: string
  role?: string
  phone?: string
  address?: string
  orders?: number
  totalSpent?: number
  createdAt: string
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<keyof Customer>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch customers from API with pagination (include all roles)
        const usersUrl = `/api/users?limit=${pageSize}&offset=${page * pageSize}`
        const response = await apiFetch(usersUrl)
        if (!response.ok) {
          throw new Error("Failed to fetch customers")
        }
        const data = await response.json()
        // Try to read a total if API provides, else fallback to data.length
        const users = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
        const count = typeof data?.total === "number" ? data.total : users.length
        setTotalCount(count)

        // Fetch orders to get customer stats
        const ordersResponse = await apiFetch(`/api/orders`)
        if (!ordersResponse.ok) {
          throw new Error("Failed to fetch orders")
        }
        const ordersData = await ordersResponse.json()

        const customersWithStats = users.map((customer: Customer) => {
          const customerOrders = ordersData.filter((order: any) => order.userId === customer.id)
          const totalSpent = customerOrders.reduce((total: number, order: any) => total + (order.total || 0), 0)
          return { ...customer, orders: customerOrders.length, totalSpent }
        })

        setCustomers(customersWithStats)
      } catch (err) {
        console.error("Error fetching customers:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        // Showing sample rows here would be indistinguishable from real customers.
        setCustomers([])
        setTotalCount(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomers()
  }, [page, pageSize]) // refetch when page/pageSize changes

  const handleSort = (field: keyof Customer) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchTerm)),
  )

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const field = sortField
    if (field === "createdAt") {
      const dateA = new Date(a[sortField] as string).getTime()
      const dateB = new Date(b[sortField] as string).getTime()
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA
    }

    if (field === "orders" || field === "totalSpent") {
      const numA = (a[sortField] as number) || 0
      const numB = (b[sortField] as number) || 0
      return sortDirection === "asc" ? numA - numB : numB - numA
    }

    const valueA = a[sortField] ?? ""
    const valueB = b[sortField] ?? ""

    if (valueA < valueB) {
      return sortDirection === "asc" ? -1 : 1
    }
    if (valueA > valueB) {
      return sortDirection === "asc" ? 1 : -1
    }
    return 0
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Customers</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md pl-10"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
          <div>
            <span className="text-sm text-gray-500">
              {filteredCustomers.length} {filteredCustomers.length === 1 ? "customer" : "customers"} found
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Customer
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center">
                      Contact
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("orders")}
                  >
                    <div className="flex items-center">
                      Orders
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("totalSpent")}
                  >
                    <div className="flex items-center">
                      Total Spent
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Joined
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Role
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
                {sortedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  sortedCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg">
                              {(customer.name || customer.email || "U").charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.name || customer.email || "User"}
                            </div>
                              <div className="text-sm text-gray-500">
                                {typeof customer.address === "string"
                                  ? customer.address
                                  : customer.address && typeof customer.address === "object"
                                  ? Object.values(customer.address).filter(Boolean).join(", ")
                                  : "No address"}
                              </div>            
                              </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center text-sm text-gray-900">
                            <Mail className="h-4 w-4 mr-1 text-gray-500" />
                            {customer.email}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Phone className="h-4 w-4 mr-1 text-gray-500" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.orders || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">₹{(customer.totalSpent || 0).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(customer.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${customer.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          {customer.role ? (customer.role.charAt(0).toUpperCase() + customer.role.slice(1)) : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/customers/${customer.id}`}>
                          <button className="text-indigo-600 hover:text-indigo-900">
                            <Eye className="h-4 w-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  className="border rounded px-2 py-1"
                  value={pageSize}
                  onChange={(e) => {
                    setPage(0)
                    setPageSize(Number(e.target.value))
                  }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div>
                {totalCount > 0 ? (
                  <>
                    {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                  </>
                ) : (
                  "0 of 0"
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 border rounded disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Prev
                </button>
                <button
                  className="px-3 py-1 border rounded disabled:opacity-50"
                  onClick={() => setPage((p) => ((p + 1) * pageSize < totalCount ? p + 1 : p))}
                  disabled={(page + 1) * pageSize >= totalCount}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
