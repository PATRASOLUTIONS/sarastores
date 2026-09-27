"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Loader2, Palette, Power, RotateCcw, Save, Sparkles } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"
import { upcomingOccasions } from "@/lib/marketing/occasions"
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  themeToCssVars,
  type Theme,
  type ThemeEffect,
  type ThemeIntensity,
  type ThemePattern,
  type ThemeTokens,
} from "@/lib/theme"

const TOKEN_GROUPS: { label: string; keys: (keyof ThemeTokens)[] }[] = [
  { label: "Brand", keys: ["primary", "primaryHover", "primaryLight", "primarySubtle"] },
  { label: "Accent", keys: ["accent", "accentHover", "glow"] },
  { label: "Hero gradient", keys: ["heroFrom", "heroVia", "heroTo"] },
  { label: "Sale ribbon", keys: ["ribbon", "ribbonText"] },
  { label: "Surfaces", keys: ["surface", "surfaceRaised", "border", "borderHover"] },
  { label: "Text", keys: ["textPrimary", "textSecondary", "textTertiary"] },
  { label: "Status", keys: ["success", "warning"] },
]

const TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
  primary: "Primary",
  primaryHover: "Primary (hover)",
  primaryLight: "Primary light",
  primarySubtle: "Primary subtle",
  accent: "Accent",
  accentHover: "Accent (hover)",
  surface: "Page background",
  surfaceRaised: "Card background",
  textPrimary: "Heading text",
  textSecondary: "Body text",
  textTertiary: "Muted text",
  border: "Border",
  borderHover: "Border (hover)",
  success: "Success",
  warning: "Warning",
  heroFrom: "Gradient start",
  heroVia: "Gradient middle",
  heroTo: "Gradient end",
  glow: "Glow",
  ribbon: "Ribbon background",
  ribbonText: "Ribbon text",
}

const EFFECTS: { value: ThemeEffect; label: string }[] = [
  { value: "none", label: "None" },
  { value: "confetti", label: "Confetti" },
  { value: "diyas", label: "Floating diyas" },
  { value: "petals", label: "Flower petals" },
  { value: "marigold", label: "Marigold & modak — Ganesh" },
  { value: "rockets", label: "Rockets & bursts — Diwali" },
  { value: "colours", label: "Gulal splash — Holi" },
  { value: "coins", label: "Gold coins — Dhanteras" },
  { value: "hearts", label: "Hearts — Valentine's" },
  { value: "crescent", label: "Crescents & stars — Eid" },
  { value: "moonlight", label: "Moonlit dust — Purnima" },
  { value: "tricolour", label: "Tricolour ribbons — Independence" },
  { value: "dandiya", label: "Dandiya sticks — Navratri" },
  { value: "leaves", label: "Mango leaves — Ugadi & Onam" },
  { value: "snow", label: "Snowfall" },
  { value: "sparkles", label: "Sparkles" },
  { value: "fireworks", label: "Fireworks" },
]

const INTENSITIES: { value: ThemeIntensity; label: string; hint: string }[] = [
  { value: "subtle", label: "Subtle", hint: "Colour only — everyday trading" },
  { value: "festive", label: "Festive", hint: "Taller bands, visible ornament" },
  { value: "grand", label: "Grand", hint: "Full treatment for flagship festivals" },
]

const PATTERNS: { value: ThemePattern; label: string }[] = [
  { value: "none", label: "None" },
  { value: "rangoli", label: "Rangoli dots" },
  { value: "floral", label: "Floral" },
  { value: "geometric", label: "Geometric" },
  { value: "lights", label: "String lights" },
  { value: "rays", label: "Sun rays" },
]

