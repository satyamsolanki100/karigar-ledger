import Decimal from "decimal.js";
import { formatGrams, formatPct } from "@/lib/gold/fine-gold";

export const WORKSHOP_TZ = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: WORKSHOP_TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: WORKSHOP_TZ,
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: WORKSHOP_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const fmtDate = (d: Date) => dateFmt.format(d);
export const fmtDateTime = (d: Date) => dateTimeFmt.format(d);
export const fmtTime = (d: Date) => timeFmt.format(d);

export const g = (v: Decimal.Value) => formatGrams(v);
export const pct = (v: Decimal.Value) => formatPct(v);

/** Signed grams for differences: "+0.595" or "-0.120". */
export function signedGrams(v: Decimal.Value): string {
  const d = new Decimal(v);
  return (d.greaterThan(0) ? "+" : "") + formatGrams(d);
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const fmtInr = (v: number | string) => inr.format(Number(v));

/** Calendar day boundaries in the workshop's time zone. */
export function dayBoundsIst(dateIso: string): { start: Date; end: Date } {
  const [y, m, d] = dateIso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, -5, -30));
  const end = new Date(start.getTime() + 86_400_000 - 1);
  return { start, end };
}

export function todayIsoIst(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: WORKSHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

export const ENTRY_LABEL: Record<string, string> = {
  VAULT_OPENING: "Opening stock",
  ISSUE: "Issue",
  RECEIPT_PIECE: "Receipt, piece",
  RECEIPT_SCRAP: "Receipt, scrap",
  RECEIPT_FILINGS: "Receipt, filings",
  REFINER_OUT: "To refiner",
  REFINER_IN: "From refiner",
};
