import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SiteImage from '@/components/SiteImage'
import CartProductImage from '@/components/CartProductImage'
import { bannerGradient, bannerIsPhotoOnly, type SiteBanner } from '@/hooks/useBanners'
import styles from '@/app/cart/cart.module.css'

export default function CartPromotion({ banner }: { banner: SiteBanner }) {
  if (bannerIsPhotoOnly(banner)) return <aside className={styles.shopCard}>
    {banner.ctaLink ? <Link href={banner.ctaLink}><SiteImage src={banner.image} alt="" className="block h-auto w-full" /></Link> : <SiteImage src={banner.image} alt="" className="block h-auto w-full" />}
  </aside>
  return <aside className={styles.shopCard} style={{ ...bannerGradient(banner), color: banner.dark ? '#071331' : '#fff' }}>
    {banner.image && <CartProductImage src={banner.image} name={banner.title} />}
    <h3>{banner.title}</h3>{banner.subtitle && <p>{banner.subtitle}</p>}
    {banner.ctaText && banner.ctaLink && <Link href={banner.ctaLink}>{banner.ctaText} <ArrowRight size={13} /></Link>}
  </aside>
}
