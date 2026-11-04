'use client'
import { bannerIsPhotoOnly, type BannerPlacement, type SiteBanner } from '@/hooks/useBanners'
import { ListingHero, ListingPromoRow } from '@/components/products/ListingBanners'
import { OffersHero, OffersPromotions } from '@/components/products/OffersPresentation'
import { OfferCards, RailCards } from '@/components/product/PdpBlocks'
import LandingHero from '@/components/home/landing/LandingHero'
import { HomepagePromotions } from '@/components/home/landing/HomepageSections'
import BrandsHero from '@/components/brands/BrandsHero'
import CartPromotion from '@/components/cart/CartPromotion'
import homepageStyles from '@/components/home/landing/homepage.module.css'

export default function BannerSectionPreview({ placement, banners, scope = '', homeHero = [], homeSide = [] }: { placement: BannerPlacement; banners: SiteBanner[]; scope?: string; homeHero?: SiteBanner[]; homeSide?: SiteBanner[] }) {
  if (!banners.length) return <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No eligible poster selected for this section.</p>
  switch (placement) {
    case 'hero': return scope ? <ListingHero banner={banners[0]} /> : <OffersHero banner={banners[0]} />
    case 'promo': return scope ? <ListingPromoRow banners={banners} /> : <OffersPromotions banners={banners} onBank={() => {}} onExchange={() => {}} />
    case 'home-hero': return <div className={homepageStyles.homepage}><LandingHero previewBanners={banners} sideBanners={homeSide} /></div>
    case 'home-duo': return banners.length < 2 ? <p className="rounded-xl bg-amber-50 p-4 text-sm">Add a second eligible side banner to display this section.</p> : homeHero[0] && bannerIsPhotoOnly(homeHero[0]) ? <p className="rounded-xl bg-amber-50 p-4 text-sm">The current photo-only main poster hides the side banners. They will appear beside a main poster that includes text.</p> : <div className={homepageStyles.homepage}><LandingHero previewBanners={homeHero} sideBanners={banners} /></div>
    case 'home-card': case 'home-strip': case 'home-statement': return <div className={homepageStyles.homepage}><HomepagePromotions banners={banners} /></div>
    case 'pdp-offer': return <OfferCards offers={banners} />
    case 'pdp-rail': return <div className="max-w-[240px]"><RailCards cards={banners} /></div>
    case 'brands-hero': return <BrandsHero banner={banners[0]} headingId="admin-banner-brands-heading" />
    case 'cart-promo': return <div className="max-w-[320px]"><CartPromotion banner={banners[0]} /></div>
  }
}
