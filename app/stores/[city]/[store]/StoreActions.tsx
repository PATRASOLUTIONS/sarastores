"use client"

import { Navigation, Phone } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { analytics } from "@/lib/analytics"

/**
 * Outbound actions on a store page.
 *
 * Split out of the server-rendered store page so the directions / call /
 * WhatsApp clicks can be tracked — these are the online-to-offline signals the
 * BRD's analytics section asks for.
 */
export default function StoreActions({
  storeId,
  storeName,
  city,
  phone,
  directionsUrl,
}: {
  storeId: string
  storeName: string
  city: string
  phone: string
  directionsUrl: string
}) {
  const whatsappNumber = phone.replace(/\D/g, "")

  return (
    <>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => analytics.getDirections(storeId, storeName)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        <Navigation className="h-4 w-4" />
        Get directions
      </a>

      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={() => analytics.callClick("store_page", phone)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Phone className="h-4 w-4" />
          Call store
        </a>
      )}

      {whatsappNumber.length >= 10 && (
        <a
          href={`https://wa.me/91${whatsappNumber.slice(-10)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analytics.whatsappClick("store_page", { store_id: storeId, city })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FaWhatsapp className="h-4 w-4 text-green-600" />
          WhatsApp
        </a>
      )}
    </>
  )
}
