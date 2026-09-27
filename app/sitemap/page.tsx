import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { pageMetadata } from "@/lib/seo-page"
import { findMany } from "@/lib/db-service"
import { titleCaseLabel } from "@/lib/product-display"

export const revalidate = 600

export const generateMetadata = pageMetadata({
  path: "/sitemap",
  title: (brand) => `Sitemap | ${brand}`,
  description: "Every page on the SARA website in one place — shop, customer service, company and legal.",
})

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "All Products" },
      { href: "/brands", label: "Brands" },
      { href: "/offers", label: "Offers & Savings" },
      { href: "/software", label: "Software" },
      { href: "/compare", label: "Compare Products" },
      { href: "/search", label: "Search" },
      { href: "/rewards", label: "SARA Rewards" },
      { href: "/spin", label: "Spin & Win" },
    ],
  },
  {
    title: "Customer Service",
    links: [
      { href: "/track", label: "Track Order" },
      { href: "/returns", label: "Returns & Refunds" },
      { href: "/emi", label: "EMI Options" },
      { href: "/shipping-policy", label: "Shipping Policy" },
      { href: "/warranty", label: "Warranty" },
      { href: "/installation", label: "Installation Support" },
      { href: "/faq", label: "Help & FAQs" },
      { href: "/complaints", label: "Raise a Complaint" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  {
    title: "About SARA",
    links: [
      { href: "/about", label: "Our Story" },
      { href: "/stores", label: "Our Stores" },
      { href: "/store-locator", label: "Store Locator" },
      { href: "/careers", label: "Careers" },
      { href: "/business-enquiries", label: "Business Enquiries" },
      { href: "/press", label: "Press & Media" },
      { href: "/blog", label: "Blog / Buying Guides" },
      { href: "/corporate-information", label: "Corporate Information" },
      { href: "/brand-guidelines", label: "Brand Guidelines" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms-and-conditions", label: "Terms & Conditions" },
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/cancellation-policy", label: "Cancellation Policy" },
      { href: "/returns", label: "Return Policy" },
      { href: "/shipping-policy", label: "Shipping Policy" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
  {
    title: "Your Account",
    links: [
      { href: "/login", label: "Sign In" },
      { href: "/register", label: "Create Account" },
      { href: "/account/profile", label: "Profile" },
      { href: "/account/orders", label: "Your Orders" },
      { href: "/account/preferences", label: "Email Preferences" },
      { href: "/cart", label: "Cart" },
      { href: "/wishlist", label: "Wishlist" },
    ],
  },
]

export default async function SitemapPage() {
  // Categories come from the admin catalogue so this page never drifts from it.
  const [categories, subCategories] = await Promise.all([
    findMany("categories", {}).catch(() => []),
    findMany("sub_categories", {}).catch(() => []),
  ])

  const categoryLinks = (categories as any[])
    .filter((c) => c?.name && !/^test\d*$/i.test(String(c.name)))
    .map((c) => ({ href: `/category/${c.id ?? c._id}`, label: titleCaseLabel(String(c.name)) }))

  const subCategoryLinks = (subCategories as any[])
    .filter((s) => s?.name && s?.active !== false && !/^test\d*$/i.test(String(s.name)))
    .map((s) => ({
      href: `/products?subCategory=${encodeURIComponent(String(s.name))}`,
      label: titleCaseLabel(String(s.name)),
    }))

  const groups = [
    ...GROUPS,
    ...(categoryLinks.length > 0 ? [{ title: "Categories", links: categoryLinks }] : []),
    ...(subCategoryLinks.length > 0 ? [{ title: "Sub-Categories", links: subCategoryLinks }] : []),
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-grow bg-gray-50">
        <section className="bg-gradient-to-br from-brand-hero-from via-brand-hero-via to-brand-hero-to text-white">
          <div className="section-container py-12 md:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Legal</p>
            <h1 className="mt-3 font-heading text-3xl font-bold md:text-4xl">Sitemap</h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300">
              Every page on the SARA website in one place. The machine-readable version lives at{" "}
              <a href="/sitemap.xml" className="underline">
                /sitemap.xml
              </a>
              .
            </p>
          </div>
        </section>

        <div className="section-container grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ title, links }) => (
            <section key={title} className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
              <h2 className="font-heading text-base font-bold text-brand-text-primary">{title}</h2>
              <ul className="mt-4 space-y-2">
                {links.map((link, i) => (
                  <li key={`${link.href}-${i}`}>
                    <Link href={link.href} className="text-sm text-brand-text-secondary hover:text-brand-primary hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
