# Karigar Ledger

Gold issue and receipt ledger for a jewellery workshop. Every gram of fine gold that leaves the vault is tracked per karigar and per job until it comes back as a finished piece, scrap, filings or an agreed wastage allowance. Scale photos are read by a vision model and confirmed by the clerk before anything is saved; loss that drifts from a karigar's own history is raised to the finance head as an item to review.

Built for the Isocode take-home brief "Jewellery chain's karigar gold ledger and old-gold desk app".

## What is in the core build

- Karigar master with agreed wastage % per item category
- Issue entry: gross weight, purity, fine weight to 3 decimals, job number, printable slip, running balance
- Receipt entry: finished piece with HUID, scrap, filings; allowed vs actual wastage; job settlement
- Loss alerts for the finance head: over allowance, and drift from the karigar's own median
- Daily stock statement: vault, with karigars, at refiner, with CSV export for Tally
- Scale photo reading with confirm-beside-photo; a typed value that contradicts the photo blocks saving
- Two roles: issue clerk and finance head

## Stack

Next.js 16 (App Router, server actions), TypeScript, Prisma 7 on PostgreSQL 16, Auth.js credentials, Tailwind v4, decimal.js for the gold maths, vitest, Anthropic SDK for the photo reader with a mock adapter for local dev.

## Run locally

```bash
cp .env.example .env          # set AUTH_SECRET; ANTHROPIC_API_KEY optional
docker compose up -d          # Postgres 16 on port 5433
pnpm install
pnpm db:migrate
pnpm db:seed                  # karigars, categories, two months of ledger, demo users
pnpm dev                      # http://localhost:3000
```

Demo logins and hosting details are in [deployment.md](deployment.md).

## Test

```bash
pnpm test        # fine-gold maths, settlement, drift rule, input parsing
pnpm lint
```

## Layout

```
prisma/            schema, migrations, seed
src/app/(auth)     sign-in
src/app/(app)      today, issue, receipt, karigars, jobs, slips, alerts, stock
src/app/api        photo readings, stock CSV, auth
src/lib/gold       fine-gold.ts (decimal rules), loss-drift.ts (alert rule)
src/lib/ledger     record-entry.ts, settle-job.ts, queries.ts, stock-csv.ts
src/lib/scale-reader  reader port, Claude adapter, mock adapter
src/components     shell, ui primitives, ScalePhotoCapture
```
