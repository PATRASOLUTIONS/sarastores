import { redirect } from "next/navigation"

/**
 * The account-area profile editor was retired in favour of /dashboard/settings.
 * Without a default export this route returned HTTP 500, so it now redirects.
 * The previous implementation is preserved (commented) below.
 */
export default function AccountProfilePage() {
  redirect("/dashboard/settings")
}

// "use client"

// import type React from "react"

// import { useAuth } from "@/contexts/AuthContext"
// import { useRouter } from "next/navigation"
// import { useEffect, useState } from "react"
// import Header from "@/components/Header"
// import Footer from "@/components/Footer"
// import Link from "next/link"
// import { ChevronRight, User } from "lucide-react"

// export default function ProfilePage() {
//   const { user } = useAuth()
//   const router = useRouter()
//   const [name, setName] = useState("")
//   const [email, setEmail] = useState("")
//   const [phone, setPhone] = useState("")
//   const [isLoading, setIsLoading] = useState(false)
//   const [message, setMessage] = useState({ type: "", text: "" })

//   useEffect(() => {
//     if (!user) {
//       router.push("/login?redirect=/account/profile")
//       return
//     }

//     // Set initial values
//     setName(user.name || "")
//     setEmail(user.email || "")
//     setPhone("")
//   }, [user, router])

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setIsLoading(true)
//     setMessage({ type: "", text: "" })

//     try {
//       // Simulate API call
//       await new Promise((resolve) => setTimeout(resolve, 1000))

//       setMessage({
//         type: "success",
//         text: "Profile updated successfully!",
//       })
//     } catch (error) {
//       setMessage({
//         type: "error",
//         text: "An error occurred. Please try again.",
//       })
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   if (!user) {
//     return (
//       <div className="flex flex-col min-h-screen">
//         <Header />
//         <main className="flex-grow container mx-auto px-4 py-8">
//           <div className="text-center py-12">
//             <h2 className="text-2xl font-bold mb-4">Please log in to view your profile</h2>
//             <Link href="/login?redirect=/account/profile">
//               <button className="bg-maroon-800 text-white px-6 py-3 rounded-lg hover:bg-maroon-900 transition-colors">
//                 Login
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
//             <h1 className="text-3xl font-bold mb-4">My Profile</h1>
//             <p className="text-maroon-100 max-w-2xl">Manage your personal information</p>
//           </div>
//         </div>

//         <div className="container mx-auto px-4 py-8">
//           <div className="mb-6 flex items-center">
//             <Link href="/account" className="text-maroon-800 hover:underline">
//               Account
//             </Link>
//             <ChevronRight className="h-4 w-4 mx-2" />
//             <span>Profile</span>
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//             <div className="md:col-span-1">
//               <div className="bg-white rounded-lg shadow-md p-6">
//                 <div className="flex flex-col items-center">
//                   <div className="bg-maroon-100 p-6 rounded-full mb-4 text-maroon-800">
//                     <User className="h-16 w-16" />
//                   </div>
//                   <h2 className="text-xl font-semibold">{user.name}</h2>
//                   <p className="text-gray-600">{user.email}</p>
//                 </div>
//               </div>
//             </div>

//             <div className="md:col-span-2">
//               <div className="bg-white rounded-lg shadow-md overflow-hidden">
//                 <div className="p-6 bg-gray-50 border-b">
//                   <h2 className="text-xl font-semibold">Personal Information</h2>
//                 </div>

//                 <div className="p-6">
//                   {message.text && (
//                     <div
//                       className={`mb-4 p-3 rounded-md ${
//                         message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
//                       }`}
//                     >
//                       {message.text}
//                     </div>
//                   )}

//                   <form onSubmit={handleSubmit}>
//                     <div className="mb-4">
//                       <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
//                         Full Name
//                       </label>
//                       <input
//                         type="text"
//                         id="name"
//                         value={name}
//                         onChange={(e) => setName(e.target.value)}
//                         className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
//                         required
//                       />
//                     </div>

//                     <div className="mb-4">
//                       <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
//                         Email Address
//                       </label>
//                       <input
//                         type="email"
//                         id="email"
//                         value={email}
//                         onChange={(e) => setEmail(e.target.value)}
//                         className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
//                         required
//                       />
//                     </div>

//                     <div className="mb-6">
//                       <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">
//                         Phone Number
//                       </label>
//                       <input
//                         type="tel"
//                         id="phone"
//                         value={phone}
//                         onChange={(e) => setPhone(e.target.value)}
//                         className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
//                       />
//                     </div>

//                     <button
//                       type="submit"
//                       disabled={isLoading}
//                       className="bg-maroon-800 text-white py-2 px-6 rounded-md hover:bg-maroon-900 transition-colors disabled:opacity-50"
//                     >
//                       {isLoading ? "Saving..." : "Save Changes"}
//                     </button>
//                   </form>
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
