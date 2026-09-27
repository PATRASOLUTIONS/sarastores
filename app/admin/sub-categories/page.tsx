import { redirect } from "next/navigation"

export default function SubCategoriesPage() {
  redirect("/admin/catalogue?tab=subcategories")
}
