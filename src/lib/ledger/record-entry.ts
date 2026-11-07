import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import type { EntryType } from "@/generated/prisma/enums";
import { fineWeight, grams, percent } from "@/lib/gold/fine-gold";
import { nextJobNumber, nextTxnNumber } from "./txn-number";
import { settleAndCloseJob } from "./settle-job";

type Tx = Prisma.TransactionClient;

/** A rule broke; the message is safe to show the clerk. */
export class LedgerError extends Error {}

export type JobChoice = { kind: "existing"; jobId: string } | { kind: "new"; categoryId: string; description: string };

export type ReceiptKind = Extract<EntryType, "RECEIPT_PIECE" | "RECEIPT_SCRAP" | "RECEIPT_FILINGS">;

/**
 * Brief: "a mismatch with a typed value blocks saving". When a slip is backed by a photo
 * reading, the typed weight (and purity, if the photo had one) must equal what was read.
 */
async function confirmReading(tx: Tx, readingId: string, gross: Decimal, purity: Decimal, actorId: string) {
  const reading = await tx.scaleReading.findUnique({ where: { id: readingId }, include: { entry: true } });
  if (!reading) throw new LedgerError("The photo reading was not found. Take the photo again.");
  if (reading.entry) throw new LedgerError("That photo reading is already attached to another slip.");
  if (reading.status === "REJECTED") throw new LedgerError("That photo reading was rejected. Take the photo again.");
  if (reading.readWeight && !grams(reading.readWeight.toString()).equals(gross)) {
    throw new LedgerError(
      `Typed weight ${gross.toFixed(3)} g differs from the photo reading ${grams(reading.readWeight.toString()).toFixed(3)} g. Fix one before saving.`,
    );
  }
  if (reading.readPurityPct && !percent(reading.readPurityPct.toString()).equals(purity)) {
    throw new LedgerError(
      `Typed purity ${purity.toFixed(2)} % differs from the photo reading ${percent(reading.readPurityPct.toString()).toFixed(2)} %. Fix one before saving.`,
    );
  }
  await tx.scaleReading.update({ where: { id: readingId }, data: { status: "CONFIRMED", confirmedById: actorId } });
}

export async function recordIssue(
  tx: Tx,
  input: {
    actorId: string;
    karigarId: string;
    job: JobChoice;
    grossWeight: Decimal;
    purityPct: Decimal;
    note?: string;
    readingId?: string;
    occurredAt?: Date;
  },
) {
  const karigar = await tx.karigar.findUnique({ where: { id: input.karigarId } });
  if (!karigar) throw new LedgerError("Karigar not found.");
  if (!karigar.active) throw new LedgerError(`${karigar.name} is inactive. Gold cannot be issued.`);

  const gross = grams(input.grossWeight);
  const purity = percent(input.purityPct);
  if (gross.lessThanOrEqualTo(0)) throw new LedgerError("Gross weight must be above zero.");

  let job;
  if (input.job.kind === "existing") {
    job = await tx.job.findUnique({ where: { id: input.job.jobId } });
    if (!job) throw new LedgerError("Job not found.");
    if (job.karigarId !== karigar.id) throw new LedgerError("That job belongs to another karigar.");
    if (job.status !== "OPEN") throw new LedgerError(`${job.jobNumber} is closed. Open a new job instead.`);
  } else {
    const allowance = await tx.karigarAllowance.findUnique({
      where: { karigarId_categoryId: { karigarId: karigar.id, categoryId: input.job.categoryId } },
      include: { category: true },
    });
    if (!allowance) throw new LedgerError("No agreed wastage for this karigar and item. Ask the finance head to set it.");
    job = await tx.job.create({
      data: {
        jobNumber: await nextJobNumber(tx),
        karigarId: karigar.id,
        categoryId: input.job.categoryId,
        description: input.job.description.trim() || allowance.category.name,
        allowedPct: allowance.allowedWastagePct,
        openedAt: input.occurredAt ?? new Date(),
      },
    });
  }

  if (input.readingId) await confirmReading(tx, input.readingId, gross, purity, input.actorId);

  const entry = await tx.ledgerEntry.create({
    data: {
      txnNumber: await nextTxnNumber(tx),
      type: "ISSUE",
      fromLocation: "VAULT",
      toLocation: "KARIGAR",
      karigarId: karigar.id,
      jobId: job.id,
      grossWeight: gross.toFixed(3),
      purityPct: purity.toFixed(2),
      fineWeight: fineWeight(gross, purity).toFixed(3),
      note: input.note?.trim() || null,
      occurredAt: input.occurredAt ?? new Date(),
      enteredById: input.actorId,
      readingId: input.readingId ?? null,
    },
  });

  await tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: "issue.recorded",
      entityType: "LedgerEntry",
      entityId: entry.id,
      details: { txnNumber: entry.txnNumber, jobNumber: job.jobNumber, fine: entry.fineWeight.toString(), photo: Boolean(input.readingId) },
    },
  });

  return { entry, job };
}

