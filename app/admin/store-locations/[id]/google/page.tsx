import { StoreGoogleDetails } from "./store-google-details"

export default async function StoreGoogleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StoreGoogleDetails storeId={id} />
}
