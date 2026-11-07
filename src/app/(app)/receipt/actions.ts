"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parsePurityInput, parseWeightInput } from "@/lib/gold/fine-gold";
import { LedgerError, recordReceipt } from "@/lib/ledger/record-entry";
import { ForbiddenError, requireRoleForAction } from "@/lib/session";

export type ReceiptState = { error?: string };

const schema = z.object({
  jobId: z.string().min(1, "Pick the job this gold came back from."),
  kind: z.enum(["RECEIPT_PIECE", "RECEIPT_SCRAP", "RECEIPT_FILINGS"]),
  grossWeight: z.string(),
  purityPct: z.string(),
  huid: z.string().trim().max(12).optional(),
  note: z.string().trim().max(200).optional(),
  readingId: z.string().optional(),
  closeJob: z.string().optional(),
});

export async function recordReceiptAction(_prev: ReceiptState, formData: FormData): Promise<ReceiptState> {
  let actorId: string;
  try {
    actorId = (await requireRoleForAction("CLERK", "FINANCE_HEAD")).id;
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "Sign in again to continue." };
    throw err;
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  const gross = parseWeightInput(f.grossWeight);
  if (!gross) return { error: "Weight must be a number with up to 3 decimals, like 112.450." };
  const purity = parsePurityInput(f.purityPct);
  if (!purity) return { error: "Purity must be between 0.01 and 100.00 with up to 2 decimals." };

  let entryId: string;
  let closed = false;
  try {
    const result = await db.$transaction((tx) =>
      recordReceipt(tx, {
        actorId,
        jobId: f.jobId,
        kind: f.kind,
        grossWeight: gross,
        purityPct: purity,
        huid: f.huid,
        note: f.note,
        readingId: f.readingId || undefined,
        closeJob: f.closeJob === "on",
      }),
    );
    entryId = result.entry.id;
    closed = Boolean(result.settlement);
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/karigars");
  revalidatePath("/jobs");
  revalidatePath("/alerts");
  redirect(closed ? `/jobs/${f.jobId}?closed=1` : `/slips/${entryId}`);
}
