/** Business-confirmed minimum for promotional claims about the entire network. */
export function storeNetworkCount(value?: unknown): string {
  const count = typeof value === "number" ? value :
    typeof value === "string" ? Number(value.trim().replace(/\+$/, "")) : 0
  return `${Number.isFinite(count) ? Math.max(90, Math.floor(count)) : 90}+`
}
