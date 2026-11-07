import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { karigarLedger } from "@/lib/ledger/queries";
import { ENTRY_LABEL, fmtDateTime, pct } from "@/lib/format";
import { btnPrimary, btnSecondary, Card, Grams, PageHeader, Pill } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const entry = await db.ledgerEntry.findUnique({
    where: { id },
    include: {
      karigar: true,
      job: { include: { category: true } },
      enteredBy: { select: { name: true } },
      reading: { select: { id: true, status: true, provider: true } },
    },
  });
  if (!entry || !entry.karigarId) notFound();

  const ledger = await karigarLedger(entry.karigarId, { to: entry.occurredAt });
  const balanceAfter = ledger.closingBalance;
  const isIssue = entry.type === "ISSUE";

  return (
    <div className="max-w-xl">
      <PageHeader
        title={isIssue ? "Issue slip" : "Receipt slip"}
        description="Saved. Hand the printed slip to the karigar."
        actions={
          <>
            <PrintButton />
            <Link href={isIssue ? "/issue" : "/receipt"} className={btnPrimary}>
              {isIssue ? "Next issue" : "Next receipt"}
            </Link>
          </>
        }
      />

      <Card className="print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-medium text-ink-faint">Slip</p>
            <p className="num text-lg font-semibold">{entry.txnNumber}</p>
          </div>
          <div className="text-right">
            <Pill tone={isIssue ? "gold" : "ok"}>{ENTRY_LABEL[entry.type]}</Pill>
            <p className="mt-1 text-xs text-ink-soft">{fmtDateTime(entry.occurredAt)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
          <div>
            <dt className="text-xs text-ink-faint">Karigar</dt>
            <dd className="font-medium">
              {entry.karigar!.name} <span className="num text-ink-soft">{entry.karigar!.code}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Job</dt>
            <dd className="font-medium">
              <span className="num">{entry.job?.jobNumber}</span>
              <span className="ml-2 text-ink-soft">
                {entry.job?.category.name} · {entry.job?.description}
              </span>
            </dd>
          </div>
          {entry.huid ? (
            <div>
              <dt className="text-xs text-ink-faint">HUID</dt>
              <dd className="num font-medium">{entry.huid}</dd>
            </div>
          ) : null}
          {entry.note ? (
            <div className="col-span-2">
              <dt className="text-xs text-ink-faint">Note</dt>
              <dd>{entry.note}</dd>
            </div>
          ) : null}
        </dl>

        <div className="grid grid-cols-3 border-t border-line">
          <div className="border-r border-line px-5 py-4">
            <p className="text-xs text-ink-faint">Gross</p>
            <Grams value={entry.grossWeight.toString()} size="lg" />
          </div>
          <div className="border-r border-line px-5 py-4">
            <p className="text-xs text-ink-faint">Purity</p>
            <p className="num text-lg font-semibold">{pct(entry.purityPct.toString())} %</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-ink-faint">Fine</p>
            <Grams value={entry.fineWeight.toString()} size="lg" tone={isIssue ? "gold" : "ok"} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line bg-paper px-5 py-4">
          <p className="text-sm font-medium">Fine gold with {entry.karigar!.name.split(" ")[0]} after this slip</p>
          <Grams value={balanceAfter} size="xl" tone="gold" />
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-faint">
          <span>Entered by {entry.enteredBy.name}</span>
          <span>{entry.reading ? `Weight confirmed from photo (${entry.reading.provider})` : "Typed, no photo"}</span>
        </div>
      </Card>

      <div className="mt-4 print:hidden">
        <Link href={`/karigars/${entry.karigarId}`} className={btnSecondary}>
          Open {entry.karigar!.name}&apos;s ledger
        </Link>
      </div>
    </div>
  );
}