/** ISO string ⇄ the local value a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function describeSchedule(startsAt: string | null, endsAt: string | null) {
  const now = Date.now()
  const start = startsAt ? new Date(startsAt).getTime() : null
  const end = endsAt ? new Date(endsAt).getTime() : null

  if (start && now < start) {
    return { tone: "upcoming" as const, label: `Scheduled — starts ${new Date(start).toLocaleString("en-IN")}` }
  }
  if (end && now > end) {
    return { tone: "expired" as const, label: `Expired — default theme is showing` }
  }
  return { tone: "live" as const, label: "Live now" }
}

export default function AdminThemePage() {
  const [theme, setTheme] = useState<Theme | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Only occasions we actually ship a palette for are worth offering as a shortcut.
  const upcoming = useMemo(
    () =>
      upcomingOccasions()
        .map((occasion) => ({
          occasion,
          preset: THEME_PRESETS.find((p) => p.occasionKey === occasion.key),
        }))
        .filter((row): row is { occasion: typeof row.occasion; preset: Theme } => Boolean(row.preset)),
    [],
  )

  useEffect(() => {
    apiFetch("/api/theme")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setTheme(data.theme)
      })
      .catch(() => toast.error("Could not load the current theme"))
      .finally(() => setLoading(false))
  }, [])

  // Paint the editor's own preview with whatever is being edited.
  useEffect(() => {
    if (!theme) return
    const style = document.createElement("style")
    style.innerHTML = themeToCssVars(theme).replace(":root", "[data-theme-preview]")
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [theme])

  const setToken = (key: keyof ThemeTokens, value: string) => {
    setTheme((prev) => (prev ? { ...prev, tokens: { ...prev.tokens, [key]: value } } : prev))
  }

  const handleSave = async () => {
    if (!theme) return
    setSaving(true)
    try {
      const res = await apiFetch("/api/theme", { method: "PUT", json: { theme } })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || "Could not save the theme")
        return
      }
      toast.success("Theme applied across the storefront")
    } catch {
      toast.error("Could not save the theme")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading theme…
      </p>
    )
  }

  if (!theme) return <p className="p-6 text-sm text-gray-600">Could not load the theme.</p>

  const scheduleState = describeSchedule(theme.startsAt, theme.endsAt)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Palette className="h-6 w-6" />
            Storefront theme
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Colours here drive the entire storefront — header, buttons, badges, gradients and
            effects. Pick a festival preset or fine-tune any token, then apply.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTheme({ ...DEFAULT_THEME })
              toast("Switched to Sara Default — press Apply to publish it")
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Power className="h-4 w-4" />
            Turn festival off
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Apply to storefront
          </button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <CalendarClock className="h-4 w-4" />
            Coming up this month and next
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            Dates for lunar festivals move each year, so confirm the exact day before scheduling.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {upcoming.map(({ occasion, preset }) => (
              <button
                key={occasion.key}
                type="button"
                onClick={() => setTheme({ ...preset })}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:border-amber-500"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: preset.tokens.primary }}
                />
                {occasion.label}
                {occasion.approximate && <span className="font-normal text-amber-700">approx.</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Festival presets</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTheme({ ...preset })}
              className={`rounded-xl border p-3 text-left transition-shadow hover:shadow-md ${
                theme.id === preset.id ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"
              }`}
            >
              <span
                className="block h-10 w-full rounded-lg"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${preset.tokens.heroFrom}, ${preset.tokens.heroVia}, ${preset.tokens.heroTo})`,
                }}
              />
              <span className="mt-2 block text-sm font-semibold text-gray-900">{preset.name}</span>
              <span className="block text-xs text-gray-500">{preset.occasion}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Announcement bar</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-gray-700">
                Message (leave blank to hide)
                <input
                  value={theme.announcement}
                  onChange={(e) => setTheme({ ...theme, announcement: e.target.value })}
                  placeholder="Diwali Dhamaka — up to 60% off"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Link
                <input
                  value={theme.announcementLink}
                  onChange={(e) => setTheme({ ...theme, announcementLink: e.target.value })}
                  placeholder="/offers"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Sparkles className="h-4 w-4" />
              Effect &amp; shape
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-gray-700">
                Festival effect
                <select
                  value={theme.effect}
                  onChange={(e) => setTheme({ ...theme, effect: e.target.value as ThemeEffect })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {EFFECTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-700">
                Corner radius — {theme.radius.toFixed(2)}rem
                <input
                  type="range"
                  min={0}
                  max={1.75}
                  step={0.05}
                  value={theme.radius}
                  onChange={(e) => setTheme({ ...theme, radius: Number(e.target.value) })}
                  className="mt-3 w-full accent-gray-900"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Background pattern
                <select
                  value={theme.pattern}
                  onChange={(e) => setTheme({ ...theme, pattern: e.target.value as ThemePattern })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {PATTERNS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="mt-4">
              <legend className="text-sm text-gray-700">Festive intensity</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {INTENSITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme({ ...theme, intensity: option.value })}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      theme.intensity === option.value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        theme.intensity === option.value ? "text-gray-300" : "text-gray-500"
                      }`}
                    >
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-sm text-gray-700">Decorations</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={theme.toran}
                    onChange={(e) => setTheme({ ...theme, toran: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-gray-900"
                  />
                  <span>
                    <span className="block font-semibold text-gray-900">Hanging garland</span>
                    <span className="block text-xs text-gray-500">
                      Toran across the hero. Needs Grand intensity.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={theme.blessing}
                    onChange={(e) => setTheme({ ...theme, blessing: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-gray-900"
                  />
                  <span>
                    <span className="block font-semibold text-gray-900">Ganesh blessing</span>
                    <span className="block text-xs text-gray-500">
                      Arrives every 90s for 7s. Ganesh theme only.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <p className="mt-3 text-xs text-gray-500">
              Intensity changes layout as well as colour — band height, glow strength and how much
              ornament shows. Effects are decorative only and switch off automatically for visitors
              who prefer reduced motion.
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <CalendarClock className="h-4 w-4" />
              Schedule
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Queue a festival in advance. Outside this window the storefront falls back to the
              default theme automatically — no one has to remember to switch it off.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-gray-700">
                Starts
                <input
                  type="datetime-local"
                  value={toLocalInput(theme.startsAt)}
                  onChange={(e) =>
                    setTheme({ ...theme, startsAt: fromLocalInput(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Ends
                <input
                  type="datetime-local"
                  value={toLocalInput(theme.endsAt)}
                  onChange={(e) => setTheme({ ...theme, endsAt: fromLocalInput(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {(theme.startsAt || theme.endsAt) && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    scheduleState.tone === "live"
                      ? "bg-green-50 text-green-700"
                      : scheduleState.tone === "upcoming"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {scheduleState.label}
                </span>
                <button
                  type="button"
                  onClick={() => setTheme({ ...theme, startsAt: null, endsAt: null })}
                  className="text-xs font-medium text-gray-600 hover:underline"
                >
                  Clear schedule
                </button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Colour tokens</h2>
              <button
                type="button"
                onClick={() => setTheme({ ...THEME_PRESETS[0] })}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to default
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {group.label}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.keys.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <input
                          type="color"
                          value={theme.tokens[key]}
                          onChange={(e) => setToken(key, e.target.value)}
                          aria-label={TOKEN_LABELS[key]}
                          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <span className="flex-1 text-sm text-gray-700">{TOKEN_LABELS[key]}</span>
                        <input
                          value={theme.tokens[key]}
                          onChange={(e) => setToken(key, e.target.value)}
                          className="w-24 rounded border border-gray-200 px-2 py-1 font-mono text-xs uppercase"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div
            data-theme-preview
            className="overflow-hidden rounded-2xl border border-gray-200"
            style={{ backgroundColor: theme.tokens.surface }}
          >
            {theme.announcement && (
              <div className="themed-ribbon px-4 py-2 text-center text-xs font-semibold">
                {theme.announcement}
              </div>
            )}

            <div
              className="px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: theme.tokens.primary }}
            >
              Sara Electronics
            </div>

            <div className="relative overflow-hidden themed-hero themed-glow px-5 py-10 text-white">
              <div className="relative z-10">
                <p className="text-xs uppercase tracking-widest opacity-80">Preview</p>
                <p className="mt-2 text-2xl font-extrabold leading-tight">
                  Big savings on{" "}
                  <span className="themed-text-gradient">home appliances</span>
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: theme.tokens.accent }}
                >
                  Shop now
                </button>
              </div>
            </div>

            <div className="p-4">
              <div
                className="overflow-hidden border p-3"
                style={{
                  backgroundColor: theme.tokens.surfaceRaised,
                  borderColor: theme.tokens.border,
                  borderRadius: `${theme.radius}rem`,
                }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: theme.tokens.ribbon,
                      color: theme.tokens.ribbonText,
                    }}
                  >
                    32% OFF
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: theme.tokens.textPrimary }}>
                  55&quot; 4K Smart TV
                </p>
                <p className="text-xs" style={{ color: theme.tokens.textSecondary }}>
                  EMI from ₹1,999/month
                </p>
                <p className="mt-1 text-lg font-extrabold" style={{ color: theme.tokens.textPrimary }}>
                  ₹42,990
                </p>
                <button
                  type="button"
                  className="mt-3 w-full py-2 text-xs font-bold text-white"
                  style={{
                    backgroundColor: theme.tokens.primary,
                    borderRadius: `${Math.max(theme.radius - 0.15, 0)}rem`,
                  }}
                >
                  Add to cart
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Live preview. Nothing changes on the storefront until you press
            &ldquo;Apply&rdquo;.
          </p>
        </aside>
      </div>
    </div>
  )
}
