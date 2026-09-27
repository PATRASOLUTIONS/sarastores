import { redirect } from "next/navigation"

// The real wishlist lives in the customer dashboard.
export default function WishlistPage() {
  redirect("/dashboard/wishlist")
}
