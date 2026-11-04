import type { BannerPlacement } from '@/hooks/useBanners'

export const BANNER_LOCATIONS: Record<BannerPlacement, { page: string; href: string; section: string; note: string; scope: string; limit: number }> = {
  'home-hero': { page: 'Home', href: '/', section: 'Top main poster', note: 'All eligible posters rotate in order. A photo-only main poster hides the side banners.', scope: '', limit: Infinity },
  'home-duo': { page: 'Home', href: '/', section: 'Beside the main poster', note: 'The first two eligible side banners show together. Both are needed; photo-only main posters hide them.', scope: '', limit: 2 },
  'home-card': { page: 'Home', href: '/', section: 'Below deals', note: 'Shares three slots with strip and statement artwork. Lowest order wins across all three placements.', scope: '', limit: 3 },
  'home-strip': { page: 'Home', href: '/', section: 'Below deals — shared row', note: 'This is part of the same three-poster row, not a separate full-width strip.', scope: '', limit: 3 },
  'home-statement': { page: 'Home', href: '/', section: 'Below deals — shared row', note: 'This is part of the same three-poster row, not a separate closing band.', scope: '', limit: 3 },
  hero: { page: 'Products / Offers', href: '/products', section: 'Offers header / division hero', note: 'One poster. Default posters show on Offers; division-specific posters show on that division listing.', scope: 'Division / category name', limit: 1 },
  promo: { page: 'Products / Offers', href: '/products', section: 'Offers promo cards / division promotions', note: 'First three on Offers; first two on division listings. Scoped posters replace defaults for that division.', scope: 'Division / category name', limit: 3 },
  'pdp-offer': { page: 'Product details', href: '/products', section: 'Above product detail tabs', note: 'First five eligible offer cards. Choose a product of the matching brand to see scoped cards.', scope: 'Brand name', limit: 5 },
  'pdp-rail': { page: 'Product details', href: '/products', section: 'Overview tab — right rail', note: 'First three eligible cards. The product rail section must also be enabled in Marketing.', scope: 'Brand name', limit: 3 },
  'brands-hero': { page: 'Brands', href: '/brands', section: 'Top hero', note: 'First eligible poster. The Brands hero section must also be enabled in Marketing.', scope: '', limit: 1 },
  'cart-promo': { page: 'Cart', href: '/cart', section: 'Beside recommendations', note: 'First eligible poster. Shown for a non-empty full cart when recommendations are enabled; not in the embedded cart.', scope: '', limit: 1 },
}
export const HOME_PROMOTION_PLACEMENTS: BannerPlacement[] = ['home-card', 'home-strip', 'home-statement']
