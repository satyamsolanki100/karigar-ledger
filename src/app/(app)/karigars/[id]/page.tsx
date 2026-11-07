import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { karigarLedger } from "@/lib/ledger/queries";
import { ENTRY_LABEL, fmtDate, fmtDateTime, pct } from "@/lib/format";
import { Card, CardTitle, EmptyState, Grams, LinkButton, PageHeader, Pill, Stat, Table, Td, Th } from "@/components/ui";
import { AllowanceEditor } from "./AllowanceEditor";

export default async function KarigarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const karigar = await db.karigar.findUnique({
    where: { id },
    include: {
      allowances: { include: { category: true }, orderBy: { category: { name: "asc" } } },
      jobs: { orderBy: { openedAt: "desc" }, take: 12, include: { category: true } },
    },
  });
  if (!karigar) notFound();

  const ledger = await karigarLedger(id);
  const recentLines = ledger.lines.slice(-25).reverse();
  const openJobs = karigar.jobs.filter((j) => j.status === "OPEN");
  const closedJobs = karigar.jobs.filter((j) => j.status === "CLOSED");
  const isFinance = user.role === "FINANCE_HEAD";

  return (
    <div>
      <PageHeader
        title={karigar.name}
        description={
          <>
            <span className="num">{karigar.code}</span>
            {karigar.phone ? <span className="ml-3">{karigar.phone}</span> : null}
            <span className="ml-3">Since {fmtDate(karigar.joinedAt)}</span>
            {!karigar.active ? (
              <span className="ml-3">
                <Pill>Inactive</Pill>
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <LinkButton href={`/issue?karigar=${karigar.id}`} variant="secondary">
              Issue gold
            </LinkButton>
            <LinkButton href={`/receipt?karigar=${karigar.id}`}>Record receipt</LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Fine gold held now">
          <Grams value={ledger.closingBalance} size="xl" tone="gold" />
        </Stat>
        <Stat label="Open jobs">
          <span className="num text-2xl font-semibold">{openJobs.length}</span>
        </Stat>
        <Stat label="Slips on record">
          <span className="num text-2xl font-semibold">{ledger.lines.length}</span>
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardTitle aside={<span className="text-xs text-ink-faint">Latest first</span>}>Ledger</CardTitle>
            {recentLines.length === 0 ? (
              <EmptyState title="No slips yet" body="Issue gold to this karigar to open the ledger." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Slip</Th>
                    <Th>When</Th>
                    <Th>Type</Th>
                    <Th>Job</Th>
                    <Th num>Gross</Th>
                    <Th num>Purity</Th>
                    <Th num>Fine</Th>
                    <Th num>Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentLines.map((line) => {
                    const out = line.toLocation === "KARIGAR";
                    return (
                      <tr key={line.id}>
                        <Td className="num text-ink-soft">{line.txnNumber}</Td>
                        <Td className="whitespace-nowrap text-ink-soft">{fmtDateTime(line.occurredAt)}</Td>
                        <Td>
                          <Pill tone={out ? "gold" : "ok"}>{ENTRY_LABEL[line.type]}</Pill>
                        </Td>
                        <Td>
                          {line.job ? (
                            <Link href={`/jobs/${line.jobId}`} className="num hover:underline">
                              {line.job.jobNumber}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td num>
                          <Grams value={line.grossWeight.toString()} />
                        </Td>
                        <Td num className="num text-ink-soft">
                          {pct(line.purityPct.toString())}
                        </Td>
                        <Td num>
                          <Grams value={(out ? "" : "-") + line.fineWeight.toString()} tone={out ? "gold" : "ok"} signed />
                        </Td>
                        <Td num>
                          <Grams value={line.balanceAfter} size="lg" />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardTitle aside={<Link href={`/jobs?karigar=${karigar.id}`} className="text-xs text-ink-soft hover:underline">All jobs</Link>}>
              Recent jobs
            </CardTitle>
            {karigar.jobs.length === 0 ? (
              <EmptyState title="No jobs yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Job</Th>
                    <Th>Item</Th>
                    <Th>Opened</Th>
                    <Th num>Allowed</Th>
                    <Th num>Actual</Th>
                    <Th num>Excess</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...openJobs, ...closedJobs].map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <Link href={`/jobs/${job.id}`} className="num font-medium hover:underline">
                          {job.jobNumber}
                        </Link>
                      </Td>
                      <Td>
                        {job.category.name}
                        <span className="ml-2 text-ink-faint">{job.description}</span>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-soft">{fmtDate(job.openedAt)}</Td>
                      <Td num className="num text-ink-soft">{pct(job.allowedPct.toString())} %</Td>
                      <Td num className="num">{job.actualPct ? `${pct(job.actualPct.toString())} %` : "—"}</Td>
                      <Td num>
                        {job.excessGrams ? (
                          <Grams value={job.excessGrams.toString()} signed tone={job.excessGrams.greaterThan(0) ? "bad" : "ok"} />
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{job.status === "OPEN" ? <Pill tone="gold">Open</Pill> : <Pill>Closed</Pill>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Agreed wastage</CardTitle>
            <AllowanceEditor
              karigarId={karigar.id}
              editable={isFinance}
              rows={karigar.allowances.map((a) => ({
                categoryId: a.categoryId,
                categoryName: a.category.name,
                allowedWastagePct: a.allowedWastagePct.toFixed(2),
              }))}
            />
            {!isFinance ? (
              <p className="border-t border-line px-4 py-2.5 text-xs text-ink-faint">Only the finance head can change these.</p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
