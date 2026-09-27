import { redirect } from "next/navigation"

/**
 * The account-area order detail was retired in favour of /dashboard/orders/[id].
 * Without a default export this route returned HTTP 500, so it now redirects.
 * The previous implementation is preserved (commented) below.
 */
export default async function AccountOrderDetailPage(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  redirect(`/dashboard/orders/${id}`)
}

// "use client"

// import { useAuth } from "@/contexts/AuthContext"
// import { useRouter } from "next/navigation"
// import { useEffect, useState } from "react"
// import Header from "@/components/Header"
// import Footer from "@/components/Footer"
// import Link from "next/link"
// import {
//   ChevronRight,
//   Truck,
//   Calendar,
//   CreditCard,
//   MapPin,
//   ExternalLink,
//   MessageCircle,
//   Download,
//   Package,
// } from "lucide-react"

// interface Order {
//   id: string
//   date: string
//   status: string
//   total: number
//   shipping: number
//   paymentMethod: string
//   trackingNumber?: string
//   shippingAddress: {
//     name: string
//     street: string
//     city: string
//     state: string
//     zip: string
//     country: string
//   }
//   items: Array<{
//     id: string
//     name: string
//     price: number
//     quantity: number
//     image?: string
//   }>
//   timeline: Array<{
//     date: string
//     status: string
//     description: string
//   }>
// }

import { apiFetch } from "@/lib/api-client"
// export default function OrderDetailPage({ params }: { params: { id: string } }) {
//   const { user } = useAuth()
//   const router = useRouter()
//   const [order, setOrder] = useState<Order | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [downloading, setDownloading] = useState(false)

//   useEffect(() => {
//     if (!user) {
//       router.push("/login?redirect=/account/orders")
//       return
//     }

//     const fetchOrder = async () => {
//       try {
//         const response = await apiFetch(`/api/orders/${params.id}`)
//         if (response.ok) {
//           const data = await response.json()
//           setOrder(data)
//         } else {
//           router.push("/account/orders")
//         }
//       } catch (error) {
//         console.error("Error fetching order:", error)
//         router.push("/account/orders")
//       } finally {
//         setLoading(false)
//       }
//     }

//     fetchOrder()
//   }, [user, router, params.id])

//   const handleTrackOrder = () => {
//     if (order?.trackingNumber) {
//       window.open(`https://shiprocket.co/tracking/${order.trackingNumber}`, "_blank")
//     }
//   }

//   const handleContactSupport = () => {
//     router.push("/contact")
//   }

//   const handleDownloadInvoice = async () => {
//     if (!order) return

//     setDownloading(true)
//     try {
//       const response = await apiFetch(`/api/orders/${params.id}/invoice`)
//       if (response.ok) {
//         const blob = await response.blob()
//         const url = window.URL.createObjectURL(blob)
//         const a = document.createElement("a")
//         a.href = url
//         a.download = `invoice-${order.id.slice(0, 8)}.pdf`
//         document.body.appendChild(a)
//         a.click()
//         window.URL.revokeObjectURL(url)
//         document.body.removeChild(a)
//       } else {
//         alert("Failed to download invoice. Please try again.")
//       }
//     } catch (error) {
//       console.error("Error downloading invoice:", error)
//       alert("Failed to download invoice. Please try again.")
//     } finally {
//       setDownloading(false)
//     }
//   }

//   if (!user || loading) {
//     return (
//       <div className="flex flex-col min-h-screen">
//         <Header />
//         <main className="flex-grow container mx-auto px-4 py-8">
//           <div className="text-center py-12">
//             <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-maroon-800 border-r-transparent"></div>
//             <h2 className="text-2xl font-bold mt-4">Loading order details...</h2>
//           </div>
//         </main>
//         <Footer />
//       </div>
//     )
//   }

//   if (!order) {
//     return (
//       <div className="flex flex-col min-h-screen">
//         <Header />
//         <main className="flex-grow container mx-auto px-4 py-8">
//           <div className="text-center py-12">
//             <h2 className="text-2xl font-bold mb-4">Order not found</h2>
//             <Link href="/account/orders">
//               <button className="bg-maroon-800 text-white px-6 py-3 rounded-lg hover:bg-maroon-900 transition-colors">
//                 Back to Orders
//               </button>
//             </Link>
//           </div>
//         </main>
//         <Footer />
//       </div>
//     )
//   }

