"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { analytics, toAnalyticsItem } from "@/lib/analytics"
import { useSettingsData } from "@/hooks/useSettingsData"
import { cleanProductName, shortProductTitle } from "@/utils/cleanProductName"
import PaymentGateway, { type CheckoutPaymentDetails } from "@/components/PaymentGateway"
import CheckoutPaymentOptions, { PaymentProviderLogo } from "@/components/CheckoutPaymentOptions"
import { PayAtStoreDialog, PayAtStoreStorePicker, type PayAtStoreChoice } from "@/components/PayAtStore"
import { useStoreStock } from "@/hooks/useStoreStock"
import { StorePaymentRequestResponseSchema, type StorePaymentPlatform, type StorePaymentRequestResponse } from "@/types/store-payment"
import FulfilmentSelector, {
  type FulfilmentMethod,
  type PickupStore,
} from "@/components/FulfilmentSelector"
import LoyaltyRedeemer from "@/components/LoyaltyRedeemer"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { cartLimitError } from "@/lib/cart-limits"
import { cartLineKey } from "@/lib/cart-line"
import { CHECKOUT_CART_INTENT } from "@/lib/checkout-cart"
import { EMPTY_CHECKOUT_CUSTOMER as EMPTY_CUSTOMER, readCheckoutDraft, saveCheckoutDraft, clearCheckoutDraft } from "@/lib/checkout-draft"
import { readCheckoutRecovery, clearCheckoutRecovery, PurchasedItemsSchema, readHostedCheckout, clearHostedCheckout, type CheckoutRecovery } from "@/lib/checkout-recovery"
import { prepareCheckoutAttempt, clearCheckoutAttempt, resolveCheckoutAttempt } from "@/lib/checkout-attempt"
import { useCartGifts, clearCartGiftChoices } from "@/hooks/useCartGifts"
import CartGifts from "@/components/cart/CartGifts"
import { GiftAwardSchema, giftSelectionSignature } from "@/lib/gift-validation"
import { apiFetch, apiFetchJson } from "@/lib/api-client"
import { CouponQuoteSchema } from "@/lib/coupon-validation"
import { z } from "zod"
import styles from "./checkout.module.css"
import CartProductImage from "@/components/CartProductImage"
import { CHECKOUT_CITIES, checkoutCity } from "@/lib/checkout-region"
import { indianStates } from "@/lib/indiaData"
import { isDeliveryRegionAllowed, isPincodeAllowed, type PincodeRestrictions } from "@/lib/pincode-policy"
import { SavedDeliveryAddressSchema, PincodeRestrictionsResponseSchema, GuestCheckoutCustomerSchema, CheckoutContactSchema, type SavedDeliveryAddress } from "@/lib/validation"
import OrderSuccess from "@/components/OrderSuccess"
import { OrderConfirmationSchema, type OrderConfirmation } from "@/lib/order-confirmation"
import { PaymentConfigurationSchema, HostedPaymentStatusSchema, PAYMENT_PROVIDER_LABELS, type PaymentProvider } from "@/types/payment-gateways"
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Truck,
  Shield,
  CheckCircle,
  User,
  MapPin,
  Phone,
  Mail,
  Trash2,
  Heart,
  Store, Home, Pencil, Headphones, Tag,
} from "lucide-react"
import { toast } from "react-hot-toast"

const CHECKOUT_TRACKER = ["Address", "Delivery", "Payment", "Review & Place Order"]
const accountProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullish(),
  address: z.object({
    street: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    zip: z.string().nullish(),
    country: z.string().nullish(),
  }).nullish(),
})

