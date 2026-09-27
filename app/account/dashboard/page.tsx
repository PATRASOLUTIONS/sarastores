"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/hooks/useCart"
import { Package, ShoppingBag, User, MapPin, CreditCard, ChevronRight, Clock } from "lucide-react"

export default function UserDashboard() {
  const { user } = useAuth()
  const { getOrders } = useCart()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/login?redirect=/account/dashboard")
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const userOrders = await getOrders()
        if (!cancelled) setOrders(Array.isArray(userOrders) ? userOrders : [])
      } catch {
        if (!cancelled) setOrders([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, router, getOrders])

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded mb-4"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Please log in to view your dashboard</h2>
        <Link href="/login?redirect=/account/dashboard">
          <button className="bg-maroon-800 text-white px-6 py-3 rounded-lg hover:bg-maroon-900 transition-colors">
            Login
          </button>
        </Link>
      </div>
    )
  }

  return (
    <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Package className="h-6 w-6 text-brand-primary" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold">Orders</h3>
                  <p className="text-2xl font-bold">{orders.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold">Wishlist</h3>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-full">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold">Saved Cards</h3>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* Recent Orders */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Recent Orders</h2>
                  <Link href="/account/orders" className="text-brand-primary hover:text-brand-primary-hover text-sm">
                    View All
                  </Link>
                </div>

                <div className="p-6">
                  {orders.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                      <p className="text-gray-600 mb-4">
                        You haven't placed any orders yet. Start shopping to see your orders here.
                      </p>
                      <Link href="/products">
                        <button className="bg-maroon-800 text-white px-4 py-2 rounded-md hover:bg-maroon-900 transition-colors">
                          Browse Products
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {orders.slice(0, 3).map((order) => (
                        <div key={order.id} className="border rounded-lg p-4">
                          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
                            <div>
                              <h3 className="text-lg font-semibold">Order #{order.id}</h3>
                              <p className="text-gray-600">
                                Placed on {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="mt-2 md:mt-0">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                  order.status === "delivered"
                                    ? "bg-green-100 text-green-800"
                                    : order.status === "processing"
                                      ? "bg-blue-100 text-blue-800"
                                      : order.status === "cancelled"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            {order.items.slice(0, 3).map((item: any) => (
                              <div key={item.id} className="flex items-center space-x-4">
                                <img
                                  src={item.image || "/placeholder.svg"}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded"
                                />
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-gray-600">
                                    ₹{item.price.toLocaleString("en-IN")} × {item.quantity}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-between items-center">
                            <p className="font-semibold">Total: ₹{order.total.toLocaleString("en-IN")}</p>
                            <Link href={`/account/orders/${order.id}`}>
                              <button className="text-brand-primary hover:text-brand-primary-hover flex items-center">
                                View Details
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recently Viewed Products */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6 bg-gray-50 border-b">
                  <h2 className="text-xl font-semibold">Recently Viewed Products</h2>
                </div>

                <div className="p-6">
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                      <Clock className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No recently viewed products</h3>
                    <p className="text-gray-600 mb-4">Browse our products to see your history here.</p>
                    <Link href="/products">
                      <button className="bg-maroon-800 text-white px-4 py-2 rounded-md hover:bg-maroon-900 transition-colors">
                        Browse Products
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div>
              {/* Account Information */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Account Information</h2>
                  <Link href="/account/profile" className="text-brand-primary hover:text-brand-primary-hover text-sm">
                    Edit
                  </Link>
                </div>

                <div className="p-6">
                  <div className="flex items-start mb-4">
                    <User className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <h3 className="font-medium">Contact Information</h3>
                      <p className="text-gray-600">{user.name || "Not provided"}</p>
                      <p className="text-gray-600">{user.email || "Not provided"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Default Address */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Default Address</h2>
                  <Link href="/account/addresses" className="text-brand-primary hover:text-brand-primary-hover text-sm">
                    Manage
                  </Link>
                </div>

                <div className="p-6">
                  {localStorage.getItem(`address_${user.id}`) ? (
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <h3 className="font-medium">{user.name}</h3>
                        <p className="text-gray-600">
                          {JSON.parse(localStorage.getItem(`address_${user.id}`) || "{}").address || ""}
                        </p>
                        <p className="text-gray-600">
                          {JSON.parse(localStorage.getItem(`address_${user.id}`) || "{}").city || ""},{" "}
                          {JSON.parse(localStorage.getItem(`address_${user.id}`) || "{}").state || ""}{" "}
                          {JSON.parse(localStorage.getItem(`address_${user.id}`) || "{}").zipCode || ""}
                        </p>
                        <p className="text-gray-600">
                          {JSON.parse(localStorage.getItem(`address_${user.id}`) || "{}").country || ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
                        <MapPin className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No address saved</h3>
                      <p className="text-gray-600 mb-4">Add an address for faster checkout.</p>
                      <Link href="/account/addresses/new">
                        <button className="bg-maroon-800 text-white px-4 py-2 rounded-md hover:bg-maroon-900 transition-colors">
                          Add Address
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
    </>
  )
}
