import QRCode from "qrcode"
import { ObjectId } from "mongodb"
import type { WithId } from "mongodb"
import { StoreHttpUrlSchema } from "@/lib/validation"

export type StoreQrType = "google_maps" | "whatsapp" | "instagram"
export interface StoreQrScan {
  timestamp: Date
  userAgent: string
  referer: string
  ip: string
}
export interface StoreQrDocument {
  _id?: ObjectId
  storeId: string
  storeName: string
  type: StoreQrType
  label: string
  targetUrl: string
  qrDataUrl: string
  scanCount: number
  lastScannedAt: Date | null
  scanHistory: StoreQrScan[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
export class StoreQrError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}
export const STORE_QR_DEFAULT_URLS = {
  whatsapp: "https://whatsapp.com/channel/0029Va6Q9GO35fLwtGQiLr0u",
  instagram: "https://www.instagram.com/saramobilesandelectronics/",
}

export function storeQrScanUrl(id: string, origin: string) {
  const url = StoreHttpUrlSchema.parse(origin)
  return new URL(`/api/store-qr/scan/${id}`, url).href
}

export async function trackedStoreQrImage(id: string, origin: string) {
  return QRCode.toDataURL(storeQrScanUrl(id, origin), {
    width: 400, margin: 2, color: { dark: "#000000", light: "#FFFFFF" },
  })
}

export async function createTrackedStoreQr(
  input: Pick<StoreQrDocument, "storeId" | "storeName" | "type" | "label" | "targetUrl">,
  origin: string,
): Promise<WithId<StoreQrDocument>> {
  StoreHttpUrlSchema.parse(input.targetUrl)
  const _id = new ObjectId()
  const qrDataUrl = await trackedStoreQrImage(_id.toHexString(), origin)
  const now = new Date()
  return {
    ...input, _id, qrDataUrl, scanCount: 0, lastScannedAt: null,
    scanHistory: [], isActive: true, createdAt: now, updatedAt: now,
  }
}

export function normalizeStoreQr(qr: WithId<StoreQrDocument>) {
  return {
    id: qr._id.toHexString(), storeId: qr.storeId, storeName: qr.storeName || "",
    type: qr.type, label: qr.label || "", targetUrl: qr.targetUrl, qrDataUrl: qr.qrDataUrl,
    scanCount: qr.scanCount || 0, lastScannedAt: qr.lastScannedAt?.toISOString() ?? null,
    scanHistory: (qr.scanHistory || []).map(scan => ({ ...scan, timestamp: new Date(scan.timestamp).toISOString() })),
    isActive: qr.isActive === true, createdAt: qr.createdAt?.toISOString(), updatedAt: qr.updatedAt?.toISOString(),
  }
}
export type StoreQrResponse = ReturnType<typeof normalizeStoreQr>