/** Deriving the ex-GST subtotal divides by 1.18, so raw toLocaleString leaks 3 decimals. */
const money = (value: number) =>
  Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CheckoutPage() {
  const { cart, completePurchase, removeFromCart, refreshItemPrices, isLoading: cartLoading,
    checkoutCartPending, previousCart, previousCartLoaded, checkoutCartError, resolvingCheckoutCart,
    prepareCheckoutSignIn, resolveCheckoutCart, abandonCheckoutCart, loadCartFromDatabase } = useCart()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const leaveCheckoutWithCart = async () => {
    if (resolvingCheckoutCart) return
    if (await abandonCheckoutCart()) router.push("/cart")
  }

  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)
  const [itemToRemove, setItemToRemove] = useState<{ id: string; name: string } | null>(null)
  const [movingWishlistId, setMovingWishlistId] = useState<string | null>(null)
  const wishlistMoveInProgress = useRef(false)
  const orderLock = useSubmitLock()
  const couponLock = useSubmitLock()
  const checkoutValidationLock = useSubmitLock()
  const storeRequestLock = useSubmitLock()
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [placedOrder, setPlacedOrder] = useState<OrderConfirmation | null>(null)
  const [paymentCompleted, setPaymentCompleted] = useState(false)
  const [paymentRecovery, setPaymentRecovery] = useState<CheckoutRecovery | null>(null)
  const [recoveringPayment, setRecoveringPayment] = useState(false)
  const recoveryLock = useSubmitLock()

  // Form data
  const [customerData, setCustomerData] = useState(EMPTY_CUSTOMER)
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({})
  const editedCustomerFields = useRef(new Set<string>())
  const accountId = user?.id
  const checkoutOwner = accountId || "guest"
  const checkoutOwnerRef = useRef(checkoutOwner)
  checkoutOwnerRef.current = checkoutOwner
  const restoredDraftOwner = useRef<string | null>(null)
  const [draftOwner, setDraftOwner] = useState<string | null>(null)
  const draftReady = !authLoading && draftOwner === checkoutOwner
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileAttempt, setProfileAttempt] = useState(0)
  const [editingAddress, setEditingAddress] = useState(true)
  const [addressNotice, setAddressNotice] = useState("")
  const [savedAddresses, setSavedAddresses] = useState<SavedDeliveryAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressType, setAddressType] = useState<SavedDeliveryAddress["type"]>("home")
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [addressesError, setAddressesError] = useState("")
  const [addressesAttempt, setAddressesAttempt] = useState(0)
  const [addressSaving, setAddressSaving] = useState(false)
  const addressMutation = useRef(false)
  const currentAccountId = useRef(accountId)
  currentAccountId.current = accountId
  const [catalogue, setCatalogue] = useState<Record<string, { price: number; mrp?: number | null; stock?: number }>>({})
  const [catalogueLoading, setCatalogueLoading] = useState(false)
  const [catalogueError, setCatalogueError] = useState("")
  const [catalogueAttempt, setCatalogueAttempt] = useState(0)
  const catalogueIds = JSON.stringify(cart.filter(item => item.type !== "software").map(item => item.id).sort())
  useEffect(() => {
    const ids: string[] = JSON.parse(catalogueIds)
    if (!ids.length) { setCatalogue({}); setCatalogueError(""); setCatalogueLoading(false); return }
    const controller = new AbortController()
    const load = async () => {
      setCatalogueLoading(true)
      setCatalogueError("")
      try {
        const response = await fetch("/api/products/bulk", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, compare: true }), signal: controller.signal })
        if (!response.ok) throw new Error("Product prices and stock could not be refreshed.")
        const parsed = z.array(z.object({ id: z.string(), price: z.number().finite(), mrp: z.number().finite().nullish(),
          stock: z.number().finite().optional() })).safeParse(await response.json())
        if (!parsed.success) throw new Error("Invalid product prices or stock received. Please retry.")
        const products = parsed.data
        if (controller.signal.aborted) return
        if (ids.some(id => !products.some(product => product.id === id && product.price > 0))) {
          throw new Error("Some products are no longer available. Update your cart before paying.")
        }
        setCatalogue(Object.fromEntries(products.map(product => [product.id, product])))
        refreshItemPrices(Object.fromEntries(products.map(product => [product.id, product.price])),
          Object.fromEntries(products.filter(product => product.stock !== undefined).map(product => [product.id, product.stock!])))
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Checkout] Catalogue refresh failed:", error)
        setCatalogueError(error instanceof Error ? error.message : "Product information is temporarily unavailable.")
      } finally {
        if (!controller.signal.aborted) setCatalogueLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [catalogueIds, catalogueAttempt, refreshItemPrices])

  const [paymentMethod, setPaymentMethod] = useState<"online" | "cash-on-delivery" | "instore" | "store-payment">("online")
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([])
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider | null>(null)
  const [storePaymentEnabled, setStorePaymentEnabled] = useState(false)
  const [payStore, setPayStore] = useState<PayAtStoreChoice | null>(null)
  const [storeRequest, setStoreRequest] = useState<StorePaymentRequestResponse | null>(null)
  const [storeRequestContext, setStoreRequestContext] = useState<string | null>(null)
  const [storeTransaction, setStoreTransaction] = useState<{ platform: StorePaymentPlatform | ""; transactionId: string }>({ platform: "", transactionId: "" })
  const [draftStorageError, setDraftStorageError] = useState(false)
  const [storeRequestLoading, setStoreRequestLoading] = useState(false)
  const [storeDialogOpen, setStoreDialogOpen] = useState(false)
  const [paymentConfigError, setPaymentConfigError] = useState("")
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true)
  const [pincodeRules, setPincodeRules] = useState<PincodeRestrictions | null>(null)
  const [pincodeRulesLoading, setPincodeRulesLoading] = useState(true)
  const [pincodeRulesError, setPincodeRulesError] = useState("")
  const [pincodeRulesAttempt, setPincodeRulesAttempt] = useState(0)
  const nationwideDelivery = pincodeRules?.mode === "all"
  const [hostedReturn, setHostedReturn] = useState<{ orderId: string; checkoutToken: string; storeOrderId: string;
    total: number; tax: number; shipping: number; guestAccessToken?: string;
    items?: z.infer<typeof PurchasedItemsSchema>; owner?: string } | null>(null)
  const [hostedStatus, setHostedStatus] = useState("")
  const [hostedRecoveryBlocked, setHostedRecoveryBlocked] = useState(false)
  const [hostedStatusAttempt, setHostedStatusAttempt] = useState(0)
  const hostedPurchaseReported = useRef(new Set<string>())

  useEffect(() => {
    const controller = new AbortController()
    setPincodeRulesLoading(true)
    setPincodeRulesError("")
    void (async () => {
      try {
        const response = await fetch("/api/blocked-pincodes", { cache: "no-store", signal: controller.signal })
        if (!response.ok) throw new Error("Delivery configuration could not be loaded")
        const rules = PincodeRestrictionsResponseSchema.parse(await response.json())
        if (!controller.signal.aborted) setPincodeRules(rules)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Checkout] Delivery configuration failed:", error)
        setPincodeRules(null)
        setPincodeRulesError("Delivery availability could not be loaded. Retry before choosing your delivery address.")
      } finally {
        if (!controller.signal.aborted) setPincodeRulesLoading(false)
      }
    })()
    return () => controller.abort()
  }, [pincodeRulesAttempt])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch("/api/payment/config", { cache: "no-store", signal: controller.signal })
        if (!response.ok) throw new Error("Payment gateway configuration could not be loaded.")
        const config = PaymentConfigurationSchema.parse(await response.json())
        if (controller.signal.aborted) return
        setPaymentProviders(config.providers)
        setPaymentProvider(previous => previous && config.providers.includes(previous) ? previous : config.defaultProvider)
        setStorePaymentEnabled(config.storePaymentEnabled)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Checkout] Gateway configuration failed:", error)
        setPaymentConfigError("Online payment gateways are unavailable. Refresh this page to retry.")
      } finally {
        if (!controller.signal.aborted) setPaymentConfigLoading(false)
      }
    })()
    try {
      const saved = readHostedCheckout()
      const returnedId = new URLSearchParams(window.location.search).get("paymentReturn")
      if (saved) {
        if (returnedId && returnedId !== saved.orderId) throw new Error("Payment return does not match this checkout")
        setHostedReturn(saved)
      } else if (returnedId) {
        setHostedRecoveryBlocked(true)
        setHostedStatus("Payment reference is missing in this browser. Contact support before paying again.")
      }
    } catch (error) {
      console.error("[Checkout] Payment recovery failed:", error)
      setHostedRecoveryBlocked(true)
      setHostedStatus("Payment recovery is unavailable. Contact support before paying again.")
    }
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!hostedReturn || authLoading) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0
    const check = async () => {
      setPaymentPending(true)
      setHostedStatus("Confirming your previous payment. Do not pay again.")
      try {
        const response = await fetch("/api/payment/status", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: hostedReturn.orderId, checkoutToken: hostedReturn.checkoutToken }),
          signal: controller.signal,
        })
        const json: unknown = await response.json()
        if (!response.ok) throw new Error("Payment confirmation is unavailable. Retry before paying again.")
        const data = HostedPaymentStatusSchema.parse(json)
        if (data.status === "completed") {
          if (checkoutOwnerRef.current !== checkoutOwner || (hostedReturn.owner && hostedReturn.owner !== checkoutOwner)) {
            throw new Error("Return to the account that started this payment before recovering it.")
          }
          clearHostedCheckout()
          clearCheckoutAttempt(checkoutOwner)
          clearCartGiftChoices(checkoutOwner)
          clearCheckoutDraft(checkoutOwner)
          setOrderId(data.orderId)
          setOrderPlaced(true)
          setHostedReturn(null)
          if (!hostedPurchaseReported.current.has(data.orderId)) {
            hostedPurchaseReported.current.add(data.orderId)
            try {
              analytics.purchase({
                transactionId: data.orderId, value: hostedReturn.total, tax: hostedReturn.tax,
                shipping: hostedReturn.shipping, items: cart.map(item => toAnalyticsItem(item)),
              })
            } catch (error) {
              console.error("[Checkout] Hosted purchase analytics failed:", error)
            }
          }
          if (hostedReturn.items) await completePurchase(hostedReturn.items, data.orderId)
          router.replace(`/thank-you?orderId=${encodeURIComponent(data.orderId)}${hostedReturn.guestAccessToken
            ? `&token=${encodeURIComponent(hostedReturn.guestAccessToken)}` : ""}`)
          return
        }
        if (data.status === "failed") {
          clearHostedCheckout()
          clearCheckoutAttempt(checkoutOwner)
          setHostedReturn(null)
          setHostedStatus("The gateway confirmed that payment failed. You can retry; your cart has been kept.")
          setPaymentPending(false)
          router.replace("/checkout")
          return
        }
        setHostedStatus(data.status === "review"
          ? `Payment received for ${data.orderId}. Contact support for order reconciliation; do not pay again.`
          : `Payment is still pending for ${data.orderId}. Do not pay again until its status is confirmed.`)
        if (data.status === "pending" && ++checks < 12) timer = setTimeout(() => void check(), 5000)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Checkout] Payment confirmation failed:", error)
        setHostedStatus(error instanceof Error ? error.message : "Payment could not be confirmed. Contact support before paying again.")
      }
    }
    void check()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [hostedReturn, authLoading, hostedStatusAttempt, completePurchase, router, cart, checkoutOwner])

  // Click & Pick: home delivery or collection from a SARA store.
  const [fulfilmentMethod, setFulfilmentMethod] = useState<FulfilmentMethod>("delivery")
  const [pickupStore, setPickupStore] = useState<PickupStore | null>(null)
  const isPickup = fulfilmentMethod === "pickup"
  const storeStock = useStoreStock(cart)
  const [deliveryFallbackStoreId, setDeliveryFallbackStoreId] = useState<string | null>(null)
  const fulfilmentStoreId = isPickup ? pickupStore?.id : deliveryFallbackStoreId || undefined
  const pickupUnavailable = Boolean(pickupStore && storeStock.storeIds && !storeStock.storeIds.has(pickupStore.id))
  const freeDeliveryFallback = Boolean(storeStock.deliveryAvailable && storeStock.storeIds && (
    storeStock.storeIds.size === 0 || pickupUnavailable || (deliveryFallbackStoreId && !storeStock.storeIds.has(deliveryFallbackStoreId))
  ))
  const allowStorePayment = isPickup && storePaymentEnabled && Boolean(pickupStore && storeStock.storeIds?.has(pickupStore.id)) && !storeStock.error
  const changeFulfilmentMethod = (method: FulfilmentMethod) => {
    if (method === "pickup") setDeliveryFallbackStoreId(null)
    else if (pickupUnavailable && pickupStore) setDeliveryFallbackStoreId(pickupStore.id)
    if (method === "delivery") {
      setPaymentMethod("online")
      setPayStore(null)
      setStoreDialogOpen(false)
    }
    setFulfilmentMethod(method)
  }
  useEffect(() => {
    if (paymentMethod === "cash-on-delivery" || paymentMethod === "instore" ||
      (paymentMethod === "store-payment" && draftReady && (!isPickup || (!allowStorePayment && !storeStock.loading && Boolean(storeStock.storeIds))))) {
      setPaymentMethod("online")
      setPayStore(null)
    }
  }, [paymentMethod, isPickup, allowStorePayment, storeStock.loading, storeStock.storeIds, draftReady])
  useEffect(() => {
    if (draftReady && !paymentConfigLoading && !paymentConfigError && (!paymentProvider || !paymentProviders.includes(paymentProvider))) {
      setPaymentProvider(paymentProviders[0] || null)
    }
  }, [draftReady, paymentConfigLoading, paymentConfigError, paymentProvider, paymentProviders])
  useEffect(() => {
    if (deliveryFallbackStoreId && storeStock.storeIds && !storeStock.loading && !storeStock.byStore[deliveryFallbackStoreId]) {
      setDeliveryFallbackStoreId(null)
    }
  }, [deliveryFallbackStoreId, storeStock.storeIds, storeStock.loading, storeStock.byStore])

  // Guest checkout: the shopper explicitly opts out of signing in.
  const [continueAsGuest, setContinueAsGuest] = useState(false)
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null)

  // Rewards points proposed for redemption; the server decides the real value.
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0)

  // Shipping settings from database
  const [shippingFee, setShippingFee] = useState(99)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(1000)
  const { data: settingsData, error: settingsError, isLoading: isLoadingSettings } = useSettingsData()

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
  const restoredCoupon = useRef<{ code: string; name: string } | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  useEffect(() => {
    if (authLoading || restoredDraftOwner.current === checkoutOwner) return
    let draft = readCheckoutDraft(checkoutOwner)
    // Carry the guest form through checkout's explicit sign-in handoff.
    if (accountId) {
      try {
        if (sessionStorage.getItem(CHECKOUT_CART_INTENT)) draft = readCheckoutDraft("guest") || draft
      } catch { /* Account autofill still works without browser storage. */ }
    }
    editedCustomerFields.current.clear()
    if (draft) {
      for (const field of Object.keys(EMPTY_CUSTOMER) as Array<keyof typeof EMPTY_CUSTOMER>) {
        if (draft.editedFields.includes(field) || draft.customer[field] !== EMPTY_CUSTOMER[field]) {
          editedCustomerFields.current.add(field)
        }
      }
    }
    setCustomerData(draft?.customer || EMPTY_CUSTOMER)
    setCustomerErrors({})
    setContinueAsGuest(draft?.continueAsGuest || false)
    setEditingAddress(draft?.editingAddress ?? true)
    setAddressType(draft?.addressType || "home")
    setSelectedAddressId(draft?.selectedAddressId || null)
    setCouponCode(draft?.couponCode || "")
    restoredCoupon.current = draft?.appliedCoupon || null
    setFulfilmentMethod(draft?.fulfilmentMethod || "delivery")
    setPickupStore(draft?.pickupStore || null)
    setDeliveryFallbackStoreId(draft?.deliveryFallbackStoreId || null)
    setPaymentMethod(draft?.paymentMethod || "online")
    if (draft?.paymentProvider) setPaymentProvider(draft.paymentProvider)
    setRedeemPoints(accountId ? draft?.redeemPoints || 0 : 0)
    setStoreRequest(draft?.storeRequest || null)
    setStoreRequestContext(draft?.storeRequestContext || null)
    setStoreTransaction(draft?.storeTransaction || { platform: "", transactionId: "" })
    setPaymentRecovery(readCheckoutRecovery(checkoutOwner))
    restoredDraftOwner.current = checkoutOwner
    setDraftOwner(checkoutOwner)
  }, [authLoading, accountId, checkoutOwner])

  useEffect(() => {
    // Never replace a saved draft with the initial empty render, or copy an
    // old account's form into a new account during authentication hydration.
    if (!draftReady || restoredDraftOwner.current !== checkoutOwner) return
    if (orderPlaced) { clearCheckoutDraft(checkoutOwner); return }
    const saved = saveCheckoutDraft(checkoutOwner, {
      version: 1, customer: customerData, continueAsGuest, editingAddress,
      addressType, selectedAddressId, couponCode, editedFields: [...editedCustomerFields.current],
      fulfilmentMethod, pickupStore, deliveryFallbackStoreId, paymentMethod: paymentMethod === "store-payment" ? "store-payment" : "online",
      paymentProvider, redeemPoints, storeRequest, storeRequestContext, storeTransaction, appliedCoupon,
    })
    setDraftStorageError(!saved)
  }, [draftReady, checkoutOwner, customerData, continueAsGuest, editingAddress,
    addressType, selectedAddressId, couponCode, orderPlaced, fulfilmentMethod, pickupStore, deliveryFallbackStoreId,
    paymentMethod, paymentProvider, redeemPoints, storeRequest, storeRequestContext, storeTransaction, appliedCoupon])
  const couponContext = JSON.stringify([user?.id ?? null, cart.map(item => [cartLineKey(item), item.quantity, item.price])])
  const cartGifts = useCartGifts(cart, checkoutOwner, { method: fulfilmentMethod, storeId: fulfilmentStoreId })
  const quoteContext = JSON.stringify([couponContext, appliedCoupon?.code, redeemPoints, fulfilmentMethod, fulfilmentStoreId, freeDeliveryFallback,
    cartGifts.declinedGiftPromotions, cartGifts.gifts.map(gift => [gift.promotionId, gift.giftId, gift.quantity])])
  const currentQuoteContext = useRef(quoteContext)
  currentQuoteContext.current = quoteContext
  const [verifiedQuote, setVerifiedQuote] = useState<{ context: string; subtotal: number; tax: number;
    shipping: number; total: number; amount: number } | null>(null)
  const currentQuote = verifiedQuote?.context === quoteContext ? verifiedQuote : null
  const couponContextRef = useRef(couponContext)
  useEffect(() => {
    if (couponContextRef.current === couponContext) return
    couponContextRef.current = couponContext
    setAppliedCoupon(null)
    setCouponDiscount(0)
  }, [couponContext])

  useEffect(() => {
    if (!draftReady || cartLoading || !restoredCoupon.current) return
    setAppliedCoupon(restoredCoupon.current)
    restoredCoupon.current = null
    // Only the selection survives refresh; the server recalculates its value.
    setCouponDiscount(0)
  }, [draftReady, cartLoading, couponContext])

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
  const subtotal = currentQuote?.subtotal ?? softwareBaseTotal + hardwareBaseTotal

  // Gross totals (base + GST)
  const softwareTotal = softwareBaseTotal + softwareGST
  const hardwareTotal = hardwareBaseTotal + hardwareGST

  // Total tax (software + hardware)
  const tax = currentQuote?.tax ?? softwareGST + hardwareGST

  // Only apply shipping if there are hardware items in the cart
  const hasHardware = cart.some(item => item.type !== 'software')
  let shipping = 0
  if (hasHardware && !isLoadingSettings && !isPickup) {
    const hardwareGrossSubtotal = hardwareGross
    shipping = (hardwareGrossSubtotal > 0 && hardwareGrossSubtotal < freeShippingThreshold) ? shippingFee : 0
  }
  if (!isPickup && freeDeliveryFallback) shipping = 0
  if (currentQuote) shipping = currentQuote.shipping

  // Apply coupon discount (if any) on gross amounts (softwareTotal + hardwareTotal)
  const preCouponTotal = softwareTotal + hardwareTotal
  const discountedTotal = Math.max(0, preCouponTotal - couponDiscount)

  // Calculate final total (after coupon and adding shipping)
  const total = currentQuote?.total ?? discountedTotal + shipping

  // Indicative only — /api/orders recomputes and debits the points.
  const payableTotal = currentQuote?.amount ?? Math.round(Math.max(0, total - loyaltyDiscount) * 100) / 100
  const productDiscount = cart.reduce((sum, item) => sum + Math.max(0, (catalogue[item.id]?.mrp || item.price) - item.price) * item.quantity, 0)
  const totalMrp = preCouponTotal + productDiscount
  const unavailableItem = cart.find(item => {
    const quantity = cart.filter(line => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0)
    return ((!isPickup || item.type === "software") && typeof item.stock === "number" && item.stock < quantity)
      || (typeof item.maxPurchaseQuantity === "number" && item.maxPurchaseQuantity < quantity)
  })
  const cartError = cartLimitError(cart) || (unavailableItem
    ? `${unavailableItem.name} is unavailable in the requested quantity. Reduce its quantity or remove it before placing an order.`
    : null)


  useEffect(() => {
    if (!draftReady) return
    setProfileError("")
    setAddressNotice("")
    if (!accountId) {
      setProfileLoading(false)
      return
    }
    if (pincodeRulesLoading) return

    const controller = new AbortController()
    const loadProfile = async () => {
      setProfileLoading(true)
      try {
        const response = await apiFetch(`/api/users/${encodeURIComponent(accountId)}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Your saved account details could not be loaded.")
        const result = accountProfileSchema.safeParse(await response.json())
        if (!result.success || result.data.id !== accountId) throw new Error("Invalid account details received.")
        if (controller.signal.aborted) return
        const profile = result.data
        const city = checkoutCity(profile.address?.city || "") || (nationwideDelivery ? profile.address?.city?.trim() || "" : "")
        const supportedAddress = nationwideDelivery || !profile.address?.state || profile.address.state.trim().toLowerCase() === "karnataka"
        if (profile.address?.street && (!supportedAddress || !city) && editedCustomerFields.current.size === 0) {
          setAddressNotice("Your saved address is outside our current delivery area. Please enter an address in Bangalore or Mysore, Karnataka, or choose store pickup.")
        }
        const [firstName = "", ...lastName] = profile.name.trim().split(/\s+/)
        const savedDetails = {
          firstName, lastName: lastName.join(" "), email: profile.email, phone: profile.phone || "",
          address: supportedAddress && city ? profile.address?.street || "" : "", city,
          state: nationwideDelivery ? profile.address?.state || "Karnataka" : "Karnataka",
          pincode: supportedAddress && city ? profile.address?.zip || "" : "",
          country: "India",
        }
        setCustomerData((previous) => ({
          ...previous,
          ...Object.fromEntries(Object.entries(savedDetails).filter(([field]) => !editedCustomerFields.current.has(field))),
        }))
        if (supportedAddress && city && profile.address?.street && profile.address?.zip &&
          editedCustomerFields.current.size === 0) setEditingAddress(false)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Checkout] Account autofill failed:", error)
        setProfileError("Your saved account details could not be loaded. Retry or enter your details below.")
      } finally {
        if (!controller.signal.aborted) setProfileLoading(false)
      }
    }
    void loadProfile()
    return () => controller.abort()
  }, [draftReady, accountId, profileAttempt, pincodeRulesLoading, nationwideDelivery])

  useEffect(() => {
    if (!draftReady) return
    setSavedAddresses([])
    setAddressesError("")
    setAddressSaving(false)
    addressMutation.current = false
    if (!accountId) { setAddressesLoading(false); return }
    const controller = new AbortController()
    const loadAddresses = async () => {
      setAddressesLoading(true)
      try {
        const response = await apiFetch("/api/account/addresses", { signal: controller.signal })
        if (!response.ok) throw new Error("Your saved delivery addresses could not be loaded.")
        const result = z.object({ addresses: z.array(SavedDeliveryAddressSchema.extend({ id: z.string() })) })
          .safeParse(await response.json())
        if (!result.success) throw new Error("Invalid saved addresses received.")
        if (controller.signal.aborted) return
        setSavedAddresses(result.data.addresses)
        setSelectedAddressId(selected => selected && result.data.addresses.some(address => address.id === selected)
          ? selected : null)
        if (result.data.addresses[0] && editedCustomerFields.current.size === 0) {
          selectAddress(result.data.addresses[0])
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Checkout] Saved addresses failed:", error)
        setAddressesError("Saved delivery addresses could not be loaded. Retry or enter an address below.")
      } finally {
        if (!controller.signal.aborted) setAddressesLoading(false)
      }
    }
    void loadAddresses()
    return () => controller.abort()
  }, [draftReady, accountId, addressesAttempt])

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
    if (authLoading || !draftReady || cartLoading || orderPlaced || paymentRecovery || hostedReturn || hostedRecoveryBlocked || cart.length > 0) return

    const timer = setTimeout(() => {
      toast.error("Your cart is empty")
      router.push("/cart")
    }, 1500)

    return () => clearTimeout(timer)
  }, [authLoading, draftReady, cartLoading, cart.length, orderPlaced, paymentRecovery, hostedReturn, hostedRecoveryBlocked, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    editedCustomerFields.current.add(name)
    if (name === "state") editedCustomerFields.current.add("city")
    setCustomerData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (name === "firstName" || name === "lastName" || name === "email" || name === "phone") {
      const parsed = CheckoutContactSchema.shape[name].safeParse(value)
      setCustomerErrors(previous => {
        const next = { ...previous }
        if (parsed.success) delete next[name]
        else next[name] = parsed.error.issues[0].message
        return next
      })
    }
  }
  const validateContactField = (field: "firstName" | "lastName" | "email" | "phone") => {
    const parsed = CheckoutContactSchema.shape[field].safeParse(customerData[field])
    if (parsed.success) setCustomerData(previous => ({ ...previous, [field]: parsed.data }))
    setCustomerErrors(previous => {
      const next = { ...previous }
      if (parsed.success) delete next[field]
      else next[field] = parsed.error.issues[0].message
      return next
    })
  }
  const validateContactDetails = () => {
    const parsed = CheckoutContactSchema.safeParse(customerData)
    if (parsed.success) {
      setCustomerErrors({})
      setCustomerData(previous => ({ ...previous, ...parsed.data }))
      return true
    }
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      if (!errors[field]) errors[field] = issue.message
    }
    setCustomerErrors(errors)
    setEditingAddress(true)
    requestAnimationFrame(() => document.getElementById(String(parsed.error.issues[0].path[0]))?.focus())
    toast.error(parsed.error.issues[0].message)
    return false
  }
  const startNewAddress = () => {
    for (const field of ["address", "city", "pincode"]) editedCustomerFields.current.add(field)
    setCustomerData(previous => ({ ...previous, address: "", city: "", pincode: "", state: "Karnataka" }))
    setEditingAddress(true)
    setAddressNotice("")
    setSelectedAddressId(null)
    setAddressType("home")
  }

  const selectAddress = (address: SavedDeliveryAddress) => {
    setCustomerErrors({})
    const { id, type, ...details } = address
    for (const field of Object.keys(details)) editedCustomerFields.current.add(field)
    setCustomerData(previous => ({ ...previous, ...details }))
    setSelectedAddressId(id)
    setAddressType(type)
    setEditingAddress(false)
    setAddressNotice("")
  }

  const useEnteredAddress = () => {
    if (!validateContactDetails()) return
    const result = SavedDeliveryAddressSchema.safeParse({ ...customerData, type: addressType })
    if (!result.success) { toast.error(result.error.issues[0].message); return }
    setCustomerData(previous => ({ ...previous, ...result.data }))
    setSelectedAddressId(null)
    setEditingAddress(false)
  }

  const saveAddress = async () => {
    if (!accountId || addressMutation.current) return
    if (!validateContactDetails()) return
    const result = SavedDeliveryAddressSchema.safeParse({ ...customerData, type: addressType })
    if (!result.success) { toast.error(result.error.issues[0].message); return }
    const owner = accountId
    addressMutation.current = true
    setAddressSaving(true)
    try {
      const response = await apiFetch(selectedAddressId ? `/api/account/addresses/${encodeURIComponent(selectedAddressId)}` : "/api/account/addresses", {
        method: selectedAddressId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      })
      const data: unknown = await response.json()
      if (!response.ok) {
        const error = z.object({ error: z.string() }).safeParse(data)
        throw new Error(error.success ? error.data.error : "Address could not be saved.")
      }
      const saved = z.object({ address: SavedDeliveryAddressSchema.extend({ id: z.string() }) }).parse(data).address
      if (currentAccountId.current !== owner) return
      setSavedAddresses(previous => [saved, ...previous.filter(address => address.id !== saved.id)])
      selectAddress(saved)
      toast.success("Delivery address saved to your account")
    } catch (error) {
      if (currentAccountId.current !== owner) return
      console.error("[Checkout] Address save failed:", error)
      toast.error(error instanceof Error ? error.message : "Address could not be saved.")
    } finally {
      if (currentAccountId.current === owner) {
        addressMutation.current = false
        setAddressSaving(false)
      }
    }
  }

  const removeAddress = async (id: string) => {
    if (!accountId || addressMutation.current) return
    const owner = accountId
    addressMutation.current = true
    setAddressSaving(true)
    try {
      const response = await apiFetch(`/api/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Address could not be removed. Please retry.")
      if (currentAccountId.current !== owner) return
      setSavedAddresses(previous => previous.filter(address => address.id !== id))
      if (selectedAddressId === id) {
        setSelectedAddressId(null)
        setEditingAddress(true)
      }
      toast.success("Saved address removed")
    } catch (error) {
      if (currentAccountId.current !== owner) return
      console.error("[Checkout] Address removal failed:", error)
      toast.error(error instanceof Error ? error.message : "Address could not be removed.")
    } finally {
      if (currentAccountId.current === owner) {
        addressMutation.current = false
        setAddressSaving(false)
      }
    }
  }

  const moveItemToWishlist = async (lineKey: string) => {
    if (wishlistMoveInProgress.current || checkoutCartPending || paymentPending || hostedReturn
      || hostedRecoveryBlocked || isProcessing || storeRequestLoading) return
    if (!user) {
      toast.error("Sign in to move items to your wishlist. Your item is still in the cart.")
      return
    }
    const owner = user.id
    const item = cart.find(item => cartLineKey(item) === lineKey)
    if (!item) return
    const productId = item.id
    wishlistMoveInProgress.current = true
    setMovingWishlistId(lineKey)
    try {
      const response = await apiFetch("/api/wishlist", {
        method: "POST", json: { productId },
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || "Could not save this item to your wishlist.")
      if (currentAccountId.current !== owner) return
      // An already-wishlisted item is also safely saved for later.
      removeFromCart(lineKey)
      window.dispatchEvent(new Event("wishlist-updated"))
      toast.success("Item moved to wishlist")
    } catch (error) {
      if (currentAccountId.current !== owner) return
      toast.error(error instanceof Error ? error.message : "Could not move this item to your wishlist.")
    } finally {
      wishlistMoveInProgress.current = false
      setMovingWishlistId(null)
    }
  }

  const validateStep1 = async () => {
    if (wishlistMoveInProgress.current) {
      toast.error("Please wait for your item to move to the wishlist.")
      return false
    }
    if (checkoutCartPending) {
      toast.error("Choose whether to include your saved cart items or move them to your wishlist first.")
      return false
    }
    // Guests may complete checkout; identity for a guest order comes from the
    // validated email and phone below, never from the client.
    if (!user && !continueAsGuest) {
      toast.error("Choose to sign in or continue as a guest")
      return false
    }
    if (!validateContactDetails()) return false

    if (!user) {
      const guestDetails = GuestCheckoutCustomerSchema.safeParse({ ...customerData, zipCode: customerData.pincode })
      if (!guestDetails.success) {
        setEditingAddress(true)
        toast.error(guestDetails.error.issues[0].message)
        return false
      }
    }
    const required = isPickup && user
      ? ["firstName", "email", "phone"]
      : ["firstName", "email", "phone", "address", "city", "state", "pincode"]
    for (const field of required) {
      if (!customerData[field as keyof typeof customerData].trim()) {
        setEditingAddress(true)
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
      const res = await fetch("/api/blocked-pincodes", { cache: "no-store" })
      if (!res.ok) throw new Error("Delivery verification failed")
      const data = PincodeRestrictionsResponseSchema.parse(await res.json())
      if (!isDeliveryRegionAllowed(data.mode, customerData.city, customerData.state)) {
        toast.error("Delivery is currently available only in Bangalore and Mysore, Karnataka.")
        return false
      }
      if (!isPincodeAllowed(data, customerData.pincode)) {
        toast.error("Sorry, we do not deliver to this pincode.")
        return false
      }
    } catch (e) {
      toast.error("Could not verify pincode delivery. Please try again.")
      return false
    }

    return true
  }

  const validateCheckout = async () => {
    if (!checkoutValidationLock.acquire()) return false
    try {
    if (addressesLoading || profileLoading || addressMutation.current) {
      toast.error("Please wait for your account addresses to finish loading or saving.")
      return false
    }
    if (cartError) { toast.error(cartError); return false }
    if (cart.length === 0) { toast.error("Your cart is empty"); return false }
    if (catalogueLoading || catalogueError) {
      toast.error(catalogueError || "Product prices and stock are still loading. Please try again.")
      return false
    }
    if (applyingCoupon) { toast.error("Please wait for your coupon to be checked."); return false }
    if (cartGifts.loading || cartGifts.error) { toast.error(cartGifts.error || "Please wait for free gifts to be checked."); return false }
    if (storeStock.error || !storeStock.storeIds) {
      toast.error(storeStock.error || "Please wait for store stock to be checked."); return false
    }
    if (!isPickup && !storeStock.deliveryAvailable) {
      toast.error(storeStock.availabilityError || "Your requested quantities are unavailable for home delivery."); return false
    }
    if (isPickup && (!pickupStore || !storeStock.storeIds?.has(pickupStore.id))) {
      toast.error(storeStock.deliveryAvailable ? "The requested quantity is unavailable at this store. Choose free home delivery or another store."
        : "The requested quantity is unavailable at this store."); return false
    }
    if (hasHardware && !isPickup && (isLoadingSettings || settingsError || !settingsData)) {
      toast.error("Delivery charges could not be confirmed. Please refresh and try again.")
      return false
    }
    if (!await validateStep1()) return false
    const response = await apiFetch("/api/cart/validate", {
      method: "POST", json: { items: cart, couponCode: appliedCoupon?.code || null, redeemPoints,
        declinedGiftPromotions: cartGifts.declinedGiftPromotions,
        fulfilment: { method: fulfilmentMethod, storeId: fulfilmentStoreId } },
      signal: AbortSignal.timeout(15000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) { toast.error(data?.error || "Product stock and prices could not be validated."); return false }
    const result = z.object({ success: z.literal(true), amount: z.number().finite().nonnegative(),
      pricing: z.object({ subtotal: z.number().finite(), tax: z.number().finite(), shipping: z.number().finite(),
        total: z.number().finite(), couponDiscount: z.number().finite(),
        items: z.array(z.object({ id: z.string(), price: z.number().finite().positive() })),
        gifts: z.array(GiftAwardSchema).default([]),
      }),
    }).safeParse(data)
    if (!result.success) { toast.error("Product validation could not be completed. Please retry."); return false }
    if (couponContextRef.current !== couponContext || currentQuoteContext.current !== quoteContext) {
      toast.error("Your checkout changed. Please review it and retry."); return false
    }
    const quote = result.data
    if (giftSelectionSignature(quote.pricing.gifts) !== giftSelectionSignature(cartGifts.gifts)) {
      cartGifts.retry(); toast.error("Your free gifts changed. Review the updated gifts before paying."); return false
    }
    setVerifiedQuote({ context: quoteContext, ...quote.pricing, amount: quote.amount })
    const changedPrices = quote.pricing.items.some(item => cart.some(current => current.id === item.id &&
      current.price !== item.price))
    refreshItemPrices(Object.fromEntries(quote.pricing.items.map(item => [item.id, item.price])))
    setCouponDiscount(quote.pricing.couponDiscount)
    if (changedPrices || Math.round(quote.amount * 100) !== Math.round(payableTotal * 100)) {
      toast.error("Prices or checkout charges changed. Review the updated total and retry.")
      return false
    }
    analytics.beginCheckout(cart.map((i) => toAnalyticsItem(i)))
    return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout validation failed. Please retry.")
      return false
    } finally { checkoutValidationLock.release() }
  }

  // Apply coupon handler
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    if (!couponLock.acquire()) return
    setApplyingCoupon(true)
    try {
      const payload = {
        code: couponCode.trim(),
        cart: cart.map(i => ({ ...i })),
        fulfilment: { method: fulfilmentMethod, storeId: fulfilmentStoreId },
      }
      const data = await apiFetchJson("/api/coupons/validate", {
        method: "POST",
        json: payload,
        signal: AbortSignal.timeout(12_000),
      }, value => CouponQuoteSchema.parse(value))
      if (couponContextRef.current !== couponContext) throw new Error("Your cart changed. Apply the coupon again.")
      setAppliedCoupon({ code: data.code, name: data.name })
      setCouponDiscount(data.discount)
      toast.success(`Applied ${data.code}`)
    } catch (e) {
      setAppliedCoupon(null)
      setCouponDiscount(0)
      console.error("ByteWise Testing Point apply coupon error:", e)
      toast.error(e instanceof Error ? e.message : "Failed to apply coupon")
    } finally {
      couponLock.release()
      setApplyingCoupon(false)
    }
  }

  const buildOrderData = (paymentDetails?: CheckoutPaymentDetails) => {
      return {
        userId: user?.id,
        declinedGiftPromotions: cartGifts.declinedGiftPromotions,
        expectedGifts: cartGifts.gifts.map(({ promotionId, giftId, sku, quantity }) => ({ promotionId, giftId, sku, quantity })),
        items: cart.map((item) => ({
          id: item.id,
          sku: item.sku, variantId: item.variantId, ram: item.ram, storage: item.storage,
          color: item.color, size: item.size,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          type: item.type,
          // Preserve integration metadata (KGen / exlr8)
          provider: item.provider || null,
          source: item.source || null,
          kgenProductId: item.kgenProductId || null,
          kgenVariantId: item.kgenVariantId || null,
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
          state: isPickup ? pickupStore?.state || "Karnataka" : customerData.state,
          zip: isPickup ? pickupStore?.pincode || "" : customerData.pincode,
          country: customerData.country,
        },
        fulfilment: {
          method: fulfilmentMethod,
          ...(fulfilmentStoreId ? { storeId: fulfilmentStoreId } : {}),
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
            verifiedAt: new Date().toISOString(),
            approvalId: paymentDetails?.approvalId,
            approvalToken: paymentDetails?.approvalToken,
          }),
          ...(paymentMethod === "store-payment" && {
            requestId: paymentDetails?.requestId,
            requestToken: paymentDetails?.requestToken,
            platform: paymentDetails?.platform,
            transactionId: paymentDetails?.transactionId,
          }),
          ...(paymentMethod === "online" && {
            paymentId: paymentDetails?.paymentId,
            orderId: paymentDetails?.orderId,
            transactionId: paymentDetails?.transactionId,
            checkoutToken: paymentDetails?.checkoutToken,
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
  }

  const handlePlaceOrder = async (paymentDetails?: CheckoutPaymentDetails, savedOrderData?: Record<string, unknown>) => {
    if (!savedOrderData && cartError) { toast.error(cartError); return false }
    if (!orderLock.acquire()) return false
    setIsProcessing(true)
    try {
      const orderData: Record<string, unknown> = savedOrderData ? { ...savedOrderData, paymentMethod: paymentDetails?.method, paymentDetails } : buildOrderData(paymentDetails)


      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      })

      const result = await response.json()

      if (result.success) {
        if (checkoutOwnerRef.current !== checkoutOwner) throw new Error("Return to the account that started this checkout to recover its order.")
        const newOrderId = result.orderId
        if (typeof newOrderId !== "string" || !newOrderId) throw new Error("Order created but its reference is unavailable. Please contact support before paying again.")
        const confirmation = OrderConfirmationSchema.safeParse(result.order)
        if (confirmation.success) setPlacedOrder(confirmation.data)
        else console.error("[Checkout] Created order returned incomplete confirmation details:", confirmation.error)
        setOrderId(newOrderId)

        // Keep the guest access link available if navigation is interrupted.
        const token: string | null = result.guestAccessToken || null
        if (token) {
          setGuestAccessToken(token)
          try {
            localStorage.setItem(`guest_order_${newOrderId}`, token)
          } catch {
            // Private browsing / quota — the link on this screen still works.
          }
        }

        try { analytics.purchase({
          transactionId: newOrderId,
          value: total,
          tax,
          shipping,
          coupon: appliedCoupon?.code ?? null,
          items: cart.map((i) => toAnalyticsItem(i)),
        }) } catch { /* Analytics must never interrupt a completed purchase. */ }

        toast.success('Order placed successfully!')

        const purchased = PurchasedItemsSchema.safeParse(orderData.items)
        if (purchased.success) await completePurchase(purchased.data, newOrderId)
        clearCheckoutDraft(checkoutOwner)
        clearCheckoutRecovery(checkoutOwner)
        clearCartGiftChoices(checkoutOwner)
        clearCheckoutAttempt(checkoutOwner)
        setPaymentRecovery(null)
        setOrderPlaced(true)
        router.replace(`/thank-you?orderId=${encodeURIComponent(newOrderId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`)
        return true
      } else {
        if (paymentDetails?.method === "store-payment" && response.status === 409 && /request/i.test(String(result.error))) {
          // The cart, coupon or store changed since the store was messaged; a fresh request is needed.
          setStoreRequest(null)
          setStoreDialogOpen(false)
        }
        throw new Error(result.error || "Failed to place order")
      }
    } catch (error) {
      console.error("ByteWise Testing Point Error placing order:", error)
      toast.error(error instanceof Error ? error.message : "Failed to place order. Please try again.")
      return false
    } finally {
      orderLock.release()
      setIsProcessing(false)
    }
  }

  const handlePaymentSuccess = async (paymentDetails: CheckoutPaymentDetails, savedOrderData?: Record<string, unknown>) => {
    if (checkoutOwnerRef.current !== checkoutOwner) throw new Error("Return to the account that started this payment; its recovery details are saved.")
    // Directly place order on payment success without showing confirmation
    const recovery = readCheckoutRecovery(checkoutOwner)
    const saved = await handlePlaceOrder(paymentDetails, recovery?.orderData || savedOrderData)
    if (!saved) throw new Error("Payment received. Recover this checkout before paying again.")
  }

  const recoverPayment = async () => {
    if (!paymentRecovery || !recoveryLock.acquire()) return
    setRecoveringPayment(true)
    try {
      const response = await apiFetch("/api/payment/verify", { method: "POST", json: paymentRecovery.receipt })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Payment confirmation is unavailable. Keep your payment reference and contact support; do not pay again.")
      const details = { method: "razorpay", status: "completed", paymentId: paymentRecovery.receipt.razorpay_payment_id,
        orderId: paymentRecovery.receipt.razorpay_order_id, checkoutToken: paymentRecovery.receipt.checkoutToken }
      await handlePlaceOrder(details, paymentRecovery.orderData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment recovery failed. Do not pay again.")
    } finally { setRecoveringPayment(false); recoveryLock.release() }
  }

  const paymentRequestContext = JSON.stringify([quoteContext, customerData])
  const paymentRequestContextRef = useRef(paymentRequestContext)
  paymentRequestContextRef.current = paymentRequestContext
  const activeStoreRequest = storeRequest && storeRequest.store.id === pickupStore?.id && storeRequestContext === paymentRequestContext ? storeRequest : null

  // Messages the chosen store; the order itself is created once the shopper submits the transaction ID.
  const requestStorePayment = async () => {
    if (!storeRequestLock.acquire()) return
    setStoreRequestLoading(true)
    try {
    if (!allowStorePayment) { toast.error("Pay at store is unavailable for these quantities. Choose another payment option."); return }
    if (activeStoreRequest) {
      if (await validateCheckout()) setStoreDialogOpen(true)
      return
    }
    if (!payStore) { toast.error(isPickup ? "Choose a pickup store first" : "Choose the store you want to pay"); return }
    if (!/^[6-9]\d{9}$/.test(customerData.phone.trim())) {
      toast.error("Enter a valid 10-digit mobile number so the store can call you")
      return
    }
    if (!await validateCheckout()) return
    setStoreRequestLoading(true)
    try {
      const attempt = await prepareCheckoutAttempt(checkoutOwner, "store-request", {
          items: cart.map(item => ({ ...item })),
          couponCode: appliedCoupon?.code || null,
          redeemPoints,
          declinedGiftPromotions: cartGifts.declinedGiftPromotions,
          expectedGifts: cartGifts.gifts.map(({ promotionId, giftId, sku, quantity }) => ({ promotionId, giftId, sku, quantity })),
          fulfilment: { method: fulfilmentMethod, storeId: fulfilmentStoreId },
          storeId: payStore.id,
          expectedAmount: Math.round(payableTotal * 100),
          customer: {
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            name: `${customerData.firstName} ${customerData.lastName}`.trim(),
            email: customerData.email,
            phone: customerData.phone.trim(),
            address: customerData.address,
            city: customerData.city,
            state: customerData.state,
            zipCode: customerData.pincode,
            country: customerData.country,
          },
        }, {})
      const response = await fetch("/api/payment/store-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify(attempt.body),
      })
      const json: unknown = await response.json().catch(() => null)
      const parsed = StorePaymentRequestResponseSchema.safeParse(json)
      if (!response.ok || !parsed.success) {
        if ([400, 403, 404, 429].includes(response.status) || response.headers.get("Checkout-Retry-Safe") === "true") clearCheckoutAttempt(checkoutOwner)
        const message = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : ""
        throw new Error(message || "Could not send your order to the store. Please try again.")
      }
      if (storeRequest?.requestId !== parsed.data.requestId) setStoreTransaction({ platform: "", transactionId: "" })
      setStoreRequest(parsed.data)
      resolveCheckoutAttempt(checkoutOwner)
      setStoreRequestContext(paymentRequestContext)
      if (paymentRequestContextRef.current === paymentRequestContext) setStoreDialogOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your order to the store. Please try again.")
    } finally {
      setStoreRequestLoading(false)
    }
    } finally { setStoreRequestLoading(false); storeRequestLock.release() }
  }

  const submitStorePayment = (platform: StorePaymentPlatform, transactionId: string) => {
    if (!activeStoreRequest) return
    return handlePlaceOrder({
      method: "store-payment",
      status: "pending",
      requestId: activeStoreRequest.requestId,
      requestToken: activeStoreRequest.requestToken,
      platform,
      transactionId,
    })
  }

  if (cartLoading || !draftReady) {
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
            <p className="text-gray-600">We&apos;re verifying your in-store purchase and finalizing the order. This may take a few moments.</p>
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
        <main className="flex-grow bg-white">
          {placedOrder ? <OrderSuccess order={placedOrder} guestToken={guestAccessToken} /> :
            <div className="section-container py-16 text-center"><h1 className="text-xl font-semibold">Your order has been placed</h1>
              <p className="mt-3">Loading details for {orderId}...</p>
              <Link className="mt-4 inline-block text-blue-700 underline" href={`/thank-you?orderId=${encodeURIComponent(orderId)}${guestAccessToken ? `&token=${encodeURIComponent(guestAccessToken)}` : ""}`}>View your order details</Link>
            </div>}
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className={`flex min-h-screen flex-col bg-white ${styles.checkout}`}>
      <Header />
      <main className="flex-grow">
        {cartError && <p role="alert" className="mx-auto max-w-6xl rounded bg-red-50 p-4 text-sm text-red-700">{cartError} <Link href="/cart" className="underline">Update cart</Link></p>}
        <div className={`section-container ${styles.container}`}>
          <nav className="sr-only" aria-label="Breadcrumb">
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

          <div className={styles.pageHeading}>
            <div>
              <h1 className="font-heading text-[24px] font-bold text-[#0F2557]">Checkout</h1>
              <p className="mt-0.5 text-[13px] text-slate-600">
                Almost there! Review your details and pay on this page.
              </p>
            </div>
            <ol className={styles.tracker} aria-label="Checkout progress">
              {CHECKOUT_TRACKER.map((label, index) => {
                const done = index === 0
                return (
                  <li key={label} aria-current={done ? "step" : undefined}>
                    <span>{index + 1}</span><strong>{label}</strong>
                  </li>
                )
              })}
            </ol>
          </div>

          {hostedStatus && <div role="status" className="mb-4 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p>{hostedStatus}</p>
            {hostedReturn && <button type="button" className="mt-2 font-semibold underline"
              onClick={() => setHostedStatusAttempt(value => value + 1)}>Retry payment confirmation</button>}
            <Link href="/contact" className="ml-3 underline">Contact support</Link>
          </div>}

          <Dialog open={!!user && checkoutCartPending} onOpenChange={open => {
            if (!open) void leaveCheckoutWithCart()
          }}>
            <DialogContent className="max-h-[85vh] w-[92vw] max-w-xl overflow-y-auto rounded-xl"
              onEscapeKeyDown={event => { if (resolvingCheckoutCart) event.preventDefault() }}
              onPointerDownOutside={event => { if (resolvingCheckoutCart) event.preventDefault() }}>
            <DialogHeader className="pr-6">
              <DialogTitle className="text-lg font-semibold text-[#0F2557]">You previously added these items</DialogTitle>
              <DialogDescription>Include your saved items in this purchase, or move them to your wishlist and buy your current products. Closing this popup keeps both sets of items in your cart.</DialogDescription>
            </DialogHeader>
            {!previousCartLoaded && !checkoutCartError && <p role="status" className="mt-3 text-sm">Loading your saved cart...</p>}
            {previousCartLoaded && previousCart.length === 0 && <p className="mt-3 text-sm">Your saved cart is empty. Continue with your current products.</p>}
            {previousCartLoaded && <ul className="mt-4 space-y-3">
              {previousCart.map(item => <li key={cartLineKey(item)} className="flex items-center gap-3 rounded-lg bg-white p-3">
                <CartProductImage src={item.image} name={item.name} className="h-14 w-14 rounded object-contain" />
                <div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{shortProductTitle(item.name)}</p>
                  <p className="text-sm text-slate-600">Quantity: {item.quantity} · ₹{money(Number(item.price) * item.quantity)}</p></div>
              </li>)}
            </ul>}
            {checkoutCartError && <p role="alert" className="mt-3 text-sm text-red-700">{checkoutCartError}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              {previousCartLoaded && <button type="button" disabled={resolvingCheckoutCart} onClick={() => void resolveCheckoutCart(true)}
                className="rounded-lg bg-[#1560BD] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {resolvingCheckoutCart ? "Saving your choice..." : previousCart.length ? "Include saved items" : "Continue with current products"}</button>}
              {previousCartLoaded && previousCart.length > 0 && <button type="button" disabled={resolvingCheckoutCart} onClick={() => void resolveCheckoutCart(false)}
                className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-[#0F2557] disabled:opacity-50">Move saved items to wishlist</button>}
              {previousCartLoaded && <button type="button" disabled={resolvingCheckoutCart} onClick={() => void leaveCheckoutWithCart()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 underline disabled:opacity-50">Keep both in cart</button>}
              {checkoutCartError && <button type="button" disabled={resolvingCheckoutCart || cartLoading} onClick={() => void loadCartFromDatabase()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#1560BD] underline">Reload saved items</button>}
            </div>
            </DialogContent>
          </Dialog>

          {/* Main Content Grid */}
          <fieldset disabled={checkoutCartPending || paymentPending || !!hostedReturn || hostedRecoveryBlocked || isProcessing || addressSaving || !!movingWishlistId} className={styles.layout}>
            <legend className="sr-only">Checkout details and payment</legend>
            {/* Customer Details - Left side */}
            <div className={styles.detailsColumn} inert={Boolean(paymentRecovery) || paymentPending || isProcessing || storeRequestLoading}>
              {(
                <section className={styles.panel} aria-labelledby="delivery-address-heading">
                  <h2 id="delivery-address-heading" className={styles.sectionTitle}>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1560BD] text-[11px] font-bold text-white">
                      1
                    </span>
                    Delivery Address
                    {!editingAddress && <button type="button" className="ml-auto text-xs font-medium text-[#0054F0]" onClick={startNewAddress}>+ Add New Address</button>}
                  </h2>
                  <p className={styles.sectionHint}>{user ? "Choose a saved address or save a new one for future checkouts." : "Enter your delivery details below."}</p>
                  {profileLoading && <p role="status" className="mb-4 text-sm text-gray-600">Loading your saved account details...</p>}
                  {profileError && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {profileError} <button type="button" className="font-semibold underline" onClick={() => setProfileAttempt((attempt) => attempt + 1)}>Retry account details</button>
                  </div>}
                  {addressNotice && <p role="alert" className="mb-4 text-sm text-amber-800">{addressNotice}</p>}
                  {addressesLoading && <p role="status" className="mb-3 text-sm text-gray-600">Loading saved delivery addresses...</p>}
                  {addressesError && <p role="alert" className="mb-3 text-sm text-red-700">{addressesError} <button type="button" className="underline" onClick={() => setAddressesAttempt(value => value + 1)}>Retry saved addresses</button></p>}
                  {savedAddresses.length > 0 && <div className={styles.addressGrid} role="group" aria-label="Saved delivery addresses">
                    {savedAddresses.map(address => <div key={address.id} className={`${styles.savedAddress} ${selectedAddressId !== address.id || editingAddress ? styles.unselectedAddress : ""}`}>
                      <button type="button" className={styles.addressChoice} aria-pressed={selectedAddressId === address.id && !editingAddress}
                        aria-label={`Deliver to ${address.type} address: ${address.address}`} onClick={() => selectAddress(address)}>
                        <span className={styles.selectedDot} aria-hidden="true" /><Home size={15} />
                        <span><strong>{address.type === "work" ? "Work" : address.type === "other" ? "Other" : "Home"} address</strong>
                          <span>{address.firstName} {address.lastName}</span><span>{address.address}</span>
                          <span>{address.city} - {address.pincode}, {address.state}</span><span>Mobile: {address.phone}</span>
                        </span>
                      </button>
                      <div className={styles.addressActions}>
                        <button type="button" onClick={() => { selectAddress(address); setEditingAddress(true) }}>Edit</button>
                        <button type="button" onClick={() => void removeAddress(address.id)} disabled={addressSaving}>Remove</button>
                      </div>
                    </div>)}
                    <button type="button" className={styles.newAddressCard} onClick={startNewAddress}><span>+</span><strong>Add a delivery address</strong><small>Save it to your account for next time.</small></button>
                  </div>}
                  {!editingAddress && !selectedAddressId && <>
                    <div className={styles.addressGrid}>
                      <div className={styles.savedAddress}>
                        <span className={styles.selectedDot} aria-hidden="true" /><Home size={15} />
                        <div><strong>Delivery address</strong><p>{customerData.firstName} {customerData.lastName}</p>
                          <p>{customerData.address}</p><p>{customerData.city} - {customerData.pincode}, {customerData.state}</p>
                          <p>Mobile: {customerData.phone}</p>
                        </div>
                        <button type="button" onClick={() => setEditingAddress(true)}>Edit</button>
                      </div>
                      <button type="button" className={styles.newAddressCard} onClick={startNewAddress}><span>+</span><strong>Add a delivery address</strong><small>Keep your contact details and enter another address.</small></button>
                    </div>
                    <p className={styles.accountContact}><Mail size={12} />Order updates will be sent to {customerData.email}</p>
                  </>}

                  {!user && (
                    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        Sign in for faster checkout, or continue as a guest
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => { if (prepareCheckoutSignIn()) router.push("/login?redirect=/checkout") }}
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
                          {" "}Your name, email, phone number and full address are required.
                        </p>
                      )}
                    </div>
                  )}

                  <fieldset hidden={!editingAddress} disabled={addressSaving || pincodeRulesLoading}>
                  {user && !isPickup && <label className="mb-4 block text-sm font-medium text-gray-700">
                    Address label
                    <select aria-label="Address label" value={addressType} onChange={event => setAddressType(event.target.value as SavedDeliveryAddress["type"])}
                      className="ml-3 rounded-md border border-gray-300 px-3 py-2">
                      <option value="home">Home</option><option value="work">Work</option><option value="other">Other</option>
                    </select>
                  </label>}
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
                        onBlur={() => validateContactField("firstName")}
                        autoComplete="given-name"
                        maxLength={50}
                        aria-invalid={!!customerErrors.firstName}
                        aria-describedby={customerErrors.firstName ? "checkout-firstName-error" : undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                      {customerErrors.firstName && <p id="checkout-firstName-error" role="alert" className="mt-1 text-xs text-red-600">{customerErrors.firstName}</p>}
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
                        onBlur={() => validateContactField("lastName")}
                        autoComplete="family-name"
                        maxLength={50}
                        required
                        aria-invalid={!!customerErrors.lastName}
                        aria-describedby={customerErrors.lastName ? "checkout-lastName-error" : undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                      />
                      {customerErrors.lastName && <p id="checkout-lastName-error" role="alert" className="mt-1 text-xs text-red-600">{customerErrors.lastName}</p>}
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
                        onBlur={() => validateContactField("email")}
                        autoComplete="email"
                        inputMode="email"
                        maxLength={254}
                        aria-invalid={!!customerErrors.email}
                        aria-describedby={customerErrors.email ? "checkout-email-error" : undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                      {customerErrors.email && <p id="checkout-email-error" role="alert" className="mt-1 text-xs text-red-600">{customerErrors.email}</p>}
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
                        onBlur={() => validateContactField("phone")}
                        autoComplete="tel-national"
                        inputMode="numeric"
                        maxLength={10}
                        pattern="[6-9][0-9]{9}"
                        aria-invalid={!!customerErrors.phone}
                        aria-describedby={customerErrors.phone ? "checkout-phone-error" : undefined}
                        placeholder="10-digit mobile number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                        required
                      />
                      {customerErrors.phone && <p id="checkout-phone-error" role="alert" className="mt-1 text-xs text-red-600">{customerErrors.phone}</p>}
                    </div>
                  </div>

                  {(!isPickup || !user) && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <MapPin className="h-5 w-5 mr-2" />
                      {isPickup ? "Your Address" : "Delivery Address"}
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
                            {(nationwideDelivery || isPickup ? indianStates : ["Karnataka"]).map(state => <option key={state} value={state}>{state}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                            City *
                          </label>
                          {nationwideDelivery || isPickup ? <input
                            type="text" id="city" name="city" value={customerData.city} onChange={handleInputChange}
                            maxLength={50} disabled={!customerData.state} placeholder="Enter your city or town"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#1560BD] focus:outline-none disabled:bg-gray-100"
                            required
                          /> : <select
                            id="city"
                            name="city"
                            value={customerData.city}
                            onChange={handleInputChange}
                            disabled={!customerData.state}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD] disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                          >
                            <option value="">
                              Select City
                            </option>
                            {CHECKOUT_CITIES.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </select>}
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
                  {!isPickup && <div className={styles.addressFormActions}>
                    {user && <button type="button" onClick={() => void saveAddress()} disabled={addressSaving || addressesLoading}>
                      {addressSaving ? "Saving address..." : selectedAddressId ? "Save address changes" : "Save delivery address"}
                    </button>}
                    <button type="button" onClick={useEnteredAddress}>{user ? "Use without saving" : "Use this address"}</button>
                    {selectedAddressId && <button type="button" onClick={() => {
                      const original = savedAddresses.find(address => address.id === selectedAddressId)
                      if (original) selectAddress(original)
                    }}>Cancel edit</button>}
                    {!user && <small>Sign in to save addresses for future checkouts.</small>}
                  </div>}
                  </fieldset>
                </section>
              )}

              <section className={styles.panel} aria-labelledby="delivery-options-heading">
                <h2 id="delivery-options-heading" className={styles.sectionTitle}><span>2</span>Delivery Options</h2>
                <p className={styles.sectionHint}>Choose how you would like to receive your order.</p>
                <FulfilmentSelector method={fulfilmentMethod} onMethodChange={changeFulfilmentMethod} selectedStore={pickupStore} onStoreChange={setPickupStore}
                  deliveryPincode={customerData.pincode} deliveryCity={customerData.city} stock={storeStock}
                  deliveryFeeLabel={isLoadingSettings || settingsError || !settingsData ? "Charges confirmed at payment" : shipping > 0 ? `₹${money(shipping)}` : "FREE"}>
                  <div className={styles.deliveryNotice}><Truck size={34} /><div>
                    <small>{isPickup ? "Store pickup" : "Home delivery service area"}</small>
                    <strong>{isPickup ? pickupStore?.name || "Choose a SARA store" : nationwideDelivery ? "All India" : "Bangalore & Mysore"}</strong>
                    <p>{isPickup ? "We'll let you know when your order is ready." : "Delivery timing confirmed after your order."}</p>
                  </div><ul><li><CheckCircle size={13} />Pincode checked before payment</li><li><CheckCircle size={13} />Secure online payments</li><li><CheckCircle size={13} />Pickup confirmed after your order</li></ul></div>
                </FulfilmentSelector>
                {!isPickup && pincodeRulesLoading && <p role="status" className={styles.sectionHint}>Loading delivery availability...</p>}
                {!isPickup && pincodeRulesError && <p role="alert" className="mt-3 text-sm text-red-700">{pincodeRulesError} <button type="button"
                  onClick={() => setPincodeRulesAttempt(value => value + 1)} className="underline">Retry delivery availability</button></p>}
              </section>

              {(
                <section className={styles.panel} aria-labelledby="payment-method-heading">
                  <h2 id="payment-method-heading" className={styles.sectionTitle}>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1560BD] text-[11px] font-bold text-white">
                      3
                    </span>
                    Payment Method
                  </h2>
                  <p className={styles.sectionHint}>{isPickup ? "Pay online or choose Pay at Store after selecting a store with your items in stock."
                    : "Pay online with UPI, cards or another available option at the secure payment gateway."}</p>
                  {paymentConfigError && <p role="alert" className="text-sm text-red-700">{paymentConfigError}</p>}
                  {draftStorageError && <p role="alert" className="text-sm text-amber-800">Your browser could not save checkout details. Keep this tab open until your order is confirmed.</p>}
                  {paymentConfigLoading && <p role="status" className={styles.sectionHint}>Loading online payment gateways...</p>}
                  {!paymentConfigLoading && !paymentConfigError && !paymentProviders.length && (() => {
                    const offline = [allowStorePayment && "pay at store"]
                      .filter((option): option is string => !!option)
                    return <p className={styles.sectionHint}>Online payments are currently unavailable. {offline.length
                      ? `Choose ${offline.length > 1 ? `${offline.slice(0, -1).join(", ")} or ${offline.at(-1)}` : offline[0]}.`
                      : "Please try again later."}</p>
                  })()}
                  <CheckoutPaymentOptions providers={paymentProviders} codEnabled={false} instoreEnabled={false}
                    storePaymentEnabled={allowStorePayment}
                    selected={paymentMethod === "online" ? paymentProvider : paymentMethod}
                    onChange={choice => {
                      if (choice === "cash-on-delivery" || choice === "instore") return
                      if (choice === "store-payment") {
                        if (!allowStorePayment) return
                        setPaymentMethod(choice)
                      } else {
                        setPaymentProvider(choice)
                        setPaymentMethod("online")
                      }
                    }}>
                    <PayAtStoreStorePicker isPickup={isPickup} pickupStore={pickupStore}
                      deliveryPincode={customerData.pincode} deliveryCity={customerData.city} stock={storeStock}
                      value={payStore} onChange={setPayStore} />
                  </CheckoutPaymentOptions>

                </section>
              )}
            </div>

            {/* Order Summary - Right side */}
            <aside className={`space-y-4 ${styles.summaryColumn}`}>
              {paymentRecovery && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p>A payment was received. Your original checkout details are saved. Recover this order before making another payment.</p>
                <p className="mt-1">Payment reference: {paymentRecovery.receipt.razorpay_payment_id}</p>
                <button type="button" disabled={recoveringPayment || isProcessing || paymentPending} onClick={() => void recoverPayment()}
                  className="mt-2 font-semibold underline disabled:opacity-50">{recoveringPayment ? "Recovering payment..." : "Recover payment"}</button>
              </div>}
              <div className={styles.summary}>
                <div className={styles.summaryHeader}>
                  <h2 className="font-heading text-[15px] font-bold text-[#0F2557]">
                    Order Summary ({cart.length} {cart.length === 1 ? "item" : "items"})
                  </h2>
                  <Link href="/cart" className="text-[12px] font-semibold text-[#1560BD] hover:underline">
                    Edit Cart
                  </Link>
                </div>

                {/* Cart Items */}
                <div className={styles.summaryItems}>
                  {cart.map((item) => {
                    const lineKey = cartLineKey(item)
                    const title = shortProductTitle(item.name) || "Product"
                    const href = item.type === "software" ? "/software" : `/product/${encodeURIComponent(item.id)}`
                    return (
                    <div key={lineKey} className={styles.summaryRow}>
                      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.summaryImage} aria-label={`Open ${title} in a new tab`}>
                        <CartProductImage src={item.image} name={title} />
                      </a>
                      <div className="flex-1 min-w-0">
                        <a href={href} target="_blank" rel="noopener noreferrer" title={cleanProductName(item.name)}
                          className={`${styles.productName} line-clamp-2 hover:text-[#1560BD] hover:underline`}>
                          {title}
                        </a>
                        <p className="text-xs text-gray-500 mb-1">Qty: {item.quantity}</p>
                        {(item.color || item.size || item.ram || item.storage) && <p className="text-xs text-gray-600">
                          {[item.color && `Color: ${item.color}`, item.size && `Size: ${item.size}`,
                            item.ram && `RAM: ${item.ram}`, item.storage && `Storage: ${item.storage}`].filter(Boolean).join(" · ")}
                        </p>}
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
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <button type="button" onClick={() => void moveItemToWishlist(lineKey)}
                            disabled={!!movingWishlistId || storeRequestLoading}
                            aria-label={`Move ${title} to wishlist`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1560BD] hover:underline disabled:opacity-50">
                            <Heart className="h-3.5 w-3.5" />
                            {movingWishlistId === lineKey ? "Moving..." : "Move to wishlist"}
                          </button>
                          <button type="button" onClick={() => setItemToRemove({ id: lineKey, name: title })}
                            disabled={!!movingWishlistId || storeRequestLoading}
                            aria-label={`Remove ${title}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                            <Trash2 className="h-3.5 w-3.5" />Remove
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-sm font-semibold flex-shrink-0">₹{money(item.price * item.quantity)}</p>
                      </div>
                    </div>
                    )
                  })}
                </div>

                {/* Coupon input */}
                <CartGifts quote={cartGifts} disabled={isProcessing || paymentPending || storeRequestLoading || !!paymentRecovery} />
                <div id="checkout-coupon" className="mb-4 scroll-mt-48 p-3 border rounded-lg bg-gray-50">
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

                {catalogueLoading && <p role="status" className="text-xs text-gray-600">Refreshing prices and stock...</p>}
                {catalogueError && <p role="alert" className="text-xs text-red-700">{catalogueError} <button type="button" className="underline" onClick={() => setCatalogueAttempt(attempt => attempt + 1)}>Retry product details</button> <Link href="/cart" className="underline">Edit cart</Link></p>}
                {/* Pricing Breakdown */}
                <div className={styles.priceDetails}>
                  <h3 className="mb-3 font-semibold text-sm">Price Details</h3>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Total MRP</span><span>₹{money(totalMrp)}</span></div>
                  <div className="flex justify-between text-sm text-green-700"><span>Product Discount</span><span>− ₹{money(productDiscount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Delivery Charges</span><span className={shipping === 0 ? "text-green-700" : ""}>{hasHardware && !isPickup && (isLoadingSettings || settingsError || !settingsData) ? "Confirming..." : shipping > 0 ? `₹${money(shipping)}` : "FREE"}</span></div>
                  <details className="text-xs text-gray-600"><summary className="cursor-pointer">GST breakdown (included in prices)</summary>
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
                  </details>
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
                    <span>Total Amount</span>
                    <span>₹{money(payableTotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Inclusive of all taxes. Final prices are confirmed server-side.</p>
                  {productDiscount + couponDiscount > 0 && <p className={styles.savings}><Tag size={17} />You are saving ₹{money(productDiscount + couponDiscount)} on this order.</p>}
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
                {paymentMethod === "store-payment" ? (
                  <button type="button" onClick={() => void requestStorePayment()}
                    disabled={storeRequestLoading || isProcessing || !allowStorePayment}
                    className="flex w-full items-center justify-center rounded-md bg-[#0054F0] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                    {storeRequestLoading ? "Sending to store..."
                      : activeStoreRequest ? "Enter transaction ID"
                        : `Place order ₹${money(payableTotal)}`}
                    {!storeRequestLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </button>
                ) : paymentMethod !== "instore" ? <PaymentGateway
                  key={`${paymentMethod}:${paymentProvider}`}
                  checkoutOwner={checkoutOwner}
                  onPaymentReceived={recovery => { if (checkoutOwnerRef.current === checkoutOwner) setPaymentRecovery(recovery) }}
                  compact
                  paymentMethod={paymentMethod}
                  provider={paymentProvider}
                  getHostedOrderData={() => buildOrderData()}
                  onProcessingChange={setPaymentPending}
                  amount={payableTotal}
                  beforePayment={validateCheckout}
                  orderDetails={{ customer: customerData, items: cart, coupon: appliedCoupon ? { code: appliedCoupon.code } : null,
                    declinedGiftPromotions: cartGifts.declinedGiftPromotions,
                    expectedGifts: cartGifts.gifts.map(({ promotionId, giftId, sku, quantity }) => ({ promotionId, giftId, sku, quantity })),
                    redeemPoints, fulfilment: { method: fulfilmentMethod, storeId: fulfilmentStoreId }, total: payableTotal }}
                  onSuccess={handlePaymentSuccess}
                  disabled={Boolean(paymentRecovery || recoveringPayment || cartError || storeStock.error) || !storeStock.storeIds ||
                    (isPickup ? !pickupStore || !storeStock.storeIds.has(pickupStore.id) : !storeStock.deliveryAvailable)}
                  onCancel={() => toast.error("Payment cancelled")}
                /> : <a href="#payment-method-heading" className={styles.primaryButton}>Verify in-store purchase <ArrowRight size={16} /></a>}

                {/* Free Shipping Progress */}
                {hasHardware && shipping > 0 && (
                  <div className="mt-4 rounded-lg bg-[#F4F8FD] p-3">
                    <p className="text-[12px] text-[#1560BD]">
                      Add ₹{(freeShippingThreshold - (softwareTotal + hardwareTotal)).toLocaleString("en-IN")} more for free delivery!
                    </p>
                  </div>
                )}
              <div className={styles.securePayment}>
                <div className={styles.secureIntro}><Shield size={40} /><div><strong>Secure Payments</strong>
                  <p>{paymentMethod === "cash-on-delivery" ? "Pay when your order is delivered."
                    : paymentMethod === "instore" ? "Your purchase is verified with the store."
                    : paymentMethod === "store-payment" ? "Pay the store through the link they send on WhatsApp."
                    : `Processed through ${paymentProvider ? PAYMENT_PROVIDER_LABELS[paymentProvider] : "your selected gateway"}. SARA does not store your card details.`}</p>
                </div></div>
                {paymentProviders.length > 0 && <ul className={styles.paymentBrands} aria-label="Enabled payment gateways">
                  {paymentProviders.map(provider => (
                    <li key={provider}>
                      <PaymentProviderLogo provider={provider} className="h-6 w-24 object-contain" />
                    </li>
                  ))}
                </ul>}
              </div>
              </div>

              <div className={styles.help}><Headphones size={36} /><div><strong>Need Help?</strong>
                {settingsData?.storePhone && <p>Call <a href={`tel:${settingsData.storePhone}`}>{settingsData.storePhone}</a></p>}
                <Link href="/contact">Contact our support team <ArrowRight size={12} /></Link>
              </div></div>
            </aside>
          </fieldset>

          <div className={styles.benefits}>
            {[
              { icon: Store, title: "SARA Stores", detail: "Find your nearest store", href: "/store-locator" },
              { icon: Shield, title: "Genuine Products", detail: "Trusted brands", href: "/warranty" },
              { icon: CreditCard, title: "EMI Options", detail: "Subject to eligibility", href: "/emi" },
              { icon: Truck, title: "Delivery & Pickup", detail: "Choose what suits you", href: "#delivery-options-heading" },
              { icon: Headphones, title: "Expert Support", detail: "We're here to help", href: "/contact" },
            ].map(({ icon: Icon, title, detail, href }) => <Link key={title} href={href}><Icon size={28} /><span><strong>{title}</strong><small>{detail}</small></span></Link>)}
          </div>
        </div>
      </main>

      {storeDialogOpen && activeStoreRequest && (
        <PayAtStoreDialog
          storeName={activeStoreRequest.store.name}
          orderReference={activeStoreRequest.requestId}
          amount={payableTotal}
          customerPhone={customerData.phone.trim()}
          storeNotified={activeStoreRequest.notified.whatsapp || activeStoreRequest.notified.email}
          submitting={isProcessing}
          initialTransaction={storeTransaction}
          onTransactionChange={setStoreTransaction}
          onSubmit={(platform, transactionId) => void submitStorePayment(platform, transactionId)}
          onClose={() => setStoreDialogOpen(false)}
        />
      )}

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
