"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parsePurityInput, parseWeightInput } from "@/lib/gold/fine-gold";
import { LedgerError, recordIssue } from "@/lib/ledger/record-entry";
import { ForbiddenError, requireRoleForAction } from "@/lib/session";

export type IssueState = { error?: string };

const schema = z.object({
  karigarId: z.string().min(1, "Pick a karigar."),
  jobMode: z.enum(["new", "existing"]),
  jobId: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().trim().max(120).optional(),
  grossWeight: z.string(),
  purityPct: z.string(),
  note: z.string().trim().max(200).optional(),
  readingId: z.string().optional(),
});

export async function recordIssueAction(_prev: IssueState, formData: FormData): Promise<IssueState> {
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
  if (!gross) return { error: "Gross weight must be a number with up to 3 decimals, like 120.000." };
  const purity = parsePurityInput(f.purityPct);
  if (!purity) return { error: "Purity must be between 0.01 and 100.00 with up to 2 decimals." };

  const job =
    f.jobMode === "existing"
      ? ({ kind: "existing", jobId: f.jobId ?? "" } as const)
      : ({ kind: "new", categoryId: f.categoryId ?? "", description: f.description ?? "" } as const);
  if (job.kind === "existing" && !job.jobId) return { error: "Pick the job to add this issue to." };
  if (job.kind === "new" && !job.categoryId) return { error: "Pick the item category for the new job." };

  let entryId: string;
  try {
    const result = await db.$transaction((tx) =>
      recordIssue(tx, {
        actorId,
        karigarId: f.karigarId,
        job,
        grossWeight: gross,
        purityPct: purity,
        note: f.note,
        readingId: f.readingId || undefined,
      }),
    );
    entryId = result.entry.id;
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/karigars");
  revalidatePath("/jobs");
  redirect(`/slips/${entryId}`);
}
