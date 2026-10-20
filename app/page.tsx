import SaraLanding from "@/components/home/SaraLanding"

/*
 * The grand-opening curtain is retired.
 *
 * components/home/EcommerceLaunch.tsx rendered a full-screen overlay that also
 * set `body { overflow: hidden }`, so the homepage was unusable until the
 * ceremony finished or the visitor clicked through. It only remembered being
 * dismissed in localStorage, keyed by the launch timestamp — so a new browser,
 * a private window, another device, or any change to HANDSHAKE_LAUNCH_AT
 * brought it straight back.
 *
 * Turning it off by clearing the environment variable was not enough: the
 * variable is still set in the hosting environment, and anyone re-adding it
 * would reopen the curtain. Not passing `launch` at all is the off switch that
 * cannot be undone by configuration. The component and lib/handshake.ts are
 * left in place, so restoring the ceremony is one prop away.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#EEF2F7]">
      <SaraLanding />
    </div>
  )
}
