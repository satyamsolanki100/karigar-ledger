"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ForbiddenError, requireRoleForAction } from "@/lib/session";

export type ReviewState = { error?: string; ok?: boolean };

const schema = z.object({
  alertId: z.string().min(1),
  outcome: z.enum(["REVIEWED", "DISMISSED"]),
  note: z.string().trim().max(300).optional(),
});

/** Brief: alerts are items to review for the finance head, never accusations. The note is what they found. */
export async function reviewAlertAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  let actorId: string;
  try {
    actorId = (await requireRoleForAction("FINANCE_HEAD")).id;
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "Only the finance head can review loss items." };
    throw err;
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose an outcome." };
  const { alertId, outcome, note } = parsed.data;

  await db.$transaction(async (tx) => {
    const alert = await tx.lossAlert.findUnique({ where: { id: alertId } });
    if (!alert || alert.status !== "OPEN") throw new Error("This item was already handled.");
    await tx.lossAlert.update({
      where: { id: alertId },
      data: { status: outcome, reviewedById: actorId, reviewNote: note || null, reviewedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: { actorId, action: `alert.${outcome.toLowerCase()}`, entityType: "LossAlert", entityId: alertId, details: { note: note || null } },
    });
  });

  revalidatePath("/alerts");
  revalidatePath("/");
  return { ok: true };
}