//   return (
//     <div className="flex flex-col min-h-screen">
//       <Header />
//       <main className="flex-grow">
//         {/* Hero Banner */}
//         <div className="bg-maroon-800 text-white py-12">
//           <div className="container mx-auto px-4">
//             <h1 className="text-3xl font-bold mb-4">Order #{order.id.slice(0, 8)}</h1>
//             <p className="text-maroon-100 max-w-2xl">Placed on {new Date(order.date).toLocaleDateString()}</p>
//           </div>
//         </div>

//         <div className="container mx-auto px-4 py-8">
//           <div className="mb-6 flex items-center">
//             <Link href="/account" className="text-maroon-800 hover:underline">
//               Account
//             </Link>
//             <ChevronRight className="h-4 w-4 mx-2" />
//             <Link href="/account/orders" className="text-maroon-800 hover:underline">
//               Orders
//             </Link>
//             <ChevronRight className="h-4 w-4 mx-2" />
//             <span>Order #{order.id.slice(0, 8)}</span>
//           </div>

//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//             {/* Order Summary */}
//             <div className="lg:col-span-2">
//               <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
//                 <div className="p-6 bg-gray-50 border-b">
//                   <div className="flex justify-between items-center">
//                     <h2 className="text-xl font-semibold">Order Summary</h2>
//                     <span
//                       className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
//                         order.status === "delivered"
//                           ? "bg-green-100 text-green-800"
//                           : order.status === "shipped"
//                             ? "bg-blue-100 text-blue-800"
//                             : "bg-yellow-100 text-yellow-800"
//                       }`}
//                     >
//                       {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="p-6">
//                   <ul className="divide-y divide-gray-200">
//                     {order.items.map((item: any) => (
//                       <li key={item.id} className="py-4 flex">
//                         <img
//                           src={item.image || "/placeholder.svg?height=80&width=80"}
//                           alt={item.name}
//                           className="h-20 w-20 object-cover rounded"
//                         />
//                         <div className="ml-6 flex-1">
//                           <div className="flex justify-between">
//                             <div>
//                               <h3 className="text-lg font-medium">{item.name}</h3>
//                               <p className="mt-1 text-gray-500">Quantity: {item.quantity}</p>
//                             </div>
//                             <p className="text-lg font-medium">₹{item.price.toLocaleString("en-IN")}</p>
//                           </div>
//                         </div>
//                       </li>
//                     ))}
//                   </ul>

//                   <div className="mt-6 border-t pt-6">
//                     <div className="flex justify-between mb-2">
//                       <span className="text-gray-600">Subtotal</span>
//                       <span>₹{(order.total - order.shipping).toLocaleString("en-IN")}</span>
//                     </div>
//                     <div className="flex justify-between mb-2">
//                       <span className="text-gray-600">Shipping</span>
//                       <span>₹{order.shipping.toLocaleString("en-IN")}</span>
//                     </div>
//                     <div className="flex justify-between font-semibold text-lg">
//                       <span>Total</span>
//                       <span>₹{order.total.toLocaleString("en-IN")}</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Order Timeline */}
//               <div className="bg-white rounded-lg shadow-md overflow-hidden">
//                 <div className="p-6 bg-gray-50 border-b">
//                   <h2 className="text-xl font-semibold">Order Timeline</h2>
//                 </div>

//                 <div className="p-6">
//                   <ol className="relative border-l border-gray-200 ml-3">
//                     {order.timeline?.map((event: any, index: number) => (
//                       <li key={index} className="mb-10 ml-6">
//                         <span className="absolute flex items-center justify-center w-6 h-6 bg-maroon-100 rounded-full -left-3 ring-8 ring-white">
//                           <div className="h-3 w-3 rounded-full bg-maroon-800"></div>
//                         </span>
//                         <h3 className="flex items-center mb-1 text-lg font-semibold">
//                           {event.status}
//                           {index === 0 && (
//                             <span className="bg-blue-100 text-blue-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded ml-3">
//                               Latest
//                             </span>
//                           )}
//                         </h3>
//                         <time className="block mb-2 text-sm font-normal leading-none text-gray-400">
//                           {new Date(event.date).toLocaleDateString()}
//                         </time>
//                         <p className="mb-4 text-base font-normal text-gray-500">{event.description}</p>
//                       </li>
//                     ))}
//                   </ol>
//                 </div>
//               </div>
//             </div>

