import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { NewKarigarForm } from "./NewKarigarForm";

export default async function NewKarigarPage() {
  await requireRole("FINANCE_HEAD");
  const [categories, last] = await Promise.all([
    db.itemCategory.findMany({ orderBy: { name: "asc" } }),
    db.karigar.findFirst({ orderBy: { code: "desc" }, select: { code: true } }),
  ]);
  const nextCode = last ? `K-${String(Number(last.code.replace("K-", "")) + 1).padStart(2, "0")}` : "K-01";

  return (
    <div className="max-w-xl">
      <PageHeader title="Add karigar" description="Agreed wastage is copied onto each job when it opens." />
      <NewKarigarForm
        suggestedCode={nextCode}
        categories={categories.map((c) => ({ id: c.id, name: c.name, defaultWastagePct: c.defaultWastagePct.toFixed(2) }))}
      />
    </div>
  );
}
