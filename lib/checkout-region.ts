export const CHECKOUT_CITIES = ["Bangalore", "Mysore"]

export function checkoutCity(city: string): string {
  const normalized = city.trim().toLowerCase()
  if (["bangalore", "bengaluru"].includes(normalized)) return "Bangalore"
  if (["mysore", "mysuru", "maysore"].includes(normalized)) return "Mysore"
  return ""
}
