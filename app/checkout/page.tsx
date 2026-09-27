"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { analytics, toAnalyticsItem } from "@/lib/analytics"
import { useSettingsData } from "@/hooks/useSettingsData"
import { cleanProductName } from "@/utils/cleanProductName"
import PaymentGateway from "@/components/PaymentGateway"
import InStorePurchase from "@/components/InStorePurchase"
import FulfilmentSelector, {
  type FulfilmentMethod,
  type PickupStore,
} from "@/components/FulfilmentSelector"
import LoyaltyRedeemer from "@/components/LoyaltyRedeemer"
import TrustStrip from "@/components/account/TrustStrip"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Truck,
  Shield,
  CheckCircle,
  Package,
  User,
  MapPin,
  Phone,
  Mail,
  Trash2,
} from "lucide-react"
import { toast } from "react-hot-toast"

interface CheckoutStep {
  id: number
  title: string
  description: string
}

const steps: CheckoutStep[] = [
  { id: 1, title: "Customer Details", description: "Enter your personal information" },
  { id: 2, title: "Payment", description: "Choose your payment method" },
]

// Four labels for the visual tracker; steps 1–2 belong to the details screen,
// 3–4 to the payment screen.
const CHECKOUT_TRACKER = ["Address", "Delivery", "Payment", "Review & Place Order"]

