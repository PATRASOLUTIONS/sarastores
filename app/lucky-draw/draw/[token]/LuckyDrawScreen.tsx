"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence, useAnimationControls } from "framer-motion"
import confetti from "canvas-confetti"
import { Users, Gift, Trophy, Mail, AlertCircle, RotateCcw } from "lucide-react"
import GiftBox from "./GiftBox"

type Prize = { name: string; icon: string; quantity: number }
type DrawState = {
  campaign: { name: string; store: string; status: string; prizes: Prize[] }
  stats: { totalParticipants: number; remainingParticipants: number; prizesLeft: number }
  shuffleNames: string[]
  winners: { name: string; phone: string; prize: string; prizeIcon: string; drawnAt: string }[]
}
type DrawResult = {
  winnerId: string
  winner: { name: string; phone: string; email: string }
  prize: { name: string; icon: string }
  stats: { remainingParticipants: number; prizesLeft: number }
}

type Stage = "idle" | "shaking-customer" | "customer-revealed" | "shaking-prize" | "complete"

const SHAKE_MS = 1700
const SETTLE_MS = 400
const REQUEST_TIMEOUT_MS = 12000
const BRAND = ["#e8262a", "#f5c451", "#ffffff", "#ff8a3d"]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Never let a hung request leave the box shaking forever. */
async function postJson(url: string, body?: unknown) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError"
    return { ok: false, data: { error: aborted ? "The draw timed out. Please try again." : "Network error" } }
  } finally {
    clearTimeout(timer)
  }
}

