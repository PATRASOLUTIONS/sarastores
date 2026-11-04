import AdminGift from '@/components/diwali/AdminGift'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <AdminGift section="detail" claimId={(await params).id} /> }

