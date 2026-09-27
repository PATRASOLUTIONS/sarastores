"use client"

import Link from "next/link"
import { INTEGRATIONS, getConnectedIntegrations } from "@/lib/integrations"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import {
  BadgePercent,
  Book,
  BookOpen,
  Boxes,
  ChevronLeft,
  Contact2,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Gift,
  ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Palette,
  QrCode,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Truck,
  Tv,
  UserPlus,
  Users,
} from "lucide-react"
import { useMemo, useState, useEffect } from "react"

interface AdminSidebarProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

interface MenuItem {
  name: string
  path: string
  icon: React.ReactNode
  external?: boolean
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

/**
 * Navigation is grouped by what an admin is trying to do, not by the order the
 * pages happened to be built in. Every live /admin route appears in exactly one
 * section — including ones that previously had no link at all.
 */
const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Overview",
    items: [{ name: "Dashboard", path: "/admin/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> }],
  },
  {
    title: "Catalogue",
    items: [
      { name: "Products", path: "/admin/products", icon: <ShoppingBag className="h-5 w-5" /> },
      { name: "Categories & Brands", path: "/admin/catalogue", icon: <FolderTree className="h-5 w-5" /> },
      { name: "Specifications", path: "/admin/product-specifications", icon: <FileSpreadsheet className="h-5 w-5" /> },
      { name: "Image Coverage", path: "/admin/image-coverage", icon: <ImageIcon className="h-5 w-5" /> },
      { name: "Product Scraper", path: "/admin/scraper", icon: <Download className="h-5 w-5" /> },
      { name: "Software", path: "/admin/software", icon: <Package className="h-5 w-5" /> },
    ],
  },
  {
    title: "Sales",
    items: [
      { name: "Orders", path: "/admin/orders", icon: <FileText className="h-5 w-5" /> },
      { name: "Bulk Order Update", path: "/admin/orders/bulk-update", icon: <ListChecks className="h-5 w-5" /> },
      { name: "External Orders", path: "/admin/external-orders", icon: <Truck className="h-5 w-5" /> },
      { name: "Payments", path: "/admin/payments", icon: <CreditCard className="h-5 w-5" /> },
      { name: "Coupons & Offers", path: "/admin/promotions", icon: <BadgePercent className="h-5 w-5" /> },
      { name: "Employees", path: "/admin/employees", icon: <Users className="h-5 w-5" /> },
    ],
  },
  {
    title: "Customers",
    items: [
      { name: "Customers", path: "/admin/customers", icon: <Users className="h-5 w-5" /> },
      { name: "Leads", path: "/admin/leads", icon: <UserPlus className="h-5 w-5" /> },
      { name: "Complaints", path: "/admin/complaints", icon: <MessageSquare className="h-5 w-5" /> },
      { name: "Contact Inquiries", path: "/admin/contact-inquiries", icon: <Contact2 className="h-5 w-5" /> },
      { name: "Campaigns & Email", path: "/admin/customer-centric", icon: <MessageSquare className="h-5 w-5" /> },
      { name: "Email Templates", path: "/admin/customer-centric/templates", icon: <FileText className="h-5 w-5" /> },
    ],
  },
  {
    title: "Storefront",
    items: [
      { name: "Homepage Sections", path: "/admin/home-components", icon: <Layers className="h-5 w-5" /> },
      { name: "Hero Posters & Slides", path: "/admin/posters", icon: <ImageIcon className="h-5 w-5" /> },
      { name: "Banners & Promos", path: "/admin/listing-banners", icon: <ImageIcon className="h-5 w-5" /> },
      { name: "Theme & Festivals", path: "/admin/theme", icon: <Palette className="h-5 w-5" /> },
      { name: "Site Features", path: "/admin/features", icon: <Star className="h-5 w-5" /> },
      { name: "Product Ads", path: "/admin/product-advertisements", icon: <Layers className="h-5 w-5" /> },
      { name: "Advertisements", path: "/admin/advertisements", icon: <Layers className="h-5 w-5" /> },
      { name: "Custom Pages", path: "/admin/campaign-pages", icon: <Star className="h-5 w-5" /> },
      { name: "Buying Guides", path: "/admin/articles", icon: <BookOpen className="h-5 w-5" /> },
    ],
  },
  {
    title: "Campaigns",
    items: [
      { name: "Spin Wheel", path: "/admin/spin-wheel", icon: <BadgePercent className="h-5 w-5" /> },
      { name: "Spin Campaigns", path: "/admin/spin-wheel/campaigns", icon: <Boxes className="h-5 w-5" /> },
      { name: "Lucky Draw", path: "/admin/lucky-draw", icon: <Gift className="h-5 w-5" /> },
    ],
  },
  {
    title: "Stores",
    items: [
      { name: "Store Locations", path: "/admin/store-locations", icon: <Store className="h-5 w-5" /> },
      { name: "Store QR Codes", path: "/admin/store-qr", icon: <QrCode className="h-5 w-5" /> },
      { name: "QR Analytics", path: "/admin/store-qr/analytics", icon: <QrCode className="h-5 w-5" /> },
      { name: "Blocked Pincodes", path: "/admin/blocked-pincodes", icon: <MapPin className="h-5 w-5" /> },
    ],
  },
  {
    title: "Partners",
    items: [
      { name: "Partners", path: "/admin/partners", icon: <Users className="h-5 w-5" /> },
      { name: "Partner Payouts", path: "/admin/partner-payouts", icon: <CreditCard className="h-5 w-5" /> },
    ],
  },
  {
    title: "System",
    items: [
      { name: "Settings", path: "/admin/settings", icon: <Settings className="h-5 w-5" /> },
      { name: "Documentation", path: "/admin/documentation", icon: <Book className="h-5 w-5" /> },
      {
        name: "OTT Play Dashboard",
        path: "https://ott.systechdigital.co.in/login",
        icon: <Tv className="h-5 w-5" />,
        external: true,
      },
    ],
  },
]

/** Flat list of every internal path, used by the staff permission picker. */
export const ADMIN_MENU_PATHS: { name: string; path: string; section: string }[] = MENU_SECTIONS.flatMap(
  (section) =>
    section.items
      .filter((i) => !i.external)
      .map((i) => ({ name: i.name, path: i.path, section: section.title })),
)

const ExpandButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    className="fixed left-0 top-20 z-50 flex min-w-[28px] items-center justify-center rounded-r-lg bg-gray-800 p-2 text-white shadow-lg transition-all duration-200 hover:bg-gray-700 lg:hidden"
    aria-label="Open sidebar"
  >
    <span className="block h-6 w-1.5 rounded bg-gray-400" aria-hidden="true" />
  </button>
)