/** Deriving the ex-GST subtotal divides by 1.18, so raw toLocaleString leaks 3 decimals. */
const money = (value: number) =>
  Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CheckoutPage() {
  const { cart, clearCart, removeFromCart, isLoading: cartLoading } = useCart()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null)
  const orderLock = useSubmitLock()
  const couponLock = useSubmitLock()
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [placedOrder, setPlacedOrder] = useState<any>(null)
  const [paymentCompleted, setPaymentCompleted] = useState(false)

  // Form data
  const [customerData, setCustomerData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    employeeId: "",
  })

  const [paymentMethod, setPaymentMethod] = useState("online")

  // Click & Pick: home delivery or collection from a SARA store.
  const [fulfilmentMethod, setFulfilmentMethod] = useState<FulfilmentMethod>("delivery")
  const [pickupStore, setPickupStore] = useState<PickupStore | null>(null)
  const isPickup = fulfilmentMethod === "pickup"

  // Guest checkout: the shopper explicitly opts out of signing in.
  const [continueAsGuest, setContinueAsGuest] = useState(false)
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null)

  // Rewards points proposed for redemption; the server decides the real value.
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0)

  // India states and cities data
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  // Shipping settings from database
  const [shippingFee, setShippingFee] = useState(99)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(1000)
  const { data: settingsData, isLoading: isLoadingSettings } = useSettingsData()

  // Update local state when settings data is loaded
  useEffect(() => {
    if (settingsData) {
      if (settingsData.shippingFee !== undefined) {
        setShippingFee(settingsData.shippingFee)
      }
      if (settingsData.freeShippingThreshold !== undefined) {
        setFreeShippingThreshold(settingsData.freeShippingThreshold)
      }
    }
  }, [settingsData])

  // Coupon state and derived totals
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; name: string } | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  // Calculate totals for software and hardware separately (treat item.price as gross, including GST)
  const { softwareBaseTotal, hardwareBaseTotal, softwareGross, hardwareGross } = cart.reduce((acc, item) => {
    const qty = item.quantity || 1
    if (item.type === 'software') {
      // For software, price includes GST, so we calculate base price (price/1.18)
      const basePrice = (item.price / 1.18) * qty;
      acc.softwareBaseTotal += basePrice;
      acc.softwareGross += item.price * qty;
    } else {
      // For hardware, price includes GST as well; compute base by dividing by 1.18
      const basePrice = (item.price / 1.18) * qty;
      acc.hardwareBaseTotal += basePrice;
      acc.hardwareGross += item.price * qty;
    }
    return acc;
  }, { softwareBaseTotal: 0, hardwareBaseTotal: 0, softwareGross: 0, hardwareGross: 0 });

  // Calculate GST for software and hardware (18% of their base prices)
  const softwareGST = softwareBaseTotal * 0.18
  const hardwareGST = hardwareBaseTotal * 0.18

  // Subtotal (tax-exclusive base amount)
  const subtotal = softwareBaseTotal + hardwareBaseTotal

  // Gross totals (base + GST)
  const softwareTotal = softwareBaseTotal + softwareGST
  const hardwareTotal = hardwareBaseTotal + hardwareGST

  // Total tax (software + hardware)
  const tax = softwareGST + hardwareGST

  // Only apply shipping if there are hardware items in the cart
  const hasHardware = cart.some(item => item.type !== 'software')
  let shipping = 0
  if (hasHardware && !isLoadingSettings && !isPickup) {
    const hardwareGrossSubtotal = hardwareGross
    shipping = (hardwareGrossSubtotal > 0 && hardwareGrossSubtotal < freeShippingThreshold) ? shippingFee : 0
  }

  // Apply coupon discount (if any) on gross amounts (softwareTotal + hardwareTotal)
  const preCouponTotal = softwareTotal + hardwareTotal
  const discountedTotal = Math.max(0, preCouponTotal - couponDiscount)

  // Calculate final total (after coupon and adding shipping)
  const total = discountedTotal + shipping

  // Indicative only — /api/orders recomputes and debits the points.
  const payableTotal = Math.max(0, total - loyaltyDiscount)


  // Fetch Indian states on mount
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch("/api/india/states")
        const data = await response.json()
        setStates(data.states || [])
      } catch (error) {
        console.error("Error fetching states:", error)
        toast.error("Failed to load states")
      }
    }
    fetchStates()
  }, [])

  // Fetch cities when state changes
  useEffect(() => {
    const fetchCities = async () => {
      if (!customerData.state) {
        setCities([])
        return
      }

      setLoadingCities(true)
      try {
        const response = await fetch(`/api/india/cities?state=${encodeURIComponent(customerData.state)}`)
        const data = await response.json()
        setCities(data.cities || [])
      } catch (error) {
        console.error("Error fetching cities:", error)
        toast.error("Failed to load cities")
      } finally {
        setLoadingCities(false)
      }
    }
    fetchCities()
  }, [customerData.state])

  useEffect(() => {
    // Populate customer data from user profile
    if (user) {
      setCustomerData((prev) => ({
        ...prev,
        firstName: user.name?.split(" ")[0] || "",
        lastName: user.name?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address?.street || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        pincode: user.address?.zip || "",
      }))
    }
  }, [user])

  // Close the remove-item dialog on Escape.
  useEffect(() => {
    if (!itemToRemove) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setItemToRemove(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [itemToRemove])

  // Redirect to cart if empty after loading completes.
  // On a direct load of /checkout the cart context briefly reports "not loading,
  // empty" while AuthContext is still hydrating, so the redirect is deferred and
  // cancelled if the cart arrives.
  useEffect(() => {
    if (authLoading || cartLoading || orderPlaced || cart.length > 0) return

    const timer = setTimeout(() => {
      toast.error("Your cart is empty")
      router.push("/cart")
    }, 1500)

    return () => clearTimeout(timer)
  }, [authLoading, cartLoading, cart.length, orderPlaced, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setCustomerData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validateStep1 = async () => {
    // Guests may complete checkout; identity for a guest order comes from the
    // validated email and phone below, never from the client.
    if (!user && !continueAsGuest) {
      toast.error("Choose to sign in or continue as a guest")
      return false
    }

    const required = isPickup
      ? ["firstName", "lastName", "email", "phone"]
      : ["firstName", "lastName", "email", "phone", "address", "city", "state", "pincode"]
    for (const field of required) {
      if (!customerData[field as keyof typeof customerData]) {
        toast.error(`Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`)
        return false
      }
    }

    if (isPickup && !pickupStore) {
      toast.error("Please choose a store to collect your order from")
      return false
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerData.email)) {
      toast.error("Please enter a valid email address")
      return false
    }

    // Validate phone
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(customerData.phone)) {
      toast.error("Please enter a valid 10-digit phone number")
      return false
    }

    // Pincode and serviceability only matter when we are delivering.
    if (isPickup) return true

    // Validate pincode
    const pincodeRegex = /^[0-9]{6}$/
    if (!pincodeRegex.test(customerData.pincode)) {
      toast.error("Please enter a valid 6-digit pincode")
      return false
    }

    // Check pincode restrictions
    try {
      const res = await fetch("/api/blocked-pincodes")
      const data = await res.json()
      const mode = data.mode || "blocked"

      // Extract pincode strings from objects
      const blockedPincodesArray = Array.isArray(data.blockedPincodes)
        ? data.blockedPincodes.map((entry: any) => typeof entry === 'string' ? entry : entry.pincode)
        : []
      const allowedPincodesArray = Array.isArray(data.allowedPincodes)
        ? data.allowedPincodes.map((entry: any) => typeof entry === 'string' ? entry : entry.pincode)
        : []

      if (mode === "blocked") {
        // Blocked mode: Check if pincode is in blocked list
        if (blockedPincodesArray.includes(customerData.pincode)) {
          toast.error("Sorry, we do not deliver to this pincode.")
          return false
        }
      } else if (mode === "allowed") {
        // Allowed mode: Check if pincode is in allowed list
        if (!allowedPincodesArray.includes(customerData.pincode)) {
          toast.error("Sorry, we do not deliver to this pincode.")
          return false
        }
      } else if (mode === "both") {
        // Both mode: Pincode must be in allowed list AND not in blocked list
        const isAllowed = allowedPincodesArray.includes(customerData.pincode)
        const isBlocked = blockedPincodesArray.includes(customerData.pincode)

        if (isBlocked) {
          // Show specific message for blocked pincodes in both mode
          toast.error("Sorry, we cannot deliver to this pincode. Many orders from this area have been returned, so delivery is currently unavailable.")
          return false
        }

        if (!isAllowed) {
          toast.error("Sorry, we do not deliver to this pincode.")
          return false
        }
      }
    } catch (e) {
      toast.error("Could not verify pincode delivery. Please try again.")
      return false
    }

    return true
  }

  const handleNextStep = async () => {
    if (currentStep === 1) {
      const valid = await validateStep1()
      if (!valid) return
      analytics.beginCheckout(cart.map((i) => toAnalyticsItem(i)))
    }
    setCurrentStep((prev) => Math.min(prev + 1, 2))
  }

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  // Apply coupon handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    if (!couponLock.acquire()) return
    setApplyingCoupon(true)
    try {
      const payload = {
        code: couponCode.trim(),
        cart: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
        userId: user?.id,
      }
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        setAppliedCoupon(null)
        setCouponDiscount(0)
        return toast.error(data.error || "Invalid coupon")
      }
      setAppliedCoupon({ code: data.code, name: data.name })
      setCouponDiscount(Number(data.discount) || 0)
      toast.success(`Applied ${data.code}`)
    } catch (e) {
      console.error("ByteWise Testing Point apply coupon error:", e)
      toast.error("Failed to apply coupon")
    } finally {
      couponLock.release()
      setApplyingCoupon(false)
    }
  }

  // Redeem coupon after placing order successfully
  const redeemAppliedCoupon = async () => {
    if (!appliedCoupon) return
    try {
      await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: appliedCoupon.code, userId: user?.id }),
      })
    } catch (e) {
      console.error("ByteWise Testing Point redeem coupon error:", e)
    }
  }

  const handlePlaceOrder = async (paymentDetails?: any) => {
    // Hard guard: a duplicate call here would create a second order.
    if (!orderLock.acquire()) return
    setIsProcessing(true)

    try {
      // Create order data
      const orderData = {
        userId: user?.id,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          type: item.type,
          // Preserve integration metadata (KGen / exlr8)
          provider: (item as any).provider || null,
          source: (item as any).source || null,
          kgenProductId: (item as any).kgenProductId || null,
          kgenVariantId: (item as any).kgenVariantId || null,
          // Include software-specific details
          ...(item.type === 'software' && {
            maxDevices: item.maxDevices,
            packSize: item.packSize,
            validity: item.validity,
            validityYears: item.validityYears,
          }),
        })),
        customer: {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          name: `${customerData.firstName} ${customerData.lastName}`,
          email: customerData.email,
          phone: customerData.phone,
          address: customerData.address,
          city: customerData.city,
          state: customerData.state,
          zipCode: customerData.pincode,
          country: customerData.country,
        },
        shippingAddress: {
          name: `${customerData.firstName} ${customerData.lastName}`,
          street: isPickup ? pickupStore?.address || "" : customerData.address,
          city: isPickup ? pickupStore?.city || "" : customerData.city,
          state: customerData.state,
          zip: customerData.pincode,
          country: customerData.country,
        },
        fulfilment: {
          method: fulfilmentMethod,
          ...(isPickup && pickupStore
            ? {
                storeId: pickupStore.id,
                storeName: pickupStore.name,
                storeAddress: pickupStore.address,
                storePhone: pickupStore.phone,
              }
            : {}),
        },
        paymentMethod: paymentDetails?.method || paymentMethod,
        // Add employee details for in-store purchases
        ...(paymentMethod === "instore" && {
          employeeId: paymentDetails?.employeeId,
          verifiedEmail: paymentDetails?.verifiedEmail,
        }),
        paymentDetails: {
          method: paymentDetails?.method || paymentMethod,
          status: paymentDetails?.status || "pending",
          // Include employee details in payment details
          ...(paymentMethod === "instore" && {
            employeeId: paymentDetails?.employeeId,
            verifiedEmail: paymentDetails?.verifiedEmail,
            verifiedAt: new Date().toISOString()
          }),
          ...(paymentMethod === "online" && {
            paymentId: paymentDetails?.paymentId,
            orderId: paymentDetails?.orderId,
            transactionId: paymentDetails?.razorpay_payment_id,
          }),
        },
        subtotal,
        tax,
        shipping,
        total: payableTotal,
        redeemPoints,
        coupon: appliedCoupon ? {
          code: appliedCoupon.code,
          name: appliedCoupon.name,
          discount: couponDiscount
        } : null,
        status: paymentDetails?.status === "completed" ? "confirmed" : "pending",
      }

      if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Sending order data:", orderData)

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      })

      const result = await response.json()
      if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Order response:", result)

      if (result.success) {
        const newOrderId = result.orderId || `ORD${Date.now()}`
        setOrderId(newOrderId)
        setOrderPlaced(true)

        // Returned only once, so persist it before anything else can fail.
        const token: string | null = result.guestAccessToken || null
        if (token) {
          setGuestAccessToken(token)
          try {
            localStorage.setItem(`guest_order_${newOrderId}`, token)
          } catch {
            // Private browsing / quota — the link on this screen still works.
          }
        }

        analytics.purchase({
          transactionId: newOrderId,
          value: total,
          tax,
          shipping,
          coupon: appliedCoupon?.code ?? null,
          items: cart.map((i) => toAnalyticsItem(i)),
        })

        // Redeem coupon after successful order
        if (appliedCoupon) {
          await redeemAppliedCoupon()
          if (process.env.NODE_ENV === "development") {
            console.log("ByteWise Testing Point Coupon redeemed:", appliedCoupon.code)
          }
        }

        // Fetch the placed order from the database to get the real total
        try {
          const orderRes = await fetch(
            token ? `/api/orders/${newOrderId}?token=${encodeURIComponent(token)}` : `/api/orders/${newOrderId}`,
          )
          if (orderRes.ok) {
            const orderJson = await orderRes.json()
            setPlacedOrder(orderJson)
          } else {
            setPlacedOrder(null)
          }
        } catch (fetchOrderErr) {
          setPlacedOrder(null)
        }

        // If the order contains integration items, group them by provider and call provider-specific place-order endpoints.
        try {
          const integrationGroups: Record<string, any[]> = {}
          for (const it of cart) {
            const itemAny = it as any
            const provider = itemAny.provider || (itemAny.source === 'kgen' ? 'exlr8' : null)
            if (!provider) continue
            integrationGroups[provider] = integrationGroups[provider] || []
            integrationGroups[provider].push(itemAny)
          }

          const providerKeys = Object.keys(integrationGroups)
          if (providerKeys.length > 0) {
            if (process.env.NODE_ENV === 'development') console.log('ByteWise Testing Point placing integration orders for providers:', providerKeys)

            const results = await Promise.all(providerKeys.map(async (provider) => {
              try {
                const res = await fetch(`/api/integrations/${encodeURIComponent(provider)}/place-order`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: newOrderId, userId: user?.id, items: integrationGroups[provider] })
                })
                const data = await res.json()
                return { provider, ok: res.ok, data }
              } catch (e) {
                return { provider, ok: false, error: e }
              }
            }))

            // Summarize results for the user
            const queued = results.filter(r => r.data && (r.data.queued || r.data.queueId))
            const placed = results.filter(r => r.data && r.data.placed)
            const failed = results.filter(r => !r.ok || (r.data && r.data.error))

            if (queued.length > 0) {
              toast.success(`Order placed. ${queued.length} provider(s) queued for processing.`)
            } else if (placed.length > 0 && failed.length === 0) {
              toast.success('Order placed and integration items were forwarded to providers successfully.')
            } else if (failed.length > 0) {
              toast.success('Order placed but some integration items will be processed later. Check your orders page.')
            } else {
              toast.success('Order placed successfully!')
            }
          } else {
            toast.success('Order placed successfully!')
          }
        } catch (queueErr) {
          console.error('Failed to call provider place-order endpoints:', queueErr)
          toast.success('Order placed successfully!')
        }

        if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Clearing cart after successful order")
        clearCart()
      } else {
        throw new Error(result.error || "Failed to place order")
      }
    } catch (error) {
      console.error("ByteWise Testing Point Error placing order:", error)
      toast.error("Failed to place order. Please try again.")
    } finally {
      orderLock.release()
      setIsProcessing(false)
    }
  }

  const handlePaymentSuccess = (paymentDetails: any) => {
    // Directly place order on payment success without showing confirmation
    handlePlaceOrder(paymentDetails)
  }

  if (cartLoading) {
    // Full page loader
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center">
            <span className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1560BD] mb-4"></span>
            <span className="text-[#0F2557] text-lg font-medium">Loading checkout...</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show a processing loader when an in-store purchase has been verified and the order is being placed
  if (isProcessing && paymentMethod === "instore" && !orderPlaced) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center bg-white p-8 rounded-lg shadow-md">
            <span className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1560BD] mb-4"></span>
            <h2 className="text-xl font-semibold mb-2">Processing the order</h2>
            <p className="text-gray-600">We're verifying your in-store purchase and finalizing the order. This may take a few moments.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (orderPlaced) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow bg-gray-50 py-12">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>

              <h1 className="text-3xl font-bold text-green-600 mb-4">Order Confirmed!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for your purchase. Your order has been successfully placed and is being processed.
              </p>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="text-left">
                    <span className="font-semibold text-gray-700">Order ID:</span>
                    <p className="text-blue-600 font-mono mt-1">{orderId}</p>
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-700">Total Amount:</span>
                    <p className="text-xl font-bold text-green-600 mt-1">₹{money(placedOrder?.total ?? total)}</p>
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-700">Payment Method:</span>
                    <p className="mt-1">{placedOrder?.paymentMethod ? placedOrder.paymentMethod.charAt(0).toUpperCase() + placedOrder.paymentMethod.slice(1) : "Online Payment"}</p>
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-700">Delivery Address:</span>
                    <p className="mt-1">
                      <strong>Consumer Name :-</strong> {placedOrder?.shippingAddress?.name || `${customerData.firstName} ${customerData.lastName}`}
                      <br />
                      <strong>Address :-</strong> {placedOrder?.shippingAddress?.street || customerData.address}, {placedOrder?.shippingAddress?.city || customerData.city}, {placedOrder?.shippingAddress?.state || customerData.state}, {placedOrder?.shippingAddress?.zip || customerData.pincode}
                      <br />
                      <strong>Country :-</strong> {placedOrder?.shippingAddress?.country || customerData.country}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
                  <Package className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-sm">Order Processing</h3>
                  <p className="text-xs text-gray-600 text-center">Your order is being prepared</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg">
                  <Truck className="h-8 w-8 text-yellow-600 mb-2" />
                  <h3 className="font-semibold text-sm">Shipping</h3>
                  <p className="text-xs text-gray-600 text-center">Expected delivery in 7 - 8 days</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
                  <Shield className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold text-sm">Secure Payment</h3>
                  <p className="text-xs text-gray-600 text-center">Your payment is protected</p>
                </div>
              </div>

              {guestAccessToken && (
                <div className="mb-8 rounded-lg border border-blue-100 bg-blue-50 p-5 text-left">
                  <h3 className="font-semibold text-gray-900">Save your order link</h3>
                  <p className="mt-1 text-sm text-gray-700">
                    You checked out as a guest. This private link is the only way to reopen this
                    order without an account — we&apos;ve also emailed it to{" "}
                    <span className="font-medium">{customerData.email}</span>.
                  </p>
                  <Link
                    href={`/order/${orderId}?token=${encodeURIComponent(guestAccessToken)}`}
                    className="mt-3 inline-block break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-blue-700 ring-1 ring-blue-200 hover:underline"
                  >
                    /order/{orderId}
                  </Link>
                  <p className="mt-3 text-sm text-gray-700">
                    Want your full order history?{" "}
                    <Link
                      href={`/register?email=${encodeURIComponent(customerData.email)}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Create an account
                    </Link>{" "}
                    with the same email address.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => router.push("/dashboard/orders")}
                  className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Track Your Order
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F9FC]">
      <Header />
      <main className="flex-grow">
        <div className="section-container space-y-5 py-5">
          <nav className="flex items-center gap-2 text-[12px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            <span className="text-gray-300">›</span>
            <Link href="/cart" className="hover:text-[#1560BD]">
              Cart
            </Link>
            <span className="text-gray-300">›</span>
            <span className="font-medium text-gray-700">Checkout</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-[24px] font-bold text-[#0F2557]">Checkout</h1>
              <p className="mt-0.5 text-[13px] text-slate-600">
                Almost there! Complete your order in a few simple steps.
              </p>
            </div>
            <ol className="flex flex-wrap items-center gap-2 text-[11px]">
              {CHECKOUT_TRACKER.map((label, index) => {
                const done = index <= (currentStep === 1 ? 1 : 3)
                return (
                  <li key={label} className="flex items-center gap-2">
                    {index > 0 && <span className="h-px w-5 bg-gray-300" aria-hidden />}
                    <span
                      className={`flex items-center gap-1.5 ${
                        done ? "font-semibold text-[#1560BD]" : "text-gray-400"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          done ? "bg-[#1560BD] text-white" : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Customer Details - Left side */}
            <div className="space-y-5">
              {currentStep === 1 && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h2 className="mb-5 flex items-center gap-2 font-heading text-[16px] font-bold text-[#0F2557]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1560BD] text-[11px] font-bold text-white">
                      1
                    </span>
                    Delivery Address
                  </h2>

                  {!user && (
                    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        Sign in for faster checkout, or continue as a guest
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => router.push("/login?redirect=/checkout")}
                          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                          Sign in
                        </button>
                        <button
                          type="button"
                          onClick={() => setContinueAsGuest(true)}
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                            continueAsGuest
                              ? "border-brand-primary bg-brand-primary-subtle text-brand-primary"
                              : "border-gray-300 text-gray-700 hover:bg-white"
                          }`}
                        >
                          {continueAsGuest ? "Continuing as guest" : "Continue as guest"}
                        </button>
                      </div>
                      {continueAsGuest && (
                        <p className="mt-3 text-xs text-gray-600">
                          We&apos;ll email your order details and a private tracking link. You can
                          create an account afterwards to keep your order history.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={customerData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={customerData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        <Mail className="h-4 w-4 inline mr-1" />
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={customerData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        <Phone className="h-4 w-4 inline mr-1" />
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={customerData.phone}
                        onChange={handleInputChange}
                        placeholder="10-digit mobile number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                    </div>
                  </div>

                  <FulfilmentSelector
                    method={fulfilmentMethod}
                    onMethodChange={setFulfilmentMethod}
                    selectedStore={pickupStore}
                    onStoreChange={setPickupStore}
                  />

                  {!isPickup && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <MapPin className="h-5 w-5 mr-2" />
                      Delivery Address
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                          Address *
                        </label>
                        <textarea
                          id="address"
                          name="address"
                          value={customerData.address}
                          onChange={handleInputChange}
                          rows={3}
                          placeholder="House no, Building, Street, Area"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                            State *
                          </label>
                          <select
                            id="state"
                            name="state"
                            value={customerData.state}
                            onChange={(e) => {
                              handleInputChange(e)
                              // Reset city when state changes
                              setCustomerData((prev) => ({ ...prev, city: "" }))
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                            required
                          >
                            <option value="">Select State</option>
                            {states.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                            City *
                          </label>
                          <select
                            id="city"
                            name="city"
                            value={customerData.city}
                            onChange={handleInputChange}
                            disabled={!customerData.state || loadingCities}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD] disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                          >
                            <option value="">
                              {loadingCities ? "Loading cities..." : customerData.state ? "Select City" : "Select state first"}
                            </option>
                            {/* A saved city may not match the reference list (e.g. "Bengaluru"
                                vs "Bangalore"); keep it selectable instead of silently blanking it. */}
                            {customerData.city && !cities.includes(customerData.city) && (
                              <option value={customerData.city}>{customerData.city}</option>
                            )}
                            {cities.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-1">
                            Pincode *
                          </label>
                          <input
                            type="text"
                            id="pincode"
                            name="pincode"
                            value={customerData.pincode}
                            onChange={handleInputChange}
                            placeholder="6-digit pincode"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Step 2: Payment Method */}
              {currentStep === 2 && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h2 className="mb-5 flex items-center gap-2 font-heading text-[16px] font-bold text-[#0F2557]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1560BD] text-[11px] font-bold text-white">
                      3
                    </span>
                    Payment Method
                  </h2>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="online"
                          checked={paymentMethod === "online"}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium">Online Payment</div>
                          <div className="text-sm text-gray-600">Pay securely using UPI, Cards, or Net Banking</div>
                        </div>
                        <div className="text-2xl">💳</div>
                      </label>
                    </div>

                    <div className="border rounded-lg p-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="instore"
                          checked={paymentMethod === "instore"}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium">In-store Purchase</div>
                          <div className="text-sm text-gray-600">Verify with employee ID and email</div>
                        </div>
                        <div className="text-2xl">🏪</div>
                      </label>
                    </div>
                  </div>

                  {/* Payment Gateway Integration */}
                  {paymentMethod === "online" && (
                    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                      <PaymentGateway
                        paymentMethod={paymentMethod}
                        amount={payableTotal}
                        orderDetails={{
                          customer: customerData,
                          items: cart,
                          coupon: appliedCoupon ? { code: appliedCoupon.code } : null,
                          redeemPoints,
                          total: payableTotal,
                        }}
                        onSuccess={handlePaymentSuccess}
                        onCancel={() => {
                          if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Payment cancelled")
                          toast.error("Payment cancelled")
                        }}
                      />
                    </div>
                  )}

                  {/* In-store Purchase Verification */}
                  {paymentMethod === "instore" && (
                    <div className="mt-6">
                      <InStorePurchase
                        onVerified={(verifiedData) => {
                          handlePlaceOrder({
                            method: "instore",
                            status: "completed",
                            employeeId: verifiedData.employeeId,
                            verifiedEmail: verifiedData.email,
                          })
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Order Summary - Right side */}
            <div className="space-y-4 lg:sticky lg:top-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-[15px] font-bold text-[#0F2557]">
                    Order Summary ({cart.length} {cart.length === 1 ? "item" : "items"})
                  </h2>
                  <Link href="/cart" className="text-[12px] font-semibold text-[#1560BD] hover:underline">
                    Edit Cart
                  </Link>
                </div>

                {/* Cart Items */}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 py-3 border-b">
                      <img
                        src={item.image || "/placeholder.png"}
                        alt={cleanProductName(item.name)}
                        className="w-12 h-12 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cleanProductName(item.name)}</p>
                        <p className="text-xs text-gray-500 mb-1">Qty: {item.quantity}</p>
                        {item.type === 'software' && (
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <p className="flex items-center gap-1">
                              <span className="font-semibold">Max Devices:</span> {item.maxDevices || item.packSize || 'Unlimited'}
                            </p>
                            <p className="flex items-center gap-1">
                              <span className="font-semibold">Validity:</span> {item.validity || (item.validityYears ? `${item.validityYears} Year${item.validityYears > 1 ? 's' : ''}` : 'Lifetime')}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-sm font-semibold flex-shrink-0">₹{money(item.price * item.quantity)}</p>
                        <button
                          onClick={() => setItemToRemove({ id: item.id, name: cleanProductName(item.name) })}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${item.name}`}
                          title={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon input */}
                <div className="mb-4 p-3 border rounded-lg bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Have a Coupon Code?</label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        placeholder="Enter coupon code"
                        className="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                        disabled={applyingCoupon}
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={applyingCoupon || !couponCode.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {applyingCoupon && (
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {applyingCoupon ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="text-sm font-semibold text-green-900">{appliedCoupon.code}</div>
                            <div className="text-xs text-green-700">{appliedCoupon.name} • Saved ₹{couponDiscount.toLocaleString("en-IN")}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setAppliedCoupon(null)
                            setCouponDiscount(0)
                            setCouponCode("")
                            toast.success("Coupon removed")
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-green-700 mt-2">
                          <span>Coupon Discount</span>
                          <span>-₹{couponDiscount.toLocaleString("en-IN")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pricing Breakdown */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal (excl. GST)</span>
                    <span>₹{money(subtotal)}</span>
                  </div>
                  {softwareGST > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST (18% on software)</span>
                      <span>₹{money(softwareGST)}</span>
                    </div>
                  )}
                  {hardwareGST > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST (18% on hardware)</span>
                      <span>₹{money(hardwareGST)}</span>
                    </div>
                  )}
                  {shipping > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span>₹{money(shipping)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Coupon Discount</span>
                      <span>-₹{couponDiscount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-sm text-amber-700">
                      <span>Rewards ({redeemPoints.toLocaleString("en-IN")} points)</span>
                      <span>-₹{loyaltyDiscount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span>₹{money(payableTotal)}</span>
                  </div>
                </div>

                {user && (
                  <LoyaltyRedeemer
                    orderTotal={total}
                    points={redeemPoints}
                    onChange={(points, discount) => {
                      setRedeemPoints(points)
                      setLoyaltyDiscount(discount)
                    }}
                  />
                )}

                {/* Free Shipping Progress */}
                {hasHardware && shipping > 0 && (
                  <div className="mt-4 rounded-lg bg-[#F4F8FD] p-3">
                    <p className="text-[12px] text-[#1560BD]">
                      Add ₹{(freeShippingThreshold - (softwareTotal + hardwareTotal)).toLocaleString("en-IN")} more for free delivery!
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="flex items-center gap-2 font-heading text-[14px] font-bold text-[#0F2557]">
                  <Shield className="h-4 w-4 text-green-600" strokeWidth={2} />
                  100% Secure Payments
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                  Transactions are encrypted and processed through Razorpay. SARA never stores your card details.
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {["Razorpay", "UPI", "VISA", "Mastercard", "RuPay"].map((label) => (
                    <li
                      key={label}
                      className="rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-slate-600"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="font-heading text-[14px] font-bold text-[#0F2557]">Need Help?</p>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                  Call <span className="font-semibold text-[#0F2557]">{settingsData?.storePhone || "1800 123 7272"}</span>{" "}
                  (Toll Free) or reach our team from the contact page.
                </p>
                <Link
                  href="/contact"
                  className="mt-3 inline-block text-[12px] font-semibold text-[#1560BD] hover:underline"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            {currentStep > 1 && (
              <button
                onClick={handlePrevStep}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                disabled={isProcessing}
              >
                <ArrowLeft className="inline h-4 w-4 mr-2" />
                Back
              </button>
            )}
            {currentStep === 1 && (
              <button
                onClick={handleNextStep}
                className="ml-auto rounded-lg bg-[#FF6A2C] px-8 py-3 text-[14px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
                disabled={isProcessing}
              >
                Proceed to Payment
                <ArrowRight className="inline h-4 w-4 ml-2" />
              </button>
            )}
          </div>

          <TrustStrip />
        </div>
      </main>

      {itemToRemove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-item-title"
          onClick={() => setItemToRemove(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 id="remove-item-title" className="font-heading text-[16px] font-bold text-[#0F2557]">
                  Remove this item?
                </h2>
                <p className="mt-1 text-[13px] leading-snug text-slate-600">
                  <span className="font-medium text-[#0F2557]">{itemToRemove.name}</span> will be removed from your
                  order.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setItemToRemove(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Keep item
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  try {
                    removeFromCart(itemToRemove.id)
                    toast.success("Item removed from cart")
                  } catch (error) {
                    console.error("Failed to remove item from cart", error)
                    toast.error("Could not remove item")
                  } finally {
                    setItemToRemove(null)
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