//             {/* Order Details */}
//             <div className="lg:col-span-1">
//               <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
//                 <div className="p-6 bg-gray-50 border-b">
//                   <h2 className="text-xl font-semibold">Order Details</h2>
//                 </div>

//                 <div className="p-6">
//                   <div className="flex items-start mb-4">
//                     <Calendar className="h-5 w-5 text-gray-400 mr-3 mt-1" />
//                     <div>
//                       <h3 className="font-medium">Order Date</h3>
//                       <p className="text-gray-600">{new Date(order.date).toLocaleDateString()}</p>
//                     </div>
//                   </div>

//                   <div className="flex items-start mb-4">
//                     <CreditCard className="h-5 w-5 text-gray-400 mr-3 mt-1" />
//                     <div>
//                       <h3 className="font-medium">Payment Method</h3>
//                       <p className="text-gray-600">{order.paymentMethod}</p>
//                     </div>
//                   </div>

//                   <div className="flex items-start mb-4">
//                     <Truck className="h-5 w-5 text-gray-400 mr-3 mt-1" />
//                     <div className="flex-1">
//                       <h3 className="font-medium">Shipping Status</h3>
//                       <p className="text-gray-600">{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
//                       {order.trackingNumber && (
//                         <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
//                           <p className="text-xs font-medium text-blue-900 mb-1">Tracking Number</p>
//                           <p className="text-sm text-blue-700 font-mono font-semibold break-all">
//                             {order.trackingNumber}
//                           </p>
//                         </div>
//                       )}
//                     </div>
//                   </div>

//                   <div className="flex items-start">
//                     <Package className="h-5 w-5 text-gray-400 mr-3 mt-1" />
//                     <div>
//                       <h3 className="font-medium">Order Total</h3>
//                       <p className="text-gray-600 text-lg font-semibold">₹{order.total.toLocaleString("en-IN")}</p>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
//                 <div className="p-6 bg-gray-50 border-b">
//                   <h2 className="text-xl font-semibold">Shipping Address</h2>
//                 </div>

//                 <div className="p-6">
//                   <div className="flex items-start">
//                     <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-1" />
//                     <div>
//                       <h3 className="font-medium">{order.shippingAddress?.name}</h3>
//                       <p className="text-gray-600">{order.shippingAddress?.street}</p>
//                       <p className="text-gray-600">
//                         {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zip}
//                       </p>
//                       <p className="text-gray-600">{order.shippingAddress?.country}</p>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-white rounded-lg shadow-md overflow-hidden">
//                 <div className="p-6 bg-gray-50 border-b">
//                   <h2 className="text-xl font-semibold">Need Help?</h2>
//                 </div>

//                 <div className="p-6 space-y-3">
//                   {order.trackingNumber && (
//                     <button
//                       onClick={handleTrackOrder}
//                       className="w-full flex items-center justify-center bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
//                     >
//                       <Truck className="h-5 w-5 mr-2" />
//                       Track Order
//                       <ExternalLink className="h-4 w-4 ml-2" />
//                     </button>
//                   )}
//                   <button
//                     onClick={handleDownloadInvoice}
//                     disabled={downloading}
//                     className="w-full flex items-center justify-center bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     <Download className="h-5 w-5 mr-2" />
//                     {downloading ? "Downloading..." : "Download Invoice"}
//                   </button>
//                   <button
//                     onClick={handleContactSupport}
//                     className="w-full flex items-center justify-center bg-maroon-800 text-white px-4 py-3 rounded-lg hover:bg-maroon-900 transition-colors"
//                   >
//                     <MessageCircle className="h-5 w-5 mr-2" />
//                     Contact Support
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </main>
//       <Footer />
//     </div>
//   )
// }

