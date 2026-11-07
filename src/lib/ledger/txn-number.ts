import type { Prisma } from "@/generated/prisma/client";

/** Slip and job numbers come from Postgres sequences so two clerks on two tablets never collide. */
export async function nextTxnNumber(tx: Prisma.TransactionClient): Promise<string> {
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('txn_number_seq')`;
  return `TX-${nextval.toString()}`;
}

export async function nextJobNumber(tx: Prisma.TransactionClient): Promise<string> {
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('job_number_seq')`;
  return `JOB-${nextval.toString()}`;
}
