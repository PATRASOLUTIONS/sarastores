"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { User, Menu, X, ChevronDown, ShoppingCart, LayoutDashboard } from "lucide-react"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const pathname = usePathname()
  const { cart } = useCart()
  const { user, logout } = useAuth()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen)
  }

  const closeMenus = () => {
    setIsMenuOpen(false)
    setIsUserMenuOpen(false)
  }

  const handleLogout = () => {
    logout()
    closeMenus()
  }

  const cartItemCount = isClient ? cart.reduce((total, item) => total + item.quantity, 0) : 0

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center" onClick={closeMenus}>
            <span className="text-2xl font-bold text-blue-800">E-Comm</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <Link
              href="/"
              className={`${
                isActive("/") ? "text-blue-800 font-semibold" : "text-gray-600 hover:text-blue-800"
              } transition-colors`}
              onClick={closeMenus}
            >
              Home
            </Link>
            <Link
              href="/products"
              className={`${
                isActive("/products") ? "text-blue-800 font-semibold" : "text-gray-600 hover:text-blue-800"
              } transition-colors`}
              onClick={closeMenus}
            >
              Products
            </Link>
            <Link
              href="/about"
              className={`${
                isActive("/about") ? "text-blue-800 font-semibold" : "text-gray-600 hover:text-blue-800"
              } transition-colors`}
              onClick={closeMenus}
            >
              About
            </Link>
            <Link
              href="/contact"
              className={`${
                isActive("/contact") ? "text-blue-800 font-semibold" : "text-gray-600 hover:text-blue-800"
              } transition-colors`}
              onClick={closeMenus}
            >
              Contact
            </Link>
          </div>

          {/* User Actions */}
          <div className="hidden md:flex items-center space-x-6">
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={toggleUserMenu}
                className="flex items-center text-gray-600 hover:text-blue-800 focus:outline-none"
              >
                <User className="h-5 w-5 mr-1" />
                <span>{user ? user.name.split(" ")[0] : "Account"}</span>
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={closeMenus}
                      >
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Dashboard
                      </Link>
                      <Link
                        href="/dashboard/orders"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={closeMenus}
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/dashboard/wishlist"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={closeMenus}
                      >
                        My Wishlist
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={closeMenus}
                      >
                        Login
                      </Link>
                      <Link
                        href="/register"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={closeMenus}
                      >
                        Register
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2 text-gray-700 hover:text-blue-800 transition-colors"
              aria-label="View cart"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-800 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-4">
            <Link
              href="/cart"
              className="relative p-2 text-gray-700 hover:text-blue-800 transition-colors"
              aria-label="View cart"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-800 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>
            <button onClick={toggleMenu} className="text-gray-600 hover:text-blue-800 focus:outline-none">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col space-y-3">
              <Link
                href="/"
                className={`${isActive("/") ? "text-blue-800 font-semibold" : "text-gray-600"} py-2`}
                onClick={closeMenus}
              >
                Home
              </Link>
              <Link
                href="/products"
                className={`${isActive("/products") ? "text-blue-800 font-semibold" : "text-gray-600"} py-2`}
                onClick={closeMenus}
              >
                Products
              </Link>
              <Link
                href="/about"
                className={`${isActive("/about") ? "text-blue-800 font-semibold" : "text-gray-600"} py-2`}
                onClick={closeMenus}
              >
                About
              </Link>
              <Link
                href="/contact"
                className={`${isActive("/contact") ? "text-blue-800 font-semibold" : "text-gray-600"} py-2`}
                onClick={closeMenus}
              >
                Contact
              </Link>
              <div className="border-t border-gray-200 pt-3 mt-3">
                {user ? (
                  <>
                    <Link href="/dashboard" className="flex items-center py-2 text-gray-600" onClick={closeMenus}>
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Dashboard
                    </Link>
                    <Link href="/dashboard/orders" className="block py-2 text-gray-600" onClick={closeMenus}>
                      My Orders
                    </Link>
                    <Link href="/dashboard/wishlist" className="block py-2 text-gray-600" onClick={closeMenus}>
                      My Wishlist
                    </Link>
                    <button onClick={handleLogout} className="block w-full text-left py-2 text-gray-600">
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block py-2 text-gray-600" onClick={closeMenus}>
                      Login
                    </Link>
                    <Link href="/register" className="block py-2 text-gray-600" onClick={closeMenus}>
                      Register
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
