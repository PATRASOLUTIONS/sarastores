"use client"

import useSWR from "swr"
import { defaultMarketingContent, marketingDefinition, marketingResponseSchema, type MarketingPage, type MarketingResponse } from "@/lib/marketing-content"

const URL = "/api/marketing-content"
async function fetchContent(url: string): Promise<MarketingResponse> {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Marketing content could not be loaded. Please try again.")
  return marketingResponseSchema.parse(await response.json())
}

export function useMarketingContent(page: MarketingPage) {
  const { data, error, mutate } = useSWR<MarketingResponse>(URL, fetchContent, {
    refreshInterval: 30000, revalidateOnFocus: true, shouldRetryOnError: false,
    onError: (cause: unknown) => console.error("[Marketing] Content loading failed:", cause),
  })
  const section = (key: string) => {
    const definition = marketingDefinition(page, key)
    if (!definition) throw new Error(`Unknown marketing section: ${page}/${key}`)
    const defaults = defaultMarketingContent(definition)
    const saved = data?.sections.find(item => item.page === page && item.section === key)
    return saved ? { ...defaults, ...saved, values: { ...defaults.values, ...saved.values } } : defaults
  }
  const text = (key: string, field: string, fallback?: string): string => {
    const saved = data?.sections.find(item => item.page === page && item.section === key)?.values[field]
    return saved ?? fallback ?? section(key).values[field] ?? ""
  }
  const image = (key: string, field: string, fallback: string) => text(key, field) || fallback
  const items = <T extends { title: string; detail?: string; href?: string; image?: string }>(key: string, defaults: T[]): T[] =>
    defaults.map((item, index) => ({
      ...item,
      title: text(key, `item${index + 1}Title`, item.title),
      ...(item.detail !== undefined ? { detail: text(key, `item${index + 1}Detail`, item.detail) } : {}),
      ...(item.href !== undefined ? { href: text(key, `item${index + 1}Href`) || item.href } : {}),
      ...(item.image !== undefined ? { image: text(key, `item${index + 1}Image`) || item.image } : {}),
    }))
  return { section, text, image, items, enabled: (key: string) => section(key).enabled,
    order: (key: string) => section(key).order, error, retry: () => void mutate() }
}
