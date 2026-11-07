import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { sumGrams } from "@/lib/gold/fine-gold";
import { daysSince, fmtDate, pct } from "@/lib/format";
import { Card, EmptyState, Grams, PageHeader, Pill, Table, Td, Th } from "@/components/ui";

const TABS = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
] as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; karigar?: string }> }) {
  await requireUser();
  const { status = "open", karigar } = await searchParams;
  const open = status !== "closed";

  const jobs = await db.job.findMany({
    where: { status: open ? "OPEN" : "CLOSED", ...(karigar ? { karigarId: karigar } : {}) },
    orderBy: open ? { openedAt: "asc" } : { closedAt: "desc" },
    take: 200,
    include: { karigar: { select: { code: true, name: true } }, category: { select: { name: true } }, entries: open },
  });

  return (
    <div>
      <PageHeader title="Jobs" description="One job per piece of work. Wastage is settled when the job closes." />
      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/jobs?status=${t.key}${karigar ? `&karigar=${karigar}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              (t.key === "open") === open ? "bg-ink text-white" : "text-ink-soft hover:bg-surface"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Card>
        {jobs.length === 0 ? (
          <EmptyState title={open ? "No open jobs" : "No closed jobs yet"} body={open ? "Issue gold to a karigar to open one." : undefined} />
        ) : open ? (
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Karigar</Th>
                <Th>Item</Th>
                <Th>Opened</Th>
                <Th num>Issued</Th>
                <Th num>Back so far</Th>
                <Th num>With karigar</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const issued = sumGrams(job.entries.filter((e) => e.type === "ISSUE").map((e) => e.fineWeight.toString()));
                const received = sumGrams(job.entries.filter((e) => e.type !== "ISSUE").map((e) => e.fineWeight.toString()));
                const ageDays = daysSince(job.openedAt);
                return (
                  <tr key={job.id}>
                    <Td>
                      <Link href={`/jobs/${job.id}`} className="num font-medium hover:underline">
                        {job.jobNumber}
                      </Link>
                    </Td>
                    <Td>
                      {job.karigar.name} <span className="num text-ink-faint">{job.karigar.code}</span>
                    </Td>
                    <Td>
                      {job.category.name}
                      <span className="ml-2 text-ink-faint">{job.description}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">
                      {fmtDate(job.openedAt)}
                      {ageDays > 14 ? (
                        <span className="ml-2">
                          <Pill tone="warn">{ageDays} days</Pill>
                        </span>
                      ) : null}
                    </Td>
                    <Td num>
                      <Grams value={issued} tone="gold" />
                    </Td>
                    <Td num>
                      <Grams value={received} tone="ok" />
                    </Td>
                    <Td num>
                      <Grams value={issued.minus(received)} size="lg" />
                    </Td>
                    <Td>
                      <Link href={`/receipt?job=${job.id}`} className="text-xs text-ink-soft underline-offset-2 hover:underline">
                        Receive
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Karigar</Th>
                <Th>Item</Th>
                <Th>Closed</Th>
                <Th num>Issued</Th>
                <Th num>Loss</Th>
                <Th num>Allowed</Th>
                <Th num>Actual</Th>
                <Th num>Excess</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <Td>
                    <Link href={`/jobs/${job.id}`} className="num font-medium hover:underline">
                      {job.jobNumber}
                    </Link>
                  </Td>
                  <Td>
                    {job.karigar.name} <span className="num text-ink-faint">{job.karigar.code}</span>
                  </Td>
                  <Td>
                    {job.category.name}
                    <span className="ml-2 text-ink-faint">{job.description}</span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">{job.closedAt ? fmtDate(job.closedAt) : "—"}</Td>
                  <Td num>
                    <Grams value={job.issuedFine!.toString()} />
                  </Td>
                  <Td num>
                    <Grams value={job.lossGrams!.toString()} />
                  </Td>
                  <Td num className="num text-ink-soft">
                    {pct(job.allowedPct.toString())} %
                  </Td>
                  <Td num className="num">
                    {pct(job.actualPct!.toString())} %
                  </Td>
                  <Td num>
                    <Grams value={job.excessGrams!.toString()} signed tone={job.excessGrams!.greaterThan(0) ? "bad" : "ok"} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
