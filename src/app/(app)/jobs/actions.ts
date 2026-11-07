"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { settleAndCloseJob } from "@/lib/ledger/settle-job";
import { ForbiddenError, requireRoleForAction } from "@/lib/session";

export type CloseJobState = { error?: string };

export async function closeJobAction(_prev: CloseJobState, formData: FormData): Promise<CloseJobState> {
  let actorId: string;
  try {
    actorId = (await requireRoleForAction("CLERK", "FINANCE_HEAD")).id;
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "Sign in again to continue." };
    throw err;
  }
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return { error: "Missing job." };
  try {
    await db.$transaction((tx) => settleAndCloseJob(tx, jobId, actorId));
  } catch (err) {
    return { error: (err as Error).message };
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/alerts");
  revalidatePath("/");
  return {};
}
