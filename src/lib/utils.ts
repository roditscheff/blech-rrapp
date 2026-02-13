import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Schweizer Standard: Datum und Zeit (z.B. 20.02.2026, 16:00) */
export function formatDateTimeCH(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
  })
}