export default function AdminSidebar({ isOpen, setIsOpen }: AdminSidebarProps) {
  const pathname = usePathname()
  const { logout, user, isLoading } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [isLaptopCollapsed, setIsLaptopCollapsed] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 1024)
    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  // Longest-prefix wins, so /admin/orders/bulk-update doesn't also light up /admin/orders.
  const activePath = useMemo(() => {
    const candidates = MENU_SECTIONS.flatMap((s) => s.items)
      .filter((i) => !i.external && (pathname === i.path || pathname?.startsWith(`${i.path}/`)))
      .map((i) => i.path)
    return candidates.sort((a, b) => b.length - a.length)[0] ?? null
  }, [pathname])

  const allowedPages: string[] | null = user?.allowedPages ?? null

  const sections = useMemo(() => {
    const term = query.trim().toLowerCase()
    return MENU_SECTIONS.map((section) => {
      let items = section.items

      // While the session is still resolving, leave the menu intact — narrowing it
      // first makes the whole nav flash down to one item and back on every load.
      if (!isLoading) {
        if (Array.isArray(allowedPages) && allowedPages.length > 0) {
          items = items.filter((i) => allowedPages.includes(i.path))
        } else if (user && user.role !== "admin" && user.role !== "superadmin") {
          items = items.filter((i) => i.path === "/admin/dashboard")
        }
      }

      if (term) items = items.filter((i) => i.name.toLowerCase().includes(term))
      return { ...section, items }
    }).filter((section) => section.items.length > 0)
  }, [allowedPages, user, isLoading, query])

  const showText = (isMobile && isOpen) || (!isMobile && !isLaptopCollapsed)
  const handleLinkClick = () => {
    if (isMobile) setIsOpen(false)
  }

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {isMobile && !isOpen && <ExpandButton onClick={() => setIsOpen(true)} />}

      <div
        className={`
          fixed left-0 top-16 h-[calc(100vh-4rem)]
          bg-gray-800 text-white
          transition-all duration-300 ease-in-out
          shadow-xl
          ${isMobile ? (isOpen ? "w-64" : "w-0") : isLaptopCollapsed ? "w-20" : "w-64"}
          ${isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"}
          z-30 flex flex-col overflow-hidden
        `}
      >
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-700 bg-gray-800 p-4">
          <div className="flex items-center">
            <button
              onClick={() => setIsLaptopCollapsed(!isLaptopCollapsed)}
              title={isLaptopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={!isLaptopCollapsed}
              className="rounded p-1 hover:bg-gray-700 focus:outline-none"
            >
              <LayoutGrid className="mr-2 h-8 w-6 flex-shrink-0 text-maroon-400" />
            </button>
            <Link href="/admin/dashboard" className="flex items-center">
              {showText && <h1 className="truncate text-xl font-bold">Admin Panel</h1>}
            </Link>
          </div>
        </div>

        {showText && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a page…"
                aria-label="Filter admin pages"
                className="w-full rounded-lg border border-gray-600 bg-gray-900 py-2 pl-8 pr-2 text-sm text-white placeholder-gray-500 focus:border-gray-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
          {sections.map((section) => (
            <div key={section.title} className="mb-3">
              {showText && (
                <p className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                {section.items.map((item) => (
                  <li key={item.path}>
                    {item.external ? (
                      <a
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleLinkClick}
                        className={`flex items-center rounded-lg px-4 py-2 text-gray-300 transition-colors duration-200 hover:bg-gray-700 hover:text-white ${
                          !showText ? "justify-center" : ""
                        }`}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {showText ? (
                          <span className="ml-3 truncate">{item.name}</span>
                        ) : (
                          <span className="sr-only">{item.name}</span>
                        )}
                      </a>
                    ) : (
                      <Link
                        href={item.path}
                        onClick={handleLinkClick}
                        aria-current={activePath === item.path ? "page" : undefined}
                        className={`flex items-center rounded-lg px-4 py-2 transition-colors duration-200 ${
                          activePath === item.path
                            ? "bg-maroon-700 text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                        } ${!showText ? "justify-center" : ""}`}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {showText ? (
                          <span className="ml-3 truncate">{item.name}</span>
                        ) : (
                          <span className="sr-only">{item.name}</span>
                        )}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {sections.length === 0 && showText && (
            <p className="px-5 text-sm text-gray-400">No pages match “{query}”.</p>
          )}

          {!query && (
            <div className="mb-3">
              {showText && (
                <p className="px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Integrations
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                <li>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIntegrationsOpen(!integrationsOpen)}
                    onKeyDown={(e) => e.key === "Enter" && setIntegrationsOpen(!integrationsOpen)}
                    className={`flex cursor-pointer items-center rounded-lg px-4 py-2 text-gray-300 transition-colors duration-200 hover:bg-gray-700 hover:text-white ${
                      !showText ? "justify-center" : ""
                    }`}
                    aria-expanded={integrationsOpen}
                  >
                    <span className="flex-shrink-0">
                      <Database className="h-5 w-5" />
                    </span>
                    {showText && (
                      <>
                        <span className="ml-3 flex-1 truncate">Connected</span>
                        <span className="ml-2 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-200">
                          {INTEGRATIONS.length}
                        </span>
                        <ChevronLeft
                          className={`ml-auto h-4 w-4 transition-transform ${
                            integrationsOpen ? "rotate-90" : "rotate-0"
                          }`}
                        />
                      </>
                    )}
                  </div>

                  {integrationsOpen && showText && (
                    <ul className="mt-1 space-y-1 pl-2">
                      {getConnectedIntegrations().length === 0 ? (
                        <li className="px-4 py-2 text-sm text-gray-400">No connected integrations</li>
                      ) : (
                        getConnectedIntegrations().map((intg) => (
                          <li key={intg.id}>
                            <Link
                              href={intg.path}
                              onClick={handleLinkClick}
                              className="flex items-center rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              <span className="truncate">{intg.name}</span>
                            </Link>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              </ul>
            </div>
          )}
        </nav>

        <div className="sticky bottom-0 border-t border-gray-700 bg-gray-800 p-4">
          <button
            onClick={() => logout()}
            className={`flex w-full items-center text-gray-300 hover:text-white ${
              !showText ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {showText && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  )
}
