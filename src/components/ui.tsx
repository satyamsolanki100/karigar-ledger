import Link from "next/link";
import type Decimal from "decimal.js";
import { formatGrams } from "@/lib/gold/fine-gold";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="text-sm font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

type Tone = "neutral" | "gold" | "ok" | "warn" | "bad";
const toneClass: Record<Tone, string> = {
  neutral: "bg-paper text-ink-soft",
  gold: "bg-gold-soft text-gold",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

/** Grams rendered with aligned decimals. `tone` colors the figure; `size` for balances that must stand out. */
export function Grams({
  value,
  tone,
  size = "md",
  signed = false,
}: {
  value: Decimal.Value;
  tone?: Tone;
  size?: "sm" | "md" | "lg" | "xl";
  signed?: boolean;
}) {
  const text = formatGrams(value);
  const positive = !text.startsWith("-") && text !== "0.000";
  const sizeClass = { sm: "text-sm", md: "text-sm", lg: "text-lg font-semibold", xl: "text-2xl font-semibold" }[size];
  const color = tone ? { neutral: "text-ink-soft", gold: "text-gold", ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone] : "";
  return (
    <span className={`num whitespace-nowrap ${sizeClass} ${color}`}>
      {signed && positive ? "+" : ""}
      {text}
      <span className="ml-0.5 text-[0.75em] font-normal text-ink-faint">g</span>
    </span>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, num = false, className = "" }: { children?: React.ReactNode; num?: boolean; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line px-4 py-2 text-xs font-medium text-ink-faint ${num ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, num = false, className = "" }: { children?: React.ReactNode; num?: boolean; className?: string }) {
  return <td className={`border-b border-line px-4 py-2.5 align-middle ${num ? "text-right" : ""} ${className}`}>{children}</td>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export const btnPrimary =
  "inline-flex items-center justify-center rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center rounded-md border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center rounded-md border border-bad/30 bg-surface px-3.5 py-2 text-sm font-medium text-bad transition hover:bg-bad-soft disabled:opacity-60";
export const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:bg-paper disabled:text-ink-soft";
export const numInputClass = `${inputClass} num text-right`;

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

export function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium text-ink-faint">{label}</p>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
      {message}
    </p>
  );
}
