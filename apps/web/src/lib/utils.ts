import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function money(value: number, compact = false) {
  if (compact) {
    if (Math.abs(value) >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`;
    if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function relativeDate(value: string) {
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Today";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}