export async function recordReceipt(
  tx: Tx,
  input: {
    actorId: string;
    jobId: string;
    kind: ReceiptKind;
    grossWeight: Decimal;
    purityPct: Decimal;
    huid?: string;
    note?: string;
    readingId?: string;
    closeJob: boolean;
    occurredAt?: Date;
  },
) {
  const job = await tx.job.findUnique({ where: { id: input.jobId }, include: { karigar: true, entries: true } });
  if (!job) throw new LedgerError("Job not found.");
  if (job.status !== "OPEN") throw new LedgerError(`${job.jobNumber} is already closed.`);

  const gross = grams(input.grossWeight);
  const purity = percent(input.purityPct);
  if (gross.lessThanOrEqualTo(0)) throw new LedgerError("Weight must be above zero.");
  const fine = fineWeight(gross, purity);

  const issued = job.entries.filter((e) => e.type === "ISSUE").reduce((t, e) => t.plus(e.fineWeight.toString()), new Decimal(0));
  const received = job.entries
    .filter((e) => e.type !== "ISSUE")
    .reduce((t, e) => t.plus(e.fineWeight.toString()), new Decimal(0));
  if (issued.isZero()) throw new LedgerError(`${job.jobNumber} has no issue yet.`);
  // Allow a little over for purity rounding, but a receipt well above what went out is a typing slip.
  if (received.plus(fine).greaterThan(issued.mul("1.02"))) {
    throw new LedgerError(
      `Receiving ${fine.toFixed(3)} g fine would exceed the ${issued.toFixed(3)} g issued on ${job.jobNumber}. Check the weight or purity.`,
    );
  }
  if (input.kind === "RECEIPT_PIECE" && input.huid && !/^[A-Z0-9]{6}$/i.test(input.huid.trim())) {
    throw new LedgerError("HUID is 6 letters and digits.");
  }

  if (input.readingId) await confirmReading(tx, input.readingId, gross, purity, input.actorId);

  const occurredAt = input.occurredAt ?? new Date();
  const entry = await tx.ledgerEntry.create({
    data: {
      txnNumber: await nextTxnNumber(tx),
      type: input.kind,
      fromLocation: "KARIGAR",
      toLocation: "VAULT",
      karigarId: job.karigarId,
      jobId: job.id,
      grossWeight: gross.toFixed(3),
      purityPct: purity.toFixed(2),
      fineWeight: fine.toFixed(3),
      huid: input.kind === "RECEIPT_PIECE" ? input.huid?.trim().toUpperCase() || null : null,
      note: input.note?.trim() || null,
      occurredAt,
      enteredById: input.actorId,
      readingId: input.readingId ?? null,
    },
  });

  await tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: "receipt.recorded",
      entityType: "LedgerEntry",
      entityId: entry.id,
      details: { txnNumber: entry.txnNumber, jobNumber: job.jobNumber, kind: input.kind, fine: fine.toFixed(3), photo: Boolean(input.readingId) },
    },
  });

  const settlement = input.closeJob ? await settleAndCloseJob(tx, job.id, input.actorId, new Date(occurredAt.getTime() + 1000)) : null;
  return { entry, job, settlement };
}
