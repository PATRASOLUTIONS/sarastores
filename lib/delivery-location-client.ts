import { DELIVERY_LOCATION_NOTICE_VERSION } from "@/lib/dpdp-config"

async function locationRequest(body: object, signal?: AbortSignal) {
  const response = await fetch("/api/consent/location", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "Location detection is unavailable. Enter your pincode manually.")
  return result
}

function currentPosition(signal: AbortSignal): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("Location detection cancelled", "AbortError"))
    if (signal.aborted) { cancel(); return }
    signal.addEventListener("abort", cancel, { once: true })
    navigator.geolocation.getCurrentPosition(position => {
      signal.removeEventListener("abort", cancel)
      if (signal.aborted) { cancel(); return }
      resolve(position)
    }, error => {
      signal.removeEventListener("abort", cancel)
      if (signal.aborted) { cancel(); return }
      reject(new Error(error.code === 1
        ? "Location permission was denied. You can enter your pincode manually or allow location in your browser settings."
        : error.code === 3
          ? "Location detection timed out. Try again or enter your pincode manually."
          : "Your location is unavailable. Please enter your pincode manually."))
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 })
  })
}

/** Record consent before asking the browser for a one-time location fix. */
export async function detectDeliveryPincode(consent: boolean, signal: AbortSignal): Promise<string> {
  if (!consent) throw new Error("Please agree to one-time location use first.")
  if (!window.isSecureContext || !navigator.geolocation) {
    throw new Error("Location detection needs a supported browser and a secure connection. Enter your pincode manually.")
  }
  signal.throwIfAborted()
  // Complete the grant request even on cancellation so its receipt can be withdrawn.
  const grant = await locationRequest({ action: "grant", consent: true, adult: true, version: DELIVERY_LOCATION_NOTICE_VERSION })
  if (typeof grant.receipt !== "string") throw new Error("Could not confirm location consent. Enter your pincode manually.")
  try {
    signal.throwIfAborted()
    const position = await currentPosition(signal)
    signal.throwIfAborted()
    const result = await locationRequest({
      action: "resolve", receipt: grant.receipt,
      latitude: Number(position.coords.latitude.toFixed(3)), longitude: Number(position.coords.longitude.toFixed(3)),
    }, signal)
    if (!/^[1-9]\d{5}$/.test(result.pincode)) throw new Error("Could not detect a valid pincode. Please enter it manually.")
    return result.pincode
  } finally {
    // Covers permission denial, cancellation and lookup failure. Receipts also
    // expire after five minutes when a network failure prevents withdrawal.
    await locationRequest({ action: "withdraw", receipt: grant.receipt })
  }
}
