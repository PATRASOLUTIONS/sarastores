"use client"

import type { ReactNode } from "react"
import { Check, ChevronDown } from "lucide-react"
import styles from "./checkout.module.css"

export default function CheckoutSection({ id, number, title, summary, expanded, completed, disabled = false, onToggle, children }: {
  id: string; number: number; title: string; summary?: string; expanded: boolean; completed: boolean
  disabled?: boolean; onToggle: () => void; children: ReactNode
}) {
  return <section className={`${styles.panel} ${styles.checkoutSection}`} aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>
      <button type="button" className={styles.sectionToggle} aria-expanded={expanded} aria-controls={`${id}-content`}
        disabled={disabled} onClick={onToggle}>
        <span className={`${styles.stepNumber} ${completed ? styles.completedNumber : ""}`}>
          {completed ? <Check size={15} aria-label="Completed" /> : number}
        </span>
        <span className={styles.stepLabel}><strong>{title}</strong>{!expanded && summary && <small>{summary}</small>}</span>
        <ChevronDown size={18} aria-hidden="true" className={expanded ? styles.expandedChevron : undefined} />
      </button>
    </h2>
    <div id={`${id}-content`} hidden={!expanded} className={styles.stepContent}>{children}</div>
  </section>
}
