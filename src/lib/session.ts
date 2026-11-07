import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = { id: string; name: string; email: string; role: Role };

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const { id, name, email, role } = session.user;
  return { id, name: name ?? "", email: email ?? "", role };
}

/** Finance-only screens: stock data is owner-only per the brief, alerts go to the finance head. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("Not allowed for this role");
  }
}

/** For server actions, where a redirect would swallow the form error. */
export async function requireRoleForAction(...roles: Role[]): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !roles.includes(session.user.role)) throw new ForbiddenError();
  const { id, name, email, role } = session.user;
  return { id, name: name ?? "", email: email ?? "", role };
}
