"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/session";
import { signOutAction } from "@/app/(app)/actions";

type NavItem = { href: string; label: string; financeOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Today" },
  { href: "/issue", label: "Issue" },
  { href: "/receipt", label: "Receipt" },
  { href: "/karigars", label: "Karigars" },
  { href: "/jobs", label: "Jobs" },
  { href: "/alerts", label: "Loss alerts", financeOnly: true },
  { href: "/stock", label: "Stock", financeOnly: true },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.financeOnly || user.role === "FINANCE_HEAD");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:px-5 md:py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gold text-xs font-semibold text-white">
              KL
            </span>
            <span className="text-sm font-semibold tracking-tight">Karigar Ledger</span>
          </Link>
          <form action={signOutAction} className="md:hidden">
            <button className="text-xs text-ink-soft underline-offset-2 hover:underline">Sign out</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-0">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${
                  active ? "bg-gold-soft font-medium text-ink" : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-line px-5 py-4 md:absolute md:bottom-0 md:block md:w-full">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-ink-faint">
            {user.role === "FINANCE_HEAD" ? "Finance head" : "Issue clerk"}
          </p>
          <form action={signOutAction} className="mt-2">
            <button className="text-xs text-ink-soft underline-offset-2 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
