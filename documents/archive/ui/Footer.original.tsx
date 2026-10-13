"use client"

import Link from "next/link"
import Image from "next/image"
import { Facebook, Instagram, Mail, Phone, MapPin, ArrowRight, Shield, Truck, CreditCard, Headphones } from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"

export default function Footer() {
  const { data, isLoading, error } = useSettingsData()

  // Fallbacks for missing data
  const companyName = data?.storeName || "Sara Mobiles and Electronics "
  const companyDescription = data?.storeDescription || "From Everyday Essentials to Premium Products — We’ve Got It All."
  const address = data?.storeAddress || "123 Shopping Street, Retail City, RC 10001"
  const phone = data?.storePhone || "(123) 456-7890"
  const email = data?.storeEmail || "info@Sara Mobiles and Electronics .com"
  const brandLogo = data?.brandLogo || null
  const signature = data?.signature || null

  return (
    <footer className="bg-gradient-to-b from-brand-primary to-brand-primary-hover text-white relative overflow-hidden">
      {/* Trust Badges Section */}
      <div className="border-b border-white/10">
        <div className="section-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-white/10 ring-1 ring-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm md:text-base">Free Shipping</p>
                <p className="text-gray-400 text-xs md:text-sm">On orders over ₹1,000</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-white/10 ring-1 ring-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm md:text-base">Secure Payments</p>
                <p className="text-gray-400 text-xs md:text-sm">100% secure checkout</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-white/10 ring-1 ring-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm md:text-base">Quality Assured</p>
                <p className="text-gray-400 text-xs md:text-sm">Verified & tested products</p>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-white/10 ring-1 ring-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Headphones className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm md:text-base">10:00 AM to 6:00 PM</p>
                <p className="text-gray-400 text-xs md:text-sm">Dedicated support</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="section-container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <h3 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
              <Image src="/Sara_Electronics_logo.png" alt="Sara Electronics" width={112} height={80} className="w-20 h-14 md:w-28 md:h-20 object-contain" />
              {/* <span className="text-brand-primary">Sara</span>
              <span className="text-white">Mobiles & Electronics</span> */}
            </h3>
            <p className="text-gray-400 mb-6 leading-relaxed">{companyDescription}</p>
            <div className="flex gap-3">
              <a href="#" aria-label="Facebook" className="w-11 h-11 bg-white/10 hover:bg-brand-accent rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" aria-label="X" className="w-11 h-11 bg-white/10 hover:bg-black rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="w-11 h-11 bg-white/10 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <nav aria-label="Quick Links">
            <h3 className="text-lg font-heading font-bold mb-5 text-white">Shop</h3>
            <ul className="space-y-1">
              {[
                { href: "/products", label: "All Products" },
                { href: "/brands", label: "Shop by Brand" },
                { href: "/offers", label: "Offers & Deals" },
                { href: "/ganesh", label: "Ganesh Chaturthi Offers" },
                { href: "/software", label: "Software" },
                { href: "/rewards", label: "Sara Rewards" },
              ].map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href} 
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group py-2"
                  >
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-brand-accent" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Information */}
          <nav aria-label="Information">
            <h3 className="text-lg font-heading font-bold mb-5 text-white">Company &amp; Help</h3>
            <ul className="space-y-1">
              {[
                { href: "/about", label: "About Us" },
                { href: "/stores", label: "Store Locations" },
                { href: "/blog", label: "Buying Guides" },
                { href: "/contact", label: "Contact Us" },
                { href: "/faq", label: "FAQ" },
                { href: "/complaints", label: "Complaints" },
                { href: "/privacy-policy", label: "Privacy Policy" },
                { href: "/terms-and-conditions", label: "Terms & Conditions" },
              ].map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href} 
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group py-2"
                  >
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-brand-accent" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-heading font-bold mb-5 text-white">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 group">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-brand-accent transition-colors">
                  <MapPin className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors text-sm">{address}</span>
              </li>
              <li className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-brand-accent transition-colors">
                  <Phone className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors">{phone}</span>
              </li>
              <li className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-brand-accent transition-colors">
                  <Mail className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors text-sm truncate">{email}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 bg-black/20">
        <div className="section-container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <span className="text-gray-400">&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</span>
            <nav className="flex items-center gap-4" aria-label="Legal">
              <Link href="/privacy-policy" className="text-gray-400 hover:text-white text-sm py-1">Privacy Policy</Link>
              <span className="hidden sm:inline text-white/30">|</span>
              <Link href="/terms-and-conditions" className="text-gray-400 hover:text-white text-sm py-1">Terms</Link>
              <Link href="/credits" className="text-gray-400 hover:text-white text-sm py-1 hidden sm:inline">Credits</Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
    </footer>
  )
}
