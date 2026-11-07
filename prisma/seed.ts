import "dotenv/config";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type EntryType, type Location } from "../src/generated/prisma/client";
import { fineWeight, grams } from "../src/lib/gold/fine-gold";
import { settleAndCloseJob } from "../src/lib/ledger/settle-job";
import { DEFAULT_SETTINGS } from "../src/lib/policy";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Deterministic so every reviewer sees the same ledger.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026_11_07);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

const IST = (y: number, m: number, d: number, h = 10, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h - 5, min - 30));

const TODAY = IST(2026, 11, 7, 18, 30);
const START = IST(2026, 9, 1);

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@1234";

const categories = [
  { name: "Necklace", defaultWastagePct: "3.00" },
  { name: "Bangle", defaultWastagePct: "2.50" },
  { name: "Chain", defaultWastagePct: "2.75" },
  { name: "Ring", defaultWastagePct: "2.00" },
  { name: "Earring", defaultWastagePct: "2.25" },
] as const;

// lossShare is how much of the agreed allowance a karigar really uses; drift adds percentage
// points per month from October. Selvam R drifts upward, which is the story the alerts should tell.
const karigars = [
  { code: "K-01", name: "Murugesan S", phone: "+91 98430 11201", lossShare: 0.9, drift: 0 },
  { code: "K-02", name: "Selvam R", phone: "+91 98430 11202", lossShare: 0.72, drift: 1.0 },
  { code: "K-03", name: "Kumar P", phone: "+91 98430 11203", lossShare: 0.68, drift: 0 },
  { code: "K-04", name: "Rajendran V", phone: "+91 98430 11204", lossShare: 0.82, drift: 0 },
  { code: "K-05", name: "Anbu M", phone: "+91 98430 11205", lossShare: 0.6, drift: 0 },
  { code: "K-06", name: "Sakthivel K", phone: "+91 98430 11206", lossShare: 0.78, drift: 0 },
  { code: "K-07", name: "Dhanapal G", phone: "+91 98430 11207", lossShare: 0.7, drift: 0 },
  { code: "K-08", name: "Ilango T", phone: "+91 98430 11208", lossShare: 0.75, drift: 0 },
] as const;

const PURITIES = ["91.60", "91.60", "91.60", "75.00", "91.60", "99.50"] as const;

type PendingEntry = {
  type: EntryType;
  from: Location;
  to: Location;
  karigarId?: string;
  jobId?: string;
  gross: Decimal;
  purity: string;
  fine: Decimal;
  huid?: string;
  note?: string;
  at: Date;
  fixedTxn?: string;
};

type PendingClose = { jobId: string; at: Date };

