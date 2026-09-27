"use client"

import { Truck, ShieldCheck, RotateCcw, Lock } from "lucide-react"
import { motion } from "framer-motion"
import { durations, easings } from "@/lib/animations"

// One brand colour across all four items — four different hues read as noise.
const trustItems = [
  {
    icon: Truck,
    title: "Free Delivery",
    subtitle: "On orders over ₹1,000",
    color: "text-brand-primary",
    bg: "bg-brand-primary-light",
  },
  {
    icon: ShieldCheck,
    title: "Genuine Products",
    subtitle: "100% authentic items",
    color: "text-brand-primary",
    bg: "bg-brand-primary-light",
  },
  {
    icon: RotateCcw,
    title: "Quality Assured",
    subtitle: "Verified & tested products",
    color: "text-brand-primary",
    bg: "bg-brand-primary-light",
  },
  {
    icon: Lock,
    title: "Secure Payment",
    subtitle: "SSL encrypted checkout",
    color: "text-brand-primary",
    bg: "bg-brand-primary-light",
  },
]

export default function TrustBar() {
  return (
    <motion.section
      className="border-y border-brand-border bg-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durations.normal, delay: 0.2, ease: easings.power3Out }}
    >
      <div className="section-container py-4 md:py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {trustItems.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 group"
            >
              <div
                className={`flex-shrink-0 w-10 h-10 md:w-11 md:h-11 ${item.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
              >
                <item.icon className={`h-5 w-5 md:h-5.5 md:w-5.5 ${item.color}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm md:text-base text-brand-text-primary leading-tight">
                  {item.title}
                </p>
                <p className="text-xs md:text-sm text-brand-text-tertiary leading-tight mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
