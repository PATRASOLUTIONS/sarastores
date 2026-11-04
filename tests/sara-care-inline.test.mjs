import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'

function nodes(tree) {
  const result = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; result.push(node); visit(node.props.children) }
  visit(tree); return result
}

test('enabled Sara Care stays under its device without an extra row, and remains included in cart totals', () => {
  let index = 0, selected
  const device = { id: 'synthetic-device', name: 'Synthetic device', quantity: 1, price: 1000, stock: 5, saraCareSelection: 2, color: null, size: null }
  const cartState = { cart: [device], isLoading: false, isHydrating: false, saraCareError: '', saraCareLoading: false, refreshItemPrices() {}, setSaraCareDuration(_key, value) { selected = value } }
  const overrides = {
    react: { useState(value) { return [index++ === 0 ? { [device.id]: { ...device, mrp: 1000 } } : value, () => {}] }, useEffect() {}, useMemo: work => work(), useRef: value => ({ current: value }), useId: () => 'synthetic-care' },
    '@/hooks/useCart': { useCart: () => cartState }, '@/contexts/AuthContext': { useAuth: () => ({ user: null, isLoading: false }) },
    '@/hooks/useWishlist': { useWishlist: () => ({}) }, '@/hooks/useSettingsData': { useSettingsData: () => ({ data: { shippingFee: 0, freeShippingThreshold: 0 }, isLoading: false }) },
    'next/navigation': { useRouter: () => ({}) }, '@/hooks/useBanners': { useBanners: () => [] },
    '@/hooks/useMarketingContent': { useMarketingContent: () => ({ enabled: () => false, text: () => 'Synthetic' }) },
    '@/hooks/useCartGifts': { useCartGifts: () => ({}) }, '@/hooks/useCartCoupon': { useCartCoupon: () => ({ couponDiscount: 0 }) },
    '@/app/cart/cart.module.css': { __esModule: true, default: new Proxy({}, { get: (_target, name) => String(name) }) },
  }
  for (const name of ['Header', 'Footer', 'CartProductImage', 'cart/CartPromotion', 'cart/CartGifts', 'cart/CartCoupon', 'diwali/CartDiwaliGift']) overrides[`@/components/${name}`] = () => null
  overrides['@/components/marketing/MarketingSections'] = { MarketingStatus: () => null }
  const loader = sourceLoader(overrides)
  const lineKey = loader.load('lib/cart-line.ts').cartLineKey(device)
  cartState.cart.push({ id: 'sara-care-2y', type: 'service', name: 'Sara Care', quantity: 1, price: 110, saraCare: { parentLineKey: lineKey, durationYears: 2, parentName: device.name } })
  cartState.saraCareOffers = [{ parentLineKey: lineKey, defaultYears: 1, options: [{ years: 1, price: 70 }, { years: 2, price: 110 }] }]
  const Component = loader.load('components/cart/CartContents.tsx').default
  const Options = loader.load('components/cart/SaraCareOptions.tsx').default
  const tree = Component({}), all = nodes(tree)
  const rows = all.filter(node => node.type === 'li' && node.props.className === 'cartItem')
  assert.equal(rows.length, 1)
  assert.equal(all.filter(node => node.props.className === 'careItem').length, 0)
  const picker = nodes(rows[0]).find(node => node.type === Options)
  assert.equal(picker.props.item.id, device.id)
  assert.ok(all.some(node => node.type === 'dd' && node.props.children === '\u20b91,110'))
  const inline = Options(picker.props)
  assert.ok(inline, 'Parent control must remain visible when a care line exists')
  const toggle = nodes(inline).find(node => node.type === 'input' && node.props.role === 'switch')
  assert.equal(toggle.props.checked, true)
  toggle.props.onChange({ target: { checked: false } })
  assert.equal(selected, null)
})