export default function LuckyDrawScreen({ token }: { token: string }) {
  const [state, setState] = useState<DrawState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [result, setResult] = useState<DrawResult | null>(null)
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error: string | null } | null>(null)
  const [ticker, setTicker] = useState("")
  const box = useAnimationControls()
  const tickerTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/lucky-draw/${token}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Draw not found")
      setState(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw not found")
    }
  }, [token])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (tickerTimer.current) clearInterval(tickerTimer.current) }, [])

  const sparkles = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: (i * 37) % 100,
      delay: (i % 7) * 0.9,
      duration: 7 + (i % 5) * 1.6,
      size: 3 + (i % 3),
    })),
    [],
  )

  const burst = (particleCount: number, spread: number) => {
    confetti({ particleCount, spread, origin: { y: 0.55 }, colors: BRAND, ticks: 260, scalar: 1.2 })
  }

  const bigBurst = () => {
    confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: BRAND })
    confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: BRAND })
    confetti({ particleCount: 160, spread: 110, origin: { y: 0.5 }, colors: BRAND, scalar: 1.3, ticks: 320 })
  }

  const runShake = async () => {
    // Timing is driven by sleep, not by the animation promise: the component
    // re-renders on every ticker tick, which can leave that promise unresolved.
    box.start({
      rotate: [0, -3, 3, -5, 5, -8, 8, -11, 11, -13, 13, -9, 9, -5, 5, 0],
      x: [0, -8, 8, -13, 13, -18, 18, -24, 24, -26, 26, -18, 18, -10, 10, 0],
      y: [0, 3, -3, 6, -6, 9, -9, 12, -12, 9, -9, 6, -6, 3, -3, 0],
      scale: [1, 1.02, 1, 1.04, 1, 1.06, 1, 1.08, 1, 1.09, 1, 1.06, 1, 1.03, 1, 1],
      transition: { duration: SHAKE_MS / 1000, ease: "easeInOut" },
    })
    await sleep(SHAKE_MS)

    box.start({ scale: [1, 1.22, 0.94, 1], transition: { duration: SETTLE_MS / 1000, ease: "backOut" } })
    await sleep(SETTLE_MS)
  }

  const startTicker = (pool: string[]) => {
    if (!pool.length) return
    let i = 0
    tickerTimer.current = setInterval(() => {
      i = (i + 1) % pool.length
      setTicker(pool[i])
    }, 70)
  }
  const stopTicker = () => {
    if (tickerTimer.current) clearInterval(tickerTimer.current)
    tickerTimer.current = null
  }

  const shakeForCustomer = async () => {
    if (!state || stage !== "idle") return
    setError(null)
    setEmailStatus(null)
    setStage("shaking-customer")
    startTicker(state.shuffleNames.length ? state.shuffleNames : ["…"])

    const [res] = await Promise.all([
      postJson(`/api/lucky-draw/${token}/draw`),
      runShake(),
    ])

    stopTicker()

    if (!res.ok) {
      setError((res.data as any)?.error || "Draw failed")
      setStage("idle")
      setTicker("")
      box.start({ rotate: 0, x: 0, y: 0, scale: 1 })
      return
    }

    setResult(res.data as DrawResult)
    setTicker((res.data as DrawResult).winner.name)
    setStage("customer-revealed")
    burst(110, 80)
  }

  const shakeForPrize = async () => {
    if (stage !== "customer-revealed" || !result) return
    setStage("shaking-prize")
    startTicker(state?.campaign.prizes.map((p) => `${p.icon}  ${p.name}`) ?? ["🎁"])

    // Fired, not awaited: SMTP latency must never hold up the animation.
    postJson(`/api/lucky-draw/${token}/notify`, { winnerId: result.winnerId }).then((notify) => {
      setEmailStatus({
        sent: !!(notify.data as any)?.emailSent,
        error: (notify.data as any)?.emailError ?? (notify.ok ? null : "Email could not be sent"),
      })
    })

    await runShake()
    stopTicker()
    setStage("complete")
    bigBurst()
    setTimeout(bigBurst, 400)
  }

  const reset = async () => {
    setResult(null)
    setEmailStatus(null)
    setTicker("")
    setStage("idle")
    box.start({ rotate: 0, x: 0, y: 0, scale: 1 })
    load()
  }

  if (error && !state) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0a0608] text-white p-6">
        <div className="text-center">
          <AlertCircle className="h-14 w-14 mx-auto text-red-400 mb-4" />
          <h1 className="text-2xl font-semibold">{error}</h1>
          <p className="text-white/50 text-sm mt-2">Check the draw link and try again.</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0a0608] text-white">
        <div className="animate-pulse tracking-[0.3em] text-xs uppercase text-amber-300/70">Loading draw…</div>
      </div>
    )
  }

  const isShaking = stage === "shaking-customer" || stage === "shaking-prize"
  const canDraw =
    state.campaign.status === "active" && state.stats.remainingParticipants > 0 && state.stats.prizesLeft > 0

  const caption =
    !canDraw && state.campaign.status !== "active" ? "This draw is not active yet"
      : !canDraw ? "No participants or prizes remaining"
      : stage === "idle" ? "Tap the box to shake"
      : stage === "shaking-customer" ? "Picking a customer…"
      : stage === "customer-revealed" ? "Tap again to reveal the prize"
      : stage === "shaking-prize" ? "Choosing the prize…"
      : "Draw complete"

  return (
    <div className="relative h-screen overflow-hidden bg-[#0a0608] text-white">
      {/* ---------- backdrop ---------- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(232,38,42,.32),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_115%,rgba(245,196,81,.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_38%,rgba(0,0,0,.75))]" />
        {sparkles.map((s) => (
          <motion.span
            key={s.id}
            className="absolute rounded-full bg-amber-200/70"
            style={{ left: `${s.left}%`, width: s.size, height: s.size }}
            initial={{ y: "105vh", opacity: 0 }}
            animate={{ y: "-10vh", opacity: [0, 1, 1, 0] }}
            transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex h-full max-w-6xl flex-col px-6 py-[clamp(.75rem,2vh,1.75rem)]">
        {/* ---------- header ---------- */}
        <header className="text-center">
          <p className="text-[clamp(.65rem,1vw,.8rem)] uppercase tracking-[0.45em] text-amber-300/85">
            {state.campaign.store}
          </p>
          <h1 className="mt-2 bg-gradient-to-b from-white via-amber-100 to-amber-400 bg-clip-text text-[clamp(1.6rem,4.4vw,3.4rem)] font-black leading-[1.05] tracking-tight text-transparent">
            {state.campaign.name}
          </h1>
          <div className="mx-auto mt-3 h-px w-40 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: Users, label: "Eligible", value: state.stats.remainingParticipants },
              { icon: Gift, label: "Prizes left", value: state.stats.prizesLeft },
              { icon: Trophy, label: "Drawn", value: state.winners.length },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-white/[.04] px-4 py-2 backdrop-blur"
              >
                <Icon className="h-4 w-4 text-amber-300" />
                <span className="text-[clamp(1rem,1.8vw,1.4rem)] font-bold tabular-nums">{value}</span>
                <span className="text-[clamp(.6rem,.9vw,.75rem)] uppercase tracking-[0.2em] text-white/45">{label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ---------- stage ---------- */}
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center py-1">
          <motion.button
            onClick={stage === "idle" ? shakeForCustomer : stage === "customer-revealed" ? shakeForPrize : undefined}
            disabled={!canDraw || isShaking || stage === "complete"}
            whileHover={canDraw && !isShaking && stage !== "complete" ? { scale: 1.03 } : undefined}
            whileTap={canDraw && !isShaking && stage !== "complete" ? { scale: 0.97 } : undefined}
            animate={
              canDraw && (stage === "idle" || stage === "customer-revealed") ? { y: [0, -10, 0] } : { y: 0 }
            }
            transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
            className="relative outline-none disabled:cursor-default"
            aria-label="Shake the box"
          >
            <GiftBox controls={box} isShaking={isShaking} isOpen={stage === "complete"} />
          </motion.button>

          <motion.p
            key={caption}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-[clamp(.8rem,1.4vw,1.1rem)] font-medium tracking-wide text-white/70"
          >
            {caption}
          </motion.p>

          {/* ---------- ticker / reveal ---------- */}
          <div className="mt-4 w-full max-w-3xl">
            <AnimatePresence mode="wait">
              {(isShaking || ticker) && stage !== "complete" && (
                <motion.div
                  key={stage === "shaking-prize" ? "prize-ticker" : "customer-ticker"}
                  initial={{ opacity: 0, y: 18, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.95 }}
                  transition={{ duration: 0.22 }}
                  className="relative overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-gradient-to-b from-white/[.09] to-white/[.02] px-8 py-5 text-center backdrop-blur-xl"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
                  <p className="text-[clamp(.6rem,.9vw,.75rem)] uppercase tracking-[0.4em] text-amber-300/80">
                    {stage === "shaking-prize" ? "Prize" : "Customer"}
                  </p>
                  <motion.p
                    key={ticker}
                    initial={{ opacity: 0.4, y: 8, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.12 }}
                    className={`mt-3 font-black leading-tight ${
                      stage === "customer-revealed"
                        ? "bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent text-[clamp(1.9rem,4.5vw,3.5rem)]"
                        : "text-white text-[clamp(1.4rem,3.2vw,2.5rem)]"
                    }`}
                  >
                    {ticker}
                  </motion.p>
                </motion.div>
              )}

              {stage === "complete" && result && (
                <motion.div
                  key="final"
                  initial={{ opacity: 0, scale: 0.88, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 210, damping: 17 }}
                  className="relative overflow-hidden rounded-[2rem] border border-amber-300/40 bg-gradient-to-b from-amber-400/[.16] via-white/[.05] to-red-600/[.12] px-8 py-6 text-center backdrop-blur-xl shadow-[0_30px_90px_-30px_rgba(245,196,81,.5)]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

                  <motion.div
                    initial={{ scale: 0.4, rotate: -18 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 190, damping: 11, delay: 0.1 }}
                    className="text-[clamp(2.5rem,6vw,4rem)] leading-none"
                  >
                    {result.prize.icon}
                  </motion.div>

                  <p className="mt-2 text-[clamp(.55rem,.85vw,.7rem)] uppercase tracking-[0.45em] text-amber-200/90">
                    Winner
                  </p>
                  <p className="mt-1 bg-gradient-to-b from-white via-amber-100 to-amber-400 bg-clip-text text-[clamp(1.8rem,4.8vw,3.4rem)] font-black leading-[1.05] tracking-tight text-transparent">
                    {result.winner.name}
                  </p>
                  <p className="mt-1 text-[clamp(.75rem,1.2vw,1rem)] tabular-nums text-white/55">
                    {result.winner.phone}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <span className="inline-flex items-center gap-3 rounded-full border border-amber-300/40 bg-amber-300/10 px-6 py-2.5 text-[clamp(.9rem,1.8vw,1.35rem)] font-bold">
                      <span>{result.prize.icon}</span>
                      <span>{result.prize.name}</span>
                    </span>
                  </div>

                  <p
                    className={`mt-3 flex items-center justify-center gap-2 text-[clamp(.7rem,1vw,.85rem)] ${
                      emailStatus === null
                        ? "text-white/50"
                        : emailStatus.sent
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    {emailStatus === null
                      ? "Sending email…"
                      : emailStatus.sent
                      ? `Email sent to ${result.winner.email}`
                      : emailStatus.error || "Email not sent"}
                  </p>

                  <button
                    onClick={reset}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-200 to-amber-400 px-7 py-2.5 text-[clamp(.85rem,1.3vw,1.05rem)] font-bold text-[#3a2405] transition hover:from-amber-100 hover:to-amber-300"
                  >
                    <RotateCcw className="h-5 w-5" /> Draw the next winner
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {error && stage === "idle" && (
              <p className="mt-6 text-center text-[clamp(.85rem,1.3vw,1rem)] text-red-300">{error}</p>
            )}
          </div>
        </main>

        {/* ---------- winners strip ---------- */}
        {state.winners.length > 0 && stage !== "complete" && (
          <footer className="pb-2">
            <p className="text-center text-[clamp(.6rem,.85vw,.72rem)] uppercase tracking-[0.4em] text-white/35">
              Winners so far
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {state.winners.slice(0, 10).map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[.05] px-4 py-2 text-[clamp(.75rem,1.1vw,.9rem)] backdrop-blur"
                >
                  <span className="font-semibold">{w.name}</span>
                  <span className="text-amber-300/90">{w.prizeIcon} {w.prize}</span>
                </div>
              ))}
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
