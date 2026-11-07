import type { StockStatement } from "./queries";
import { formatGrams } from "@/lib/gold/fine-gold";

function csvRow(cells: (string | number)[]): string {
  return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
}

/**
 * Daily stock statement as CSV. The "Tally" layout mirrors what the accounts team keys into a
 * stock journal today: one line per location in fine grams, then one per karigar.
 */
export function stockStatementCsv(statement: StockStatement, dateIso: string): string {
  const lines = [
    csvRow(["Karigar Ledger", "Daily stock statement", dateIso]),
    csvRow(["Location", "Fine gold (g)"]),
    csvRow(["Vault", formatGrams(statement.vault)]),
    csvRow(["With karigars", formatGrams(statement.withKarigars)]),
    csvRow(["At refiner", formatGrams(statement.atRefiner)]),
    csvRow(["Total", formatGrams(statement.total)]),
    "",
    csvRow(["Movements on the day", "Fine gold (g)"]),
    csvRow(["Issued to karigars", formatGrams(statement.dayMovements.issued)]),
    csvRow(["Received from karigars", formatGrams(statement.dayMovements.received)]),
    csvRow(["Sent to refiner", formatGrams(statement.dayMovements.toRefiner)]),
    csvRow(["Returned from refiner", formatGrams(statement.dayMovements.fromRefiner)]),
    "",
    csvRow(["Karigar code", "Karigar", "Open jobs", "Fine gold held (g)"]),
    ...statement.perKarigar.map((k) => csvRow([k.code, k.name, k.openJobs, formatGrams(k.balance)])),
  ];
  return lines.join("\r\n") + "\r\n";
}
