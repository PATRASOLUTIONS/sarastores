import { redirect } from "next/navigation"

export default function BrandsPage() {
  redirect("/admin/catalogue?tab=brands")
}
