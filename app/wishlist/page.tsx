import Header from "@/components/Header"
import Footer from "@/components/Footer"
import WishlistContents from "@/components/WishlistContents"

export default function WishlistPage() {
  return <div className="flex min-h-screen flex-col">
    <Header />
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <WishlistContents />
    </main>
    <Footer />
  </div>
}
