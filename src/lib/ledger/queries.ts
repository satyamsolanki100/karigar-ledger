import Decimal from "decimal.js";
import { db } from "@/lib/db";
import type { Location } from "@/generated/prisma/enums";
import { grams, runningBalance, ZERO } from "@/lib/gold/fine-gold";

const RECEIPT_TYPES = ["RECEIPT_PIECE", "RECEIPT_SCRAP", "RECEIPT_FILINGS"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

export function isReceipt(type: string): type is ReceiptType {
  return (RECEIPT_TYPES as readonly string[]).includes(type);
}

export type KarigarBalance = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  balance: Decimal;
  openJobs: number;
  lastEntryAt: Date | null;
};

/** Fine gold each karigar holds right now (or held at the end of `asOf`). */
export async function karigarBalances(asOf?: Date): Promise<KarigarBalance[]> {
  const until = asOf ? { occurredAt: { lte: asOf } } : {};
  const [karigars, out, back, openJobs, last] = await Promise.all([
    db.karigar.findMany({ orderBy: { code: "asc" } }),
    db.ledgerEntry.groupBy({
      by: ["karigarId"],
      where: { toLocation: "KARIGAR", ...until },
      _sum: { fineWeight: true },
    }),
    db.ledgerEntry.groupBy({
      by: ["karigarId"],
      where: { fromLocation: "KARIGAR", ...until },
      _sum: { fineWeight: true },
    }),
    db.job.groupBy({ by: ["karigarId"], where: { status: "OPEN" }, _count: true }),
    db.ledgerEntry.groupBy({
      by: ["karigarId"],
      where: { karigarId: { not: null }, ...until },
      _max: { occurredAt: true },
    }),
  ]);
  const sum = (rows: typeof out, id: string) =>
    new Decimal(rows.find((r) => r.karigarId === id)?._sum.fineWeight?.toString() ?? 0);

  return karigars.map((k) => ({
    id: k.id,
    code: k.code,
    name: k.name,
    active: k.active,
    balance: grams(sum(out, k.id).minus(sum(back, k.id))),
    openJobs: openJobs.find((r) => r.karigarId === k.id)?._count ?? 0,
    lastEntryAt: last.find((r) => r.karigarId === k.id)?._max.occurredAt ?? null,
  }));
}

export type LedgerLine = Awaited<ReturnType<typeof karigarLedger>>["lines"][number];

/** A karigar's slips in date order with the running fine-gold balance after each one. */
export async function karigarLedger(karigarId: string, opts: { from?: Date; to?: Date } = {}) {
  const where = {
    karigarId,
    ...(opts.from || opts.to ? { occurredAt: { gte: opts.from, lte: opts.to } } : {}),
  };
  const [opening, entries] = await Promise.all([
    opts.from
      ? db.ledgerEntry.findMany({
          where: { karigarId, occurredAt: { lt: opts.from } },
          select: { fineWeight: true, toLocation: true },
        })
      : Promise.resolve([]),
    db.ledgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: "asc" }, { txnNumber: "asc" }],
      include: { job: { select: { jobNumber: true, description: true } } },
    }),
  ]);
  const openingBalance = opening.reduce(
    (total, e) => (e.toLocation === "KARIGAR" ? total.plus(e.fineWeight.toString()) : total.minus(e.fineWeight.toString())),
    ZERO,
  );
  const balances = runningBalance(
    entries.map((e) => ({ fine: e.fineWeight.toString(), direction: e.toLocation === "KARIGAR" ? "OUT" : "IN" })),
    openingBalance,
  );
  return {
    openingBalance: grams(openingBalance),
    lines: entries.map((e, i) => ({ ...e, balanceAfter: balances[i] })),
    closingBalance: balances.length ? balances[balances.length - 1] : grams(openingBalance),
  };
}

export type StockStatement = {
  asOf: Date;
  vault: Decimal;
  withKarigars: Decimal;
  atRefiner: Decimal;
  total: Decimal;
  perKarigar: KarigarBalance[];
  dayMovements: { issued: Decimal; received: Decimal; toRefiner: Decimal; fromRefiner: Decimal };
};

/** Brief: "a daily stock statement of gold in vault, with karigars and at the refiner". */
export async function stockStatement(asOf: Date, dayStart: Date): Promise<StockStatement> {
  const locationBalance = async (location: Location) => {
    const [inflow, outflow] = await Promise.all([
      db.ledgerEntry.aggregate({ where: { toLocation: location, occurredAt: { lte: asOf } }, _sum: { fineWeight: true } }),
      db.ledgerEntry.aggregate({ where: { fromLocation: location, occurredAt: { lte: asOf } }, _sum: { fineWeight: true } }),
    ]);
    return grams(new Decimal(inflow._sum.fineWeight?.toString() ?? 0).minus(outflow._sum.fineWeight?.toString() ?? 0));
  };
  const dayTotal = async (types: string[]) => {
    const row = await db.ledgerEntry.aggregate({
      where: { type: { in: types as never }, occurredAt: { gte: dayStart, lte: asOf } },
      _sum: { fineWeight: true },
    });
    return grams(row._sum.fineWeight?.toString() ?? 0);
  };

  const [vault, withKarigars, atRefiner, perKarigar, issued, received, toRefiner, fromRefiner] =
    await Promise.all([
      locationBalance("VAULT"),
      locationBalance("KARIGAR"),
      locationBalance("REFINER"),
      karigarBalances(asOf),
      dayTotal(["ISSUE"]),
      dayTotal([...RECEIPT_TYPES]),
      dayTotal(["REFINER_OUT"]),
      dayTotal(["REFINER_IN"]),
    ]);

  return {
    asOf,
    vault,
    withKarigars,
    atRefiner,
    total: grams(vault.plus(withKarigars).plus(atRefiner)),
    perKarigar,
    dayMovements: { issued, received, toRefiner, fromRefiner },
  };
}
