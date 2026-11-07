import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { karigarBalances } from "@/lib/ledger/queries";
import { PageHeader } from "@/components/ui";
import { IssueForm } from "./IssueForm";

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ karigar?: string }> }) {
  await requireUser();
  const { karigar: preselected } = await searchParams;
  const [balances, categories, openJobs] = await Promise.all([
    karigarBalances(),
    db.itemCategory.findMany({ orderBy: { name: "asc" } }),
    db.job.findMany({
      where: { status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: { category: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Issue gold" description="Gold leaving the vault for a karigar. The slip prints after saving." />
      <IssueForm
        preselectedKarigarId={preselected}
        karigars={balances
          .filter((k) => k.active)
          .map((k) => ({ id: k.id, code: k.code, name: k.name, balance: k.balance.toFixed(3) }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        openJobs={openJobs.map((j) => ({
          id: j.id,
          karigarId: j.karigarId,
          jobNumber: j.jobNumber,
          label: `${j.jobNumber} · ${j.category.name} · ${j.description}`,
        }))}
      />
    </div>
  );
}
