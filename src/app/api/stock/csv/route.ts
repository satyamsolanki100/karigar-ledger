import { auth } from "@/auth";
import { stockStatement } from "@/lib/ledger/queries";
import { stockStatementCsv } from "@/lib/ledger/stock-csv";
import { dayBoundsIst, todayIsoIst } from "@/lib/format";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const session = await auth();
  // Brief: stock data is owner-only.
  if (!session?.user?.id || session.user.role !== "FINANCE_HEAD") return new Response("Forbidden", { status: 403 });

  const requested = new URL(request.url).searchParams.get("date");
  const dateIso = requested && DATE.test(requested) ? requested : todayIsoIst();
  const { start, end } = dayBoundsIst(dateIso);
  const statement = await stockStatement(end, start);

  return new Response(stockStatementCsv(statement, dateIso), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-statement-${dateIso}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
