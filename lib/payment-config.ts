import { PaymentProviderSchema, type PaymentProvider } from "@/types/payment-gateways"

export class PaymentConfigurationError extends Error {}

export function paymentEnabled(provider: PaymentProvider): boolean {
  const name = `${provider.toUpperCase()}_ENABLED`
  const value = process.env[name]
  if (value === undefined || value === "") return provider === "razorpay"
  if (value !== "true" && value !== "false") throw new PaymentConfigurationError(`${name} must be true or false`)
  return value === "true"
}

/** Cash on delivery is offered only when COD_ENABLED is exactly "true". */
export function cashOnDeliveryEnabled(): boolean {
  const value = process.env.COD_ENABLED
  if (value === undefined || value === "") return false
  if (value !== "true" && value !== "false") throw new PaymentConfigurationError("COD_ENABLED must be true or false")
  return value === "true"
}

/** Off unless INSTORE_PURCHASE_ENABLED is exactly "true". */
export function inStorePurchaseEnabled(): boolean {
  return process.env.INSTORE_PURCHASE_ENABLED?.trim() === "true"
}

/** On unless PAY_AT_STORE_ENABLED is "false". */
export function storePaymentEnabled(): boolean {
  return process.env.PAY_AT_STORE_ENABLED?.trim() !== "false"
}

export function paymentConfiguration() {
  const providers = PaymentProviderSchema.options.filter(paymentEnabled)
  const requested = process.env.PAYMENT_DEFAULT_PROVIDER
  if (requested && (!PaymentProviderSchema.safeParse(requested).success || !providers.some(provider => provider === requested))) {
    throw new PaymentConfigurationError("PAYMENT_DEFAULT_PROVIDER must name an enabled gateway")
  }
  const defaultProvider = providers.find(provider => provider === requested) ?? providers[0] ?? null
  return { providers, defaultProvider, codEnabled: cashOnDeliveryEnabled(), instoreEnabled: inStorePurchaseEnabled(),
    storePaymentEnabled: storePaymentEnabled() }
}

export function paymentSiteOrigin(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL
  if (!value) throw new PaymentConfigurationError("NEXT_PUBLIC_SITE_URL is required for hosted payments")
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost"))) {
    throw new PaymentConfigurationError("NEXT_PUBLIC_SITE_URL must be an HTTPS origin")
  }
  return url.origin
}

export function paymentSetting(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new PaymentConfigurationError(`${name} is required`)
  return value
}

export function paymentEnvironment(provider: "PINELABS" | "PAYTM"): "uat" | "production" {
  const value = process.env[`${provider}_ENVIRONMENT`] || "uat"
  if (value !== "uat" && value !== "production") throw new PaymentConfigurationError(`${provider}_ENVIRONMENT must be uat or production`)
  return value
}
