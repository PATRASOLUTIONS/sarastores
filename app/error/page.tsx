import { redirect } from "next/navigation"

// This route used to render a full Microsoft Azure portal mock — logo, fake
// correlation ID and a Microsoft copyright line — on a public retail domain.
// It is kept only as a redirect so any existing link still lands somewhere sane.
export default function ErrorRoute() {
  redirect("/")
}
