import Link from "next/link";
import { requireUser } from "@/lib/session";
import { karigarBalances } from "@/lib/ledger/queries";
import { fmtDateTime } from "@/lib/format";
import { Card, EmptyState, Grams, LinkButton, PageHeader, Pill, Table, Td, Th } from "@/components/ui";

export default async function KarigarsPage() {
  const user = await requireUser();
  const rows = await karigarBalances();
  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);

  return (
    <div>
      <PageHeader
        title="Karigars"
        description="Fine gold each karigar is holding right now, against open jobs."
        actions={user.role === "FINANCE_HEAD" ? <LinkButton href="/karigars/new">Add karigar</LinkButton> : null}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No karigars yet" body="Add the first karigar with their agreed wastage per item category." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th num>Open jobs</Th>
                <Th num>Fine gold held</Th>
                <Th>Last slip</Th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...inactive].map((k) => (
                <tr key={k.id} className="hover:bg-paper/60">
                  <Td className="num text-ink-soft">{k.code}</Td>
                  <Td>
                    <Link href={`/karigars/${k.id}`} className="font-medium hover:underline">
                      {k.name}
                    </Link>
                    {!k.active ? (
                      <span className="ml-2">
                        <Pill>Inactive</Pill>
                      </span>
                    ) : null}
                  </Td>
                  <Td num className="num">{k.openJobs}</Td>
                  <Td num>
                    <Grams value={k.balance} size="lg" tone={k.balance.greaterThan(0) ? "gold" : undefined} />
                  </Td>
                  <Td className="text-ink-soft">{k.lastEntryAt ? fmtDateTime(k.lastEntryAt) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
