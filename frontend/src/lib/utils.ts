import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind class names cleanly with collision resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric value into standard Indian Rupee notation (e.g. ₹ 4,50,000 or ₹ 1.50).
 */
export function formatINR(amount: number): string {
  const hasDecimals = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Safely parses a UTC date string into a Date object, handling naive strings from SQLite.
 */
export function parseUtcDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  let s = dateStr.trim();
  if (!s.endsWith("Z") && !s.includes("+") && !/[0-9]{2}:[0-9]{2}:[0-9]{2}-[0-9]{2}/.test(s)) {
    s = s.replace(" ", "T") + "Z";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats standard ISO date string into human-friendly format (e.g. 24 Oct 2026).
 */
export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}
