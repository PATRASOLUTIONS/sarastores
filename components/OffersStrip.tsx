"use client"

import Link from "next/link"
import { CreditCard, Banknote, Repeat, BadgePercent } from "lucide-react"
import { motion } from "framer-motion"

interface Promo {
  icon: typeof CreditCard
  title: string
  subtitle: string
  gradient: string
  iconWrap: string
  href: string
}

const PROMOS: Promo[] = [
  {
    icon: CreditCard,
    title: "No Cost EMI",
    subtitle: "On leading bank cards",
    gradient: "from-blue-50 to-white",
    iconWrap: "bg-brand-primary/10 text-brand-primary",
    href: "/products",
  },
  {
    icon: Banknote,
    title: "Up to 12.5% Off",
    subtitle: "Instant bank discounts",
    gradient: "from-emerald-50 to-white",
    iconWrap: "bg-emerald-100 text-emerald-600",
    href: "/products",
  },
  {
    icon: Repeat,
    title: "Free Installation",
    subtitle: "Certified engineers, at home",
    gradient: "from-amber-50 to-white",
    iconWrap: "bg-amber-100 text-amber-600",
    href: "/products",
  },
  {
    icon: BadgePercent,
    title: "Festive Deals",
    subtitle: "Limited-time price drops",
    gradient: "from-rose-50 to-white",
    iconWrap: "bg-rose-100 text-rose-600",
    href: "/products",
  },
]

export default function OffersStrip() {
  return (
    <section className="py-2" aria-label="Offers and payment benefits">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {PROMOS.map((promo, index) => (
          <motion.div
            key={promo.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: 0.05 * index, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={promo.href}
              className={`group flex items-center gap-3 md:gap-4 rounded-2xl border border-brand-border bg-gradient-to-br ${promo.gradient} p-4 md:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.3)]`}
            >
              <div className={`flex h-11 w-11 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl ${promo.iconWrap} group-hover:scale-110 transition-transform duration-300`}>
                <promo.icon className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm md:text-base text-brand-text-primary leading-tight">{promo.title}</p>
                <p className="text-xs md:text-sm text-brand-text-secondary leading-tight mt-0.5">{promo.subtitle}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
