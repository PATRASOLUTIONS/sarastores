import { GET as getPublicIndex } from "../llms.txt/route"

export const revalidate = 3600
export const dynamic = "force-dynamic"

export async function GET() {
  return getPublicIndex()
}
