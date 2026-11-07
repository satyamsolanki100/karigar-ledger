import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { settleJob, sumGrams } from "@/lib/gold/fine-gold";
import { evaluateLoss, type SettledJobSample } from "@/lib/gold/loss-drift";
import { readDriftPolicy } from "@/lib/policy";

type Tx = Prisma.TransactionClient;

const RECEIPT_TYPES = ["RECEIPT_PIECE", "RECEIPT_SCRAP", "RECEIPT_FILINGS"] as const;

/**
 * Closes a job: settles issued against received fine gold, stores the result on the job,
 * and raises loss alerts for the finance head. Runs inside the caller's transaction so the
 * close and its alerts land together or not at all.
 */
export async function settleAndCloseJob(tx: Tx, jobId: string, actorId: string, closedAt = new Date()) {
  const job = await tx.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { entries: true },
  });
  if (job.status === "CLOSED") throw new Error(`Job ${job.jobNumber} is already closed`);

  const issuedFine = sumGrams(job.entries.filter((e) => e.type === "ISSUE").map((e) => e.fineWeight));
  const receivedFine = sumGrams(
    job.entries
      .filter((e) => (RECEIPT_TYPES as readonly string[]).includes(e.type))
      .map((e) => e.fineWeight),
  );
  if (issuedFine.isZero()) throw new Error(`Job ${job.jobNumber} has no issue entry`);

  const settled = settleJob({ issuedFine, receivedFine, allowedPct: job.allowedPct });

  await tx.job.update({
    where: { id: job.id },
    data: {
      status: "CLOSED",
      closedAt,
      issuedFine: settled.issuedFine.toFixed(3),
      receivedFine: settled.receivedFine.toFixed(3),
      lossGrams: settled.loss.toFixed(3),
      allowedGrams: settled.allowed.toFixed(3),
      excessGrams: settled.excess.toFixed(3),
      actualPct: settled.actualPct.toFixed(2),
    },
  });

  const earlierJobs = await tx.job.findMany({
    where: { karigarId: job.karigarId, status: "CLOSED", id: { not: job.id }, closedAt: { lt: closedAt } },
    orderBy: { closedAt: "desc" },
    take: 12,
    select: { id: true, closedAt: true, actualPct: true, allowedPct: true, excessGrams: true },
  });
  const history: SettledJobSample[] = earlierJobs.map((j) => ({
    jobId: j.id,
    closedAt: j.closedAt!,
    actualPct: new Decimal(j.actualPct!.toString()),
    allowedPct: new Decimal(j.allowedPct.toString()),
    excessGrams: new Decimal(j.excessGrams!.toString()),
  }));

  const findings = evaluateLoss(
    {
      jobId: job.id,
      closedAt,
      actualPct: settled.actualPct,
      allowedPct: settled.allowedPct,
      excessGrams: settled.excess,
    },
    history,
    await readDriftPolicy(tx),
  );

  for (const finding of findings) {
    await tx.lossAlert.create({
      data: {
        karigarId: job.karigarId,
        jobId: job.id,
        kind: finding.kind,
        allowedPct: finding.allowedPct.toFixed(2),
        actualPct: finding.actualPct.toFixed(2),
        baselinePct: finding.kind === "DRIFT" ? finding.baselinePct.toFixed(2) : null,
        excessGrams: finding.excessGrams.toFixed(3),
        createdAt: closedAt,
      },
    });
  }

  await tx.auditEvent.create({
    data: {
      actorId,
      action: "job.closed",
      entityType: "Job",
      entityId: job.id,
      details: {
        jobNumber: job.jobNumber,
        lossGrams: settled.loss.toFixed(3),
        excessGrams: settled.excess.toFixed(3),
        alerts: findings.map((f) => f.kind),
      },
      createdAt: closedAt,
    },
  });

  return { settled, findings };
}
