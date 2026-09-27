import { redirect } from "next/navigation"

export default function CategoriesPage() {
  redirect("/admin/catalogue?tab=categories")
}
