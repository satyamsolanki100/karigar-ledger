import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { settleJob, sumGrams } from "@/lib/gold/fine-gold";
import { ENTRY_LABEL, fmtDate, fmtDateTime, pct } from "@/lib/format";
import { Card, CardTitle, Grams, LinkButton, PageHeader, Pill, Stat, Table, Td, Th } from "@/components/ui";
import { CloseJobButton } from "./CloseJobButton";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ closed?: string }>;
}) {
  const { id } = await params;
  const { closed } = await searchParams;
  const user = await requireUser();
  const job = await db.job.findUnique({
    where: { id },
    include: {
      karigar: true,
      category: true,
      entries: { orderBy: { occurredAt: "asc" }, include: { reading: { select: { id: true } } } },
      alerts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) notFound();

  const issued = sumGrams(job.entries.filter((e) => e.type === "ISSUE").map((e) => e.fineWeight.toString()));
  const received = sumGrams(job.entries.filter((e) => e.type !== "ISSUE").map((e) => e.fineWeight.toString()));
  const settled =
    job.status === "CLOSED"
      ? settleJob({ issuedFine: job.issuedFine!.toString(), receivedFine: job.receivedFine!.toString(), allowedPct: job.allowedPct.toString() })
      : settleJob({ issuedFine: issued, receivedFine: received, allowedPct: job.allowedPct.toString() });
  const isOpen = job.status === "OPEN";

  return (
    <div>
      {closed ? (
        <div className="mb-4 rounded-md bg-ok-soft px-4 py-2.5 text-sm text-ok">
          Job closed and settled.{" "}
          {settled.overAllowance ? "It is over allowance and is listed for the finance head to review." : "Loss is within the agreed allowance."}
        </div>
      ) : null}
      <PageHeader
        title={job.jobNumber}
        description={
          <>
            {job.category.name} · {job.description} · for{" "}
            <Link href={`/karigars/${job.karigarId}`} className="hover:underline">
              {job.karigar.name}
            </Link>{" "}
            <span className="num">{job.karigar.code}</span> · opened {fmtDate(job.openedAt)}
            {job.closedAt ? <> · closed {fmtDate(job.closedAt)}</> : null}
          </>
        }
        actions={
          isOpen ? (
            <>
              <LinkButton href={`/issue?karigar=${job.karigarId}`} variant="secondary">
                Issue more
              </LinkButton>
              <LinkButton href={`/receipt?job=${job.id}`}>Record receipt</LinkButton>
            </>
          ) : (
            <Pill>Closed</Pill>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Issued fine">
          <Grams value={settled.issuedFine} size="lg" tone="gold" />
        </Stat>
        <Stat label="Received fine">
          <Grams value={settled.receivedFine} size="lg" tone="ok" />
        </Stat>
        <Stat label={isOpen ? "Still with karigar" : "Loss"}>
          <Grams value={settled.loss} size="lg" />
        </Stat>
        <Stat label={`Allowed at ${pct(job.allowedPct.toString())} %`}>
          <Grams value={settled.allowed} size="lg" />
        </Stat>
        <Stat label={isOpen ? "Over allowance if closed now" : "Over allowance"} hint={`${settled.actualPct.toFixed(2)} % actual`}>
          <Grams value={settled.excess} size="lg" signed tone={settled.overAllowance ? "bad" : "ok"} />
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardTitle>Slips on this job</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Slip</Th>
                <Th>When</Th>
                <Th>Type</Th>
                <Th>HUID</Th>
                <Th num>Gross</Th>
                <Th num>Purity</Th>
                <Th num>Fine</Th>
                <Th>Photo</Th>
              </tr>
            </thead>
            <tbody>
              {job.entries.map((e) => {
                const out = e.type === "ISSUE";
                return (
                  <tr key={e.id}>
                    <Td>
                      <Link href={`/slips/${e.id}`} className="num hover:underline">
                        {e.txnNumber}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">{fmtDateTime(e.occurredAt)}</Td>
                    <Td>
                      <Pill tone={out ? "gold" : "ok"}>{ENTRY_LABEL[e.type]}</Pill>
                    </Td>
                    <Td className="num text-ink-soft">{e.huid ?? "—"}</Td>
                    <Td num>
                      <Grams value={e.grossWeight.toString()} />
                    </Td>
                    <Td num className="num text-ink-soft">
                      {pct(e.purityPct.toString())}
                    </Td>
                    <Td num>
                      <Grams value={(out ? "" : "-") + e.fineWeight.toString()} signed tone={out ? "gold" : "ok"} />
                    </Td>
                    <Td className="text-xs text-ink-faint">{e.reading ? "Confirmed" : "Typed"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-4">
          {isOpen ? (
            <Card className="p-4">
              <p className="text-sm font-medium">Settle this job</p>
              <p className="mt-1 text-xs text-ink-soft">
                Closing compares what came back with what was issued and raises a review item if the loss is over the agreed allowance.
              </p>
              <div className="mt-3">
                <CloseJobButton jobId={job.id} overAllowance={settled.overAllowance} />
              </div>
            </Card>
          ) : null}
          {job.alerts.length > 0 ? (
            <Card>
              <CardTitle>Review items</CardTitle>
              <ul className="divide-y divide-line text-sm">
                {job.alerts.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <Pill tone={a.kind === "OVER_ALLOWANCE" ? "bad" : "warn"}>{a.kind === "OVER_ALLOWANCE" ? "Over allowance" : "Drifting"}</Pill>
                      <span className="text-xs text-ink-faint">{a.status === "OPEN" ? "Open" : a.status === "REVIEWED" ? "Reviewed" : "Dismissed"}</span>
                    </div>
                    {user.role === "FINANCE_HEAD" ? (
                      <Link href="/alerts" className="mt-1 inline-block text-xs text-ink-soft hover:underline">
                        Open in loss alerts
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
