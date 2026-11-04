'use client'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Star, Tag } from 'lucide-react'
import SiteImage from '@/components/SiteImage'
import { bannerGradient, bannerIsPhotoOnly, type SiteBanner } from '@/hooks/useBanners'
import { useMarketingContent } from '@/hooks/useMarketingContent'
import styles from '@/app/brands/brands.module.css'

const POINTS = [{ icon: ShieldCheck, title: 'Genuine', detail: 'Products' }, { icon: Tag, title: 'Explore', detail: 'Brand Offers' }, { icon: Star, title: 'Wide Range', detail: 'Across Categories' }]
export default function BrandsHero({ banner, headingId = 'brands-hero-heading' }: { banner?: SiteBanner; headingId?: string }) {
  const marketing = useMarketingContent('brands')
  const photo = !!banner && bannerIsPhotoOnly(banner)
  return <section className={`${styles.hero} ${banner ? styles.customHero : ''} ${banner && !banner.dark ? styles.lightText : ''} ${photo ? styles.photoHero : ''}`} style={banner && !photo ? bannerGradient(banner) : undefined} aria-labelledby={headingId}>
    <SiteImage src={banner?.image || marketing.text('hero', 'image')} alt="Electronics and home appliances from leading brands" className={photo ? styles.heroPhoto : styles.heroImage} />
    {photo ? <h1 id={headingId} className="sr-only">Brands at SARA</h1> : <div className={styles.heroContent}>
      <h1 id={headingId} className="font-heading whitespace-pre-line">{banner?.title || marketing.text('hero', 'title')}</h1>
      <p>{banner?.subtitle || marketing.text('hero', 'description')}</p>
      <ul className={styles.heroPoints}>{marketing.items('hero', POINTS).map(({ icon: Icon, title, detail }) => <li key={title}><Icon strokeWidth={1.6} /><span>{title}<br />{detail}</span></li>)}</ul>
      {banner?.ctaText && banner.ctaLink && <Link href={banner.ctaLink} className={styles.heroCta}>{banner.ctaText}<ArrowRight size={14} /></Link>}
    </div>}
  </section>
}
