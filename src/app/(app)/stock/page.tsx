import Link from "next/link";
import { requireRole } from "@/lib/session";
import { stockStatement } from "@/lib/ledger/queries";
import { dayBoundsIst, fmtDate, todayIsoIst } from "@/lib/format";
import { btnPrimary, btnSecondary, Card, CardTitle, Grams, inputClass, PageHeader, Stat, Table, Td, Th } from "@/components/ui";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function StockPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireRole("FINANCE_HEAD");
  const { date } = await searchParams;
  const today = todayIsoIst();
  const dateIso = date && DATE.test(date) && date <= today ? date : today;
  const { start, end } = dayBoundsIst(dateIso);
  const statement = await stockStatement(end, start);
  const isToday = dateIso === today;

  return (
    <div>
      <PageHeader
        title="Daily stock statement"
        description={`Fine gold by location at the end of ${fmtDate(end)}${isToday ? " (so far)" : ""}. Owner-only.`}
        actions={
          <>
            <form className="flex items-center gap-2">
              <input type="date" name="date" defaultValue={dateIso} max={today} className={`${inputClass} w-auto py-1.5`} aria-label="Statement date" />
              <button type="submit" className={`${btnSecondary} py-1.5`}>
                Show
              </button>
            </form>
            <a href={`/api/stock/csv?date=${dateIso}`} className={btnPrimary}>
              Export for Tally
            </a>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="In vault">
          <Grams value={statement.vault} size="xl" />
        </Stat>
        <Stat label="With karigars" hint={`${statement.perKarigar.filter((k) => k.balance.greaterThan(0)).length} karigars holding gold`}>
          <Grams value={statement.withKarigars} size="xl" tone="gold" />
        </Stat>
        <Stat label="At refiner">
          <Grams value={statement.atRefiner} size="xl" />
        </Stat>
        <Stat label="Total fine gold" hint="Vault + karigars + refiner">
          <Grams value={statement.total} size="xl" />
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardTitle>Movements on the day</CardTitle>
          <dl className="divide-y divide-line text-sm">
            {[
              ["Issued to karigars", statement.dayMovements.issued, "gold"],
              ["Received from karigars", statement.dayMovements.received, "ok"],
              ["Sent to refiner", statement.dayMovements.toRefiner, undefined],
              ["Returned from refiner", statement.dayMovements.fromRefiner, undefined],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-ink-soft">{label as string}</dt>
                <dd>
                  <Grams value={value as never} tone={tone as never} />
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardTitle>Gold with each karigar</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Karigar</Th>
                <Th num>Open jobs</Th>
                <Th num>Fine gold held</Th>
              </tr>
            </thead>
            <tbody>
              {statement.perKarigar.map((k) => (
                <tr key={k.id}>
                  <Td className="num text-ink-soft">{k.code}</Td>
                  <Td>
                    <Link href={`/karigars/${k.id}`} className="hover:underline">
                      {k.name}
                    </Link>
                  </Td>
                  <Td num className="num">{k.openJobs}</Td>
                  <Td num>
                    <Grams value={k.balance} size="lg" tone={k.balance.greaterThan(0) ? "gold" : undefined} />
                  </Td>
                </tr>
              ))}
              <tr className="bg-paper font-medium">
                <Td></Td>
                <Td>Total with karigars</Td>
                <Td></Td>
                <Td num>
                  <Grams value={statement.withKarigars} size="lg" tone="gold" />
                </Td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
