/** Readable catalogue names, retaining manufacturer styling and technical units. */
const spelling: Record<string, string> = {
  iphone: "iPhone", ipad: "iPad", ipod: "iPod", imac: "iMac", macbook: "MacBook",
  airpods: "AirPods", oneplus: "OnePlus", iqoo: "iQOO", wifi: "WiFi",
  usb: "USB", hdmi: "HDMI", ram: "RAM", rom: "ROM", oled: "OLED", qled: "QLED",
  led: "LED", uhd: "UHD", fhd: "FHD", ips: "IPS", nfc: "NFC", gps: "GPS",
  lte: "LTE", sim: "SIM", ac: "AC", tv: "TV", lg: "LG", hp: "HP", mi: "MI", jbl: "JBL",
}
const units: Record<string, string> = { gb: "GB", tb: "TB", mb: "MB", hz: "Hz", mah: "mAh", w: "W", v: "V", mp: "MP", kg: "kg", l: "L", mm: "mm", cm: "cm" }

export function formatProductName(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/[a-z0-9]+(?:[.-][a-z0-9]+)*/gi, token => {
    const lower = token.toLowerCase()
    if (spelling[lower]) return spelling[lower]
    const measurement = lower.match(/^(\d+(?:\.\d+)?)(gb|tb|mb|hz|mah|w|v|mp|kg|l|mm|cm)$/)
    if (measurement) return measurement[1] + units[measurement[2]]
    if (/\d/.test(token)) return token.toUpperCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
}