async function main() {
  await db.auditEvent.deleteMany();
  await db.lossAlert.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.scaleReading.deleteMany();
  await db.job.deleteMany();
  await db.karigarAllowance.deleteMany();
  await db.karigar.deleteMany();
  await db.itemCategory.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.create({ data: { key, value } });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const clerk = await db.user.create({
    data: { email: "clerk@karigar.demo", name: "Priya N", role: "CLERK", passwordHash },
  });
  const finance = await db.user.create({
    data: { email: "finance@karigar.demo", name: "Venkatesh R", role: "FINANCE_HEAD", passwordHash },
  });

  const categoryRows = await Promise.all(
    categories.map((c) => db.itemCategory.create({ data: c })),
  );
  const categoryByName = Object.fromEntries(categoryRows.map((c) => [c.name, c]));

  const karigarRows: Array<(typeof karigars)[number] & { id: string }> = [];
  for (const k of karigars) {
    const row = await db.karigar.create({
      data: { code: k.code, name: k.name, phone: k.phone, joinedAt: IST(2024, 3, 1) },
    });
    for (const c of categoryRows) {
      // Senior karigars negotiated a quarter point either way on some categories.
      const tweak = pick([0, 0, 0, 0.25, -0.25]);
      const allowed = new Decimal(c.defaultWastagePct).plus(tweak).toFixed(2);
      await db.karigarAllowance.create({
        data: { karigarId: row.id, categoryId: c.id, allowedWastagePct: allowed },
      });
    }
    karigarRows.push({ ...k, id: row.id });
  }

  const entries: PendingEntry[] = [];
  const closes: PendingClose[] = [];

  entries.push({
    type: "VAULT_OPENING",
    from: "EXTERNAL",
    to: "VAULT",
    gross: grams("6000.000"),
    purity: "99.99",
    fine: fineWeight("6000.000", "99.99"),
    note: "Opening fine-gold stock, Sep 1",
    at: START,
  });

  let jobSeq = 2501;
  const SAMPLE_JOB_NUMBER = "JOB-2611";
  const allowanceCache = new Map<string, string>();
  for (const a of await db.karigarAllowance.findMany()) {
    allowanceCache.set(`${a.karigarId}:${a.categoryId}`, a.allowedWastagePct.toString());
  }

  function nextJobNumber() {
    const number = `JOB-${jobSeq++}`;
    return number === SAMPLE_JOB_NUMBER ? nextJobNumber() : number;
  }

  async function openJob(karigar: (typeof karigarRows)[number], categoryName: string, openedAt: Date, description: string) {
    const category = categoryByName[categoryName];
    const allowedPct = allowanceCache.get(`${karigar.id}:${category.id}`)!;
    return db.job.create({
      data: {
        jobNumber: nextJobNumber(),
        karigarId: karigar.id,
        categoryId: category.id,
        description,
        allowedPct,
        openedAt,
      },
    });
  }

  const descriptions: Record<string, string[]> = {
    Necklace: ["Temple necklace, 22K", "Short necklace with pendant", "Bridal haram, 22K"],
    Bangle: ["Pair of plain bangles", "Set of 4 kada bangles", "Antique bangles, pair"],
    Chain: ["Box chain, 22K", "Rope chain 24 inch", "Men's curb chain"],
    Ring: ["Engagement ring, 18K", "Plain band set of 3", "Stone-set cocktail ring"],
    Earring: ["Jhumka pair", "Studs, 18K", "Chandbali pair"],
  };

  // Two months of ordinary work: each karigar opens a job every 3 to 5 days.
  for (const karigar of karigarRows) {
    let cursor = new Date(START.getTime() + between(0, 3) * 86_400_000);
    while (cursor < TODAY) {
      const categoryName = pick(categories).name;
      const job = await openJob(karigar, categoryName, cursor, pick(descriptions[categoryName]));
      const purity = pick(PURITIES);
      const gross = grams(between(18, 260));
      const issuedFine = fineWeight(gross, purity);
      entries.push({
        type: "ISSUE",
        from: "VAULT",
        to: "KARIGAR",
        karigarId: karigar.id,
        jobId: job.id,
        gross,
        purity,
        fine: issuedFine,
        at: cursor,
      });

      const daysToFinish = between(3, 9);
      const finishAt = new Date(cursor.getTime() + daysToFinish * 86_400_000);
      if (finishAt < TODAY) {
        const monthsIn = (cursor.getTime() - START.getTime()) / (30 * 86_400_000);
        const lossPct =
          Number(job.allowedPct) * karigar.lossShare +
          karigar.drift * Math.max(0, monthsIn - 1) +
          between(-0.2, 0.2);
        const returnedGross = gross.mul(1 - lossPct / 100);
        const scrapShare = between(0.03, 0.07);
        const filingsShare = between(0.01, 0.025);
        const pieceGross = grams(returnedGross.mul(1 - scrapShare - filingsShare));
        const scrapGross = grams(returnedGross.mul(scrapShare));
        const filingsGross = grams(returnedGross.minus(pieceGross).minus(scrapGross));
        entries.push({
          type: "RECEIPT_PIECE",
          from: "KARIGAR",
          to: "VAULT",
          karigarId: karigar.id,
          jobId: job.id,
          gross: pieceGross,
          purity,
          fine: fineWeight(pieceGross, purity),
          huid: `HUID${String(Math.floor(between(100000, 999999)))}`,
          at: finishAt,
        });
        entries.push({
          type: "RECEIPT_SCRAP",
          from: "KARIGAR",
          to: "VAULT",
          karigarId: karigar.id,
          jobId: job.id,
          gross: scrapGross,
          purity,
          fine: fineWeight(scrapGross, purity),
          at: new Date(finishAt.getTime() + 60_000),
        });
        if (filingsGross.greaterThan(0)) {
          entries.push({
            type: "RECEIPT_FILINGS",
            from: "KARIGAR",
            to: "VAULT",
            karigarId: karigar.id,
            jobId: job.id,
            gross: filingsGross,
            purity,
            fine: fineWeight(filingsGross, purity),
            at: new Date(finishAt.getTime() + 120_000),
          });
        }
        closes.push({ jobId: job.id, at: new Date(finishAt.getTime() + 180_000) });
      }
      cursor = new Date(cursor.getTime() + between(3, 5) * 86_400_000);
    }
  }

  // The client's own sample rows for Murugesan S, kept with their slip numbers.
  const murugesan = karigarRows.find((k) => k.code === "K-01")!;
  const sampleJob = await db.job.create({
    data: {
      jobNumber: SAMPLE_JOB_NUMBER,
      karigarId: murugesan.id,
      categoryId: categoryByName.Necklace.id,
      description: "Necklace, 22K (sample job)",
      allowedPct: "3.00",
      openedAt: IST(2026, 10, 28, 11, 5),
    },
  });
  entries.push(
    {
      type: "ISSUE",
      from: "VAULT",
      to: "KARIGAR",
      karigarId: murugesan.id,
      jobId: sampleJob.id,
      gross: grams("120.000"),
      purity: "91.60",
      fine: fineWeight("120.000", "91.60"),
      at: IST(2026, 10, 28, 11, 5),
      fixedTxn: "TX-30411",
    },
    {
      type: "RECEIPT_PIECE",
      from: "KARIGAR",
      to: "VAULT",
      karigarId: murugesan.id,
      jobId: sampleJob.id,
      gross: grams("112.450"),
      purity: "91.60",
      fine: fineWeight("112.450", "91.60"),
      huid: "HUID4K7P2M",
      at: IST(2026, 11, 3, 16, 40),
      fixedTxn: "TX-30437",
    },
    {
      type: "RECEIPT_SCRAP",
      from: "KARIGAR",
      to: "VAULT",
      karigarId: murugesan.id,
      jobId: sampleJob.id,
      gross: grams("3.300"),
      purity: "91.60",
      fine: fineWeight("3.300", "91.60"),
      at: IST(2026, 11, 3, 16, 42),
      fixedTxn: "TX-30438",
    },
  );
  closes.push({ jobId: sampleJob.id, at: IST(2026, 11, 3, 16, 45) });

  // Scrap and filings go to the refiner at month end and come back a week later as a
  // 99.50 bar holding about 1% less fine gold, which is the refiner's own charge.
  for (const [month, out] of [
    [9, "212.500"],
    [10, "238.250"],
  ] as const) {
    const sentFine = fineWeight(out, "91.60");
    const returnedGross = grams(sentFine.mul("0.99").div("0.995"));
    entries.push({
      type: "REFINER_OUT",
      from: "VAULT",
      to: "REFINER",
      gross: grams(out),
      purity: "91.60",
      fine: sentFine,
      note: "Scrap and filings lot to refiner",
      at: IST(2026, month, 30, 15),
    });
    entries.push({
      type: "REFINER_IN",
      from: "REFINER",
      to: "VAULT",
      gross: returnedGross,
      purity: "99.50",
      fine: fineWeight(returnedGross, "99.50"),
      note: "Refined bar returned",
      at: IST(2026, month + 1, 6, 12),
    });
  }

  entries.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Number slips in date order, keeping the sample rows' published numbers.
  const reserved = new Set(entries.map((e) => e.fixedTxn).filter(Boolean) as string[]);
  let next = 30001;
  for (const entry of entries) {
    if (entry.fixedTxn) continue;
    while (reserved.has(`TX-${next}`)) next++;
    entry.fixedTxn = `TX-${next++}`;
  }

  for (const entry of entries) {
    await db.ledgerEntry.create({
      data: {
        txnNumber: entry.fixedTxn!,
        type: entry.type,
        fromLocation: entry.from,
        toLocation: entry.to,
        karigarId: entry.karigarId,
        jobId: entry.jobId,
        grossWeight: entry.gross.toFixed(3),
        purityPct: entry.purity,
        fineWeight: entry.fine.toFixed(3),
        huid: entry.huid,
        note: entry.note,
        occurredAt: entry.at,
        enteredById: clerk.id,
      },
    });
  }
  await db.$executeRaw`SELECT setval('txn_number_seq', ${next + 100})`;

  closes.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const close of closes) {
    await db.$transaction((tx) => settleAndCloseJob(tx, close.jobId, finance.id, close.at));
  }

  const alerts = await db.lossAlert.groupBy({ by: ["kind"], _count: true });
  const jobCount = await db.job.count();
  console.log(
    `Seeded ${karigarRows.length} karigars, ${jobCount} jobs, ${entries.length} ledger entries, alerts:`,
    Object.fromEntries(alerts.map((a) => [a.kind, a._count])),
  );
  console.log(`Demo logins: clerk@karigar.demo and finance@karigar.demo`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
