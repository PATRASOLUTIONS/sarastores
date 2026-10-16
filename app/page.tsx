import SaraLanding from "@/components/home/SaraLanding"
import { readHandshakeLaunch } from "@/lib/handshake"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#EEF2F7]">
      <SaraLanding launch={readHandshakeLaunch()} />
    </div>
  )
}
