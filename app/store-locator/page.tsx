import { StoreLocator } from "@/components/store-locator";
import { StoreJsonLd } from "./StoreJsonLd";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <StoreJsonLd />
      <StoreLocator />
    </main>
  )
}