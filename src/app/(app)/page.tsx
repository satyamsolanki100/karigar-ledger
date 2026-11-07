import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { karigarBalances, stockStatement } from "@/lib/ledger/queries";
import { sumGrams } from "@/lib/gold/fine-gold";
import { dayBoundsIst, ENTRY_LABEL, fmtDate, fmtTime, todayIsoIst } from "@/lib/format";
import { Card, CardTitle, EmptyState, Grams, LinkButton, PageHeader, Pill, Stat, Table, Td, Th } from "@/components/ui";

export default async function TodayPage() {
  const user = await requireUser();
  const isFinance = user.role === "FINANCE_HEAD";
  const today = todayIsoIst();
  const { start, end } = dayBoundsIst(today);

  const [balances, todaysSlips, openAlerts, stock] = await Promise.all([
    karigarBalances(),
    db.ledgerEntry.findMany({
      where: { occurredAt: { gte: start, lte: end }, karigarId: { not: null } },
      orderBy: { occurredAt: "desc" },
      take: 20,
      include: { karigar: { select: { name: true, code: true } }, job: { select: { jobNumber: true } } },
    }),
    isFinance ? db.lossAlert.count({ where: { status: "OPEN" } }) : Promise.resolve(0),
    isFinance ? stockStatement(end, start) : Promise.resolve(null),
  ]);

  const withKarigars = sumGrams(balances.map((k) => k.balance));
  const openJobs = balances.reduce((t, k) => t + k.openJobs, 0);
  const issuedToday = stock?.dayMovements.issued ?? sumGrams(todaysSlips.filter((s) => s.type === "ISSUE").map((s) => s.fineWeight.toString()));
  const receivedToday =
    stock?.dayMovements.received ?? sumGrams(todaysSlips.filter((s) => s.type.startsWith("RECEIPT")).map((s) => s.fineWeight.toString()));

  return (
    <div>
      <PageHeader
        title="Today"
        description={fmtDate(new Date())}
        actions={
          <>
            <LinkButton href="/receipt" variant="secondary">
              Record receipt
            </LinkButton>
            <LinkButton href="/issue">Issue gold</LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fine gold with karigars" hint={`${openJobs} open jobs`}>
          <Grams value={withKarigars} size="xl" tone="gold" />
        </Stat>
        <Stat label="Issued today">
          <Grams value={issuedToday} size="xl" />
        </Stat>
        <Stat label="Received today">
          <Grams value={receivedToday} size="xl" />
        </Stat>
        {isFinance ? (
          <Link href="/alerts" className="block">
            <Stat label="Loss items to review" hint="Finance head only">
              <span className={`num text-2xl font-semibold ${openAlerts > 0 ? "text-bad" : ""}`}>{openAlerts}</span>
            </Stat>
          </Link>
        ) : (
          <Stat label="Slips today">
            <span className="num text-2xl font-semibold">{todaysSlips.length}</span>
          </Stat>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle aside={<Link href="/karigars" className="text-xs text-ink-soft hover:underline">All karigars</Link>}>
            Gold with each karigar
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Karigar</Th>
                <Th num>Open jobs</Th>
                <Th num>Fine gold held</Th>
              </tr>
            </thead>
            <tbody>
              {balances
                .filter((k) => k.active)
                .map((k) => (
                  <tr key={k.id}>
                    <Td>
                      <Link href={`/karigars/${k.id}`} className="font-medium hover:underline">
                        {k.name}
                      </Link>{" "}
                      <span className="num text-ink-faint">{k.code}</span>
                    </Td>
                    <Td num className="num">{k.openJobs}</Td>
                    <Td num>
                      <Grams value={k.balance} size="lg" tone={k.balance.greaterThan(0) ? "gold" : undefined} />
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardTitle>Today&apos;s slips</CardTitle>
          {todaysSlips.length === 0 ? (
            <EmptyState title="Nothing yet today" body="Issues and receipts you record will show here." />
          ) : (
            <ul className="divide-y divide-line">
              {todaysSlips.map((s) => {
                const out = s.type === "ISSUE";
                return (
                  <li key={s.id} className="px-4 py-2.5">
                    <Link href={`/slips/${s.id}`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Pill tone={out ? "gold" : "ok"}>{ENTRY_LABEL[s.type]}</Pill>
                          <span className="num text-xs text-ink-faint">{fmtTime(s.occurredAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate">
                          {s.karigar?.name} · <span className="num">{s.job?.jobNumber}</span>
                        </p>
                      </div>
                      <Grams value={(out ? "" : "-") + s.fineWeight.toString()} signed tone={out ? "gold" : "ok"} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
