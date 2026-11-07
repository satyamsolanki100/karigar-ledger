import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { fmtDate, pct } from "@/lib/format";
import { Card, CardTitle, EmptyState, Grams, PageHeader, Pill } from "@/components/ui";
import { AlertActions } from "./AlertActions";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole("FINANCE_HEAD");
  const { show = "open" } = await searchParams;
  const showingOpen = show !== "handled";

  const alerts = await db.lossAlert.findMany({
    where: showingOpen ? { status: "OPEN" } : { status: { in: ["REVIEWED", "DISMISSED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      karigar: { select: { id: true, code: true, name: true } },
      job: { select: { id: true, jobNumber: true, description: true, category: { select: { name: true } }, issuedFine: true, lossGrams: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  // Group by karigar so a pattern reads as a pattern, not as a pile of individual accusations.
  const byKarigar = new Map<string, typeof alerts>();
  for (const a of alerts) {
    const list = byKarigar.get(a.karigarId) ?? [];
    list.push(a);
    byKarigar.set(a.karigarId, list);
  }

  return (
    <div>
      <PageHeader
        title="Loss alerts"
        description="Jobs where the loss went over the agreed allowance or drifted from the karigar's own history. Items to review, not conclusions."
      />
      <div className="mb-4 flex gap-1">
        {[
          { key: "open", label: "To review" },
          { key: "handled", label: "Handled" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/alerts?show=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${(t.key === "open") === showingOpen ? "bg-ink text-white" : "text-ink-soft hover:bg-surface"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {alerts.length === 0 ? (
        <Card>
          <EmptyState title={showingOpen ? "Nothing to review" : "Nothing handled yet"} body={showingOpen ? "New items appear here when a job closes over allowance or a karigar's loss drifts." : undefined} />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byKarigar.entries()].map(([karigarId, items]) => {
            const k = items[0].karigar;
            return (
              <Card key={karigarId}>
                <CardTitle
                  aside={
                    <Link href={`/karigars/${k.id}`} className="text-xs text-ink-soft hover:underline">
                      Open ledger
                    </Link>
                  }
                >
                  {k.name} <span className="num ml-1 font-normal text-ink-faint">{k.code}</span>
                  <span className="ml-2 font-normal text-ink-soft">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </CardTitle>
                <ul className="divide-y divide-line">
                  {items.map((a) => (
                    <li key={a.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={a.kind === "OVER_ALLOWANCE" ? "bad" : "warn"}>
                            {a.kind === "OVER_ALLOWANCE" ? "Over allowance" : "Drifting from own history"}
                          </Pill>
                          {a.job ? (
                            <Link href={`/jobs/${a.job.id}`} className="num hover:underline">
                              {a.job.jobNumber}
                            </Link>
                          ) : null}
                          <span className="text-ink-faint">
                            {a.job?.category.name} · {a.job?.description} · {fmtDate(a.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-ink-soft">
                          {a.kind === "OVER_ALLOWANCE" ? (
                            <>
                              Loss <span className="num text-ink">{pct(a.actualPct.toString())} %</span> against{" "}
                              <span className="num">{pct(a.allowedPct.toString())} %</span> agreed, that is{" "}
                              <Grams value={a.excessGrams.toString()} tone="bad" /> more than allowed on{" "}
                              <Grams value={a.job?.issuedFine?.toString() ?? 0} /> issued.
                            </>
                          ) : (
                            <>
                              This job ran <span className="num text-ink">{pct(a.actualPct.minus(a.allowedPct).toString())}</span> points from allowance; this karigar
                              usually runs <span className="num text-ink">{pct(a.baselinePct?.toString() ?? 0)}</span>. Worth a look before month-end.
                            </>
                          )}
                        </p>
                        {!showingOpen ? (
                          <p className="mt-1 text-xs text-ink-faint">
                            {a.status === "REVIEWED" ? "Reviewed" : "Dismissed"} by {a.reviewedBy?.name}
                            {a.reviewedAt ? ` on ${fmtDate(a.reviewedAt)}` : ""}
                            {a.reviewNote ? ` · ${a.reviewNote}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {showingOpen ? <AlertActions alertId={a.id} /> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
