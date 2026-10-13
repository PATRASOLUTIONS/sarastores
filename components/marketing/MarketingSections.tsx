"use client"

import { Children, isValidElement, type ReactNode } from "react"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import type { MarketingPage } from "@/lib/marketing-content"

export function MarketingSection({ page, section, children }: { page: MarketingPage; section: string; children: ReactNode }) {
  const marketing = useMarketingContent(page)
  return marketing.enabled(section) ? <>{children}</> : null
}

export function MarketingSections({ page, children, showStatus = true }: { page: MarketingPage; children: ReactNode; showStatus?: boolean }) {
  const marketing = useMarketingContent(page)
  const sections = Children.toArray(children)
  const order = (child: ReactNode) => isValidElement<{ section?: string }>(child) && child.props.section
    ? marketing.order(child.props.section) : -1
  return <>{showStatus && marketing.error && <MarketingStatus page={page} />}
    {sections.sort((a, b) => order(a) - order(b))}
  </>
}

export function MarketingStatus({ page }: { page: MarketingPage }) {
  const marketing = useMarketingContent(page)
  return marketing.error ? <p role="alert" className="my-2 px-4 text-xs text-amber-800">
    Updated page content is temporarily unavailable. <button type="button" onClick={marketing.retry} className="underline">Retry page content</button>
  </p> : null
}
