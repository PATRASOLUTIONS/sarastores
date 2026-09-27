"use client"

import { useState } from "react"
import { ShoppingCart, Plus, Minus, Check, Loader2 } from "lucide-react"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { useCartUI } from "@/contexts/CartUIContext"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"

interface Product {
  id: string
  slug?: string
  name: string
  price: number
  image: string
  stock: number
  color?: string
  size?: string
  category?: string
  description?: string
}

interface AddToCartButtonProps {
  product: Product
  quantity?: number
  showQuantitySelector?: boolean
  className?: string
  selectedColor?: string
  selectedSize?: string
}

export default function AddToCartButton({
  product,
  quantity: initialQuantity = 1,
  showQuantitySelector = false,
  className = "",
  selectedColor = "",
  selectedSize = "",
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(initialQuantity)
  const [isAdding, setIsAdding] = useState(false)
  const { cart, addToCart, updateQuantity } = useCart()
  const { isAuthenticated } = useAuth()
  const { openCart, setLastAddedId } = useCartUI()
  const router = useRouter()

  const cartItem = cart.find(
    (item) => 
      item.id === product.id && 
      (item.color || "") === selectedColor && 
      (item.size || "") === selectedSize
  )

  const isInCart = !!cartItem

  const handleAddToCart = async () => {
    if (product.stock === 0) {
      toast.error("Product is out of stock")
      return
    }

    setIsAdding(true)
    try {
      const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity,
        color: selectedColor,
        size: selectedSize,
        stock: product.stock,
      }

      if (isInCart && cartItem) {
        await updateQuantity(cartItem.id, (cartItem.quantity || 0) + quantity)
      } else {
        await addToCart(cartItem)
      }

      toast.success(`${quantity} ${product.name} added to cart!`)

      // Open the side cart so the user can review the new line item
      // (with the "Just added" highlight), adjust qty, or proceed to buy.
      setLastAddedId(product.id)
      openCart()

      // Reset quantity if using quantity selector
      if (showQuantitySelector) {
        setQuantity(1)
      }
    } catch (error) {
      console.error("Error adding to cart:", error)
      toast.error("Failed to add item to cart. Please try again.")
    } finally {
      setIsAdding(false)
    }
  }

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity > 0 && newQuantity <= product.stock) {
      setQuantity(newQuantity)
    }
  }

  if (showQuantitySelector) {
    return (
      <div className={`flex flex-col space-y-2 ${className}`}>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={quantity <= 1}
            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center" aria-live="polite" aria-label={`Quantity: ${quantity}`}>{quantity}</span>
          <button
            onClick={() => handleQuantityChange(quantity + 1)}
            disabled={quantity >= product.stock}
            className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={isAdding || product.stock === 0}
          className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-brand-accent rounded-md hover:bg-brand-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent/40 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
        >
          {isAdding ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </span>
          ) : isInCart ? (
            <span className="flex items-center">
              <Check className="mr-2 h-4 w-4" />
              Update Cart
            </span>
          ) : (
            <span className="flex items-center">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={isAdding || product.stock === 0 || isInCart}
      className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-accent rounded-md hover:bg-brand-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent/40 disabled:opacity-50 transition-all duration-200 active:scale-[0.98] ${className}`}
    >
      {isAdding ? (
        <span className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Adding...
        </span>
      ) : isInCart ? (
        <span className="flex items-center">
          <Check className="mr-2 h-4 w-4" />
          Added to Cart
        </span>
      ) : (
        <span className="flex items-center">
          <ShoppingCart className="mr-2 h-4 w-4" />
          {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </span>
      )}
    </button>
  )
}
