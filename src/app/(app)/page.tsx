import { requireUser } from "@/lib/session";

export default async function TodayPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Today</h1>
      <p className="mt-1 text-sm text-ink-soft">Signed in as {user.name}.</p>
    </div>
  );
}
