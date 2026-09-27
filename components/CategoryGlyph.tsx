"use client"

import { categoryIcon } from "@/lib/category-icons"

export default function CategoryGlyph({
  label,
  className = "h-6 w-6",
  strokeWidth = 1.5,
}: {
  label?: string
  className?: string
  strokeWidth?: number
}) {
  const Icon = categoryIcon(label)
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />
}
