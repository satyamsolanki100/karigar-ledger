import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { sumGrams } from "@/lib/gold/fine-gold";
import { PageHeader } from "@/components/ui";
import { ReceiptForm, type OpenJobOption } from "./ReceiptForm";

export default async function ReceiptPage({ searchParams }: { searchParams: Promise<{ karigar?: string; job?: string }> }) {
  await requireUser();
  const { karigar, job } = await searchParams;
  const jobs = await db.job.findMany({
    where: { status: "OPEN" },
    orderBy: [{ karigar: { code: "asc" } }, { openedAt: "asc" }],
    include: { karigar: { select: { id: true, code: true, name: true } }, category: { select: { name: true } }, entries: true },
  });

  const options: OpenJobOption[] = jobs.map((j) => {
    const issues = j.entries.filter((e) => e.type === "ISSUE");
    const purities = new Set(issues.map((e) => e.purityPct.toFixed(2)));
    return {
      id: j.id,
      karigarId: j.karigar.id,
      karigarLabel: `${j.karigar.code} · ${j.karigar.name}`,
      jobNumber: j.jobNumber,
      description: `${j.category.name} · ${j.description}`,
      allowedPct: j.allowedPct.toFixed(2),
      issuedFine: sumGrams(issues.map((e) => e.fineWeight.toString())).toFixed(3),
      receivedFine: sumGrams(j.entries.filter((e) => e.type !== "ISSUE").map((e) => e.fineWeight.toString())).toFixed(3),
      issuePurity: purities.size === 1 ? [...purities][0] : null,
      openedAt: j.openedAt.toISOString(),
    };
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Record receipt" description="Finished pieces, scrap and filings coming back from a karigar." />
      <ReceiptForm jobs={options} preselectedKarigarId={karigar} preselectedJobId={job} />
    </div>
  );
}
