import { profileAvatarSvg } from "@/lib/profile-avatars"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!/^(?:[1-9]|1\d|20)$/.test(id)) return new Response("Avatar not found", { status: 404 })
  return new Response(profileAvatarSvg(Number(id) - 1), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  })
}
