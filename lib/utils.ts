import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error !== null && typeof error === "object" && "message" in error &&
    typeof error.message === "string" && error.message) return error.message
  return fallback
}
