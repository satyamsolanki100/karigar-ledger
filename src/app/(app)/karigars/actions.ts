"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parsePurityInput } from "@/lib/gold/fine-gold";
import { ForbiddenError, requireRoleForAction } from "@/lib/session";

export type ActionState = { error?: string; ok?: boolean };

const karigarSchema = z.object({
  code: z.string().trim().regex(/^K-\d{2,4}$/, "Code looks like K-09"),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

export async function createKarigar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let actorId: string;
  try {
    actorId = (await requireRoleForAction("FINANCE_HEAD")).id;
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "Only the finance head can add karigars." };
    throw err;
  }
  const parsed = karigarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const allowances = await db.itemCategory.findMany();
  const pctByCategory = new Map<string, string>();
  for (const c of allowances) {
    const raw = String(formData.get(`allowance:${c.id}`) ?? "");
    const value = parsePurityInput(raw);
    if (!value || value.greaterThan(20)) return { error: `Wastage % for ${c.name} must be between 0.01 and 20.00` };
    pctByCategory.set(c.id, value.toFixed(2));
  }

  const existing = await db.karigar.findUnique({ where: { code: parsed.data.code } });
  if (existing) return { error: `Code ${parsed.data.code} is already used by ${existing.name}.` };

  const karigar = await db.$transaction(async (tx) => {
    const created = await tx.karigar.create({
      data: { code: parsed.data.code, name: parsed.data.name, phone: parsed.data.phone || null },
    });
    await tx.karigarAllowance.createMany({
      data: allowances.map((c) => ({ karigarId: created.id, categoryId: c.id, allowedWastagePct: pctByCategory.get(c.id)! })),
    });
    await tx.auditEvent.create({
      data: { actorId, action: "karigar.created", entityType: "Karigar", entityId: created.id, details: { code: created.code } },
    });
    return created;
  });

  revalidatePath("/karigars");
  redirect(`/karigars/${karigar.id}`);
}

export async function updateAllowance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let actorId: string;
  try {
    actorId = (await requireRoleForAction("FINANCE_HEAD")).id;
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "Only the finance head can change agreed wastage." };
    throw err;
  }
  const karigarId = String(formData.get("karigarId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const value = parsePurityInput(String(formData.get("allowedWastagePct") ?? ""));
  if (!karigarId || !categoryId) return { error: "Missing karigar or category." };
  if (!value || value.greaterThan(20)) return { error: "Wastage % must be between 0.01 and 20.00." };

  await db.$transaction(async (tx) => {
    const before = await tx.karigarAllowance.findUnique({ where: { karigarId_categoryId: { karigarId, categoryId } } });
    await tx.karigarAllowance.upsert({
      where: { karigarId_categoryId: { karigarId, categoryId } },
      create: { karigarId, categoryId, allowedWastagePct: value.toFixed(2) },
      update: { allowedWastagePct: value.toFixed(2) },
    });
    await tx.auditEvent.create({
      data: {
        actorId,
        action: "allowance.changed",
        entityType: "Karigar",
        entityId: karigarId,
        details: { categoryId, from: before?.allowedWastagePct.toString() ?? null, to: value.toFixed(2) },
      },
    });
  });

  revalidatePath(`/karigars/${karigarId}`);
  return { ok: true };
}

export async function setKarigarActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let actorId: string;
  try {
    actorId = (await requireRoleForAction("FINANCE_HEAD")).id;
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: "Only the finance head can change this." };
    throw err;
  }
  const karigarId = String(formData.get("karigarId") ?? "");
  const active = formData.get("active") === "true";
  await db.$transaction(async (tx) => {
    await tx.karigar.update({ where: { id: karigarId }, data: { active } });
    await tx.auditEvent.create({
      data: { actorId, action: active ? "karigar.activated" : "karigar.deactivated", entityType: "Karigar", entityId: karigarId },
    });
  });
  revalidatePath(`/karigars/${karigarId}`);
  revalidatePath("/karigars");
  return { ok: true };
}
