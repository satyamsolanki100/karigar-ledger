import type { Prisma } from "@/generated/prisma/client";

/** Slip numbers come from a Postgres sequence so two clerks on two tablets never collide. */
export async function nextTxnNumber(tx: Prisma.TransactionClient): Promise<string> {
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('txn_number_seq')`;
  return `TX-${nextval.toString()}`;
}
