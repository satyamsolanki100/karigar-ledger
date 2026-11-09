# Deployment

Repository: https://github.com/satyamsolanki100/karigar-ledger
Live app: https://karigar-ledger.vercel.app (Vercel, Neon Postgres in Singapore, mock photo reader until an Anthropic key is set)

## Run locally

Prerequisites: Node 22 or newer, pnpm 9, Docker Desktop.

```bash
git clone https://github.com/satyamsolanki100/karigar-ledger.git
cd karigar-ledger
cp .env.example .env
```

Edit `.env`: set `AUTH_SECRET` to any long random string (`openssl rand -base64 32`). Leave `ANTHROPIC_API_KEY` empty to use the built-in mock photo reader, or set it and `SCALE_READER=claude` to read real scale photos with Claude.

```bash
docker compose up -d        # Postgres 16 on localhost:5433
pnpm install
pnpm db:migrate             # applies prisma/migrations
pnpm db:seed                # 8 karigars, 138 jobs, two months of slips, demo users
pnpm dev                    # http://localhost:3000
```

Run the unit tests with `pnpm test` (fine-gold maths, wastage settlement, loss drift, input parsing). Lint and types: `pnpm lint` and `npx tsc --noEmit`.

To start over: `pnpm db:reset` drops and recreates the database and re-runs the seed.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Issue clerk | clerk@karigar.demo | Demo@1234 |
| Finance head | finance@karigar.demo | Demo@1234 |

The clerk can issue and receive gold and manage jobs. The finance head additionally sees loss alerts, the daily stock statement, and can add karigars and change agreed wastage. The password comes from `DEMO_PASSWORD` at seed time; the value above is the default.

## How it is deployed

One Next.js deployable on Vercel, a managed Postgres (Neon) for data, and the Anthropic API for photo reading. There is no separate backend process: server actions and route handlers run on Vercel's Node runtime, the proxy (auth redirect) runs on the edge runtime.

Steps:

1. Create a Postgres database (Neon free tier is enough). Copy its pooled connection string.
2. From a machine with the repo, apply migrations and seed against it:
   ```bash
   DATABASE_URL="<neon connection string>" pnpm db:deploy
   DATABASE_URL="<neon connection string>" DEMO_PASSWORD="<choose>" pnpm db:seed
   ```
3. Import the GitHub repo into Vercel. Framework preset Next.js, build command `pnpm build` (runs `prisma generate` first), install command `pnpm install`.
4. Set the environment variables below in Vercel, then deploy.

Photos are stored in Postgres as bytes after being downscaled in the browser to at most 1280 px on the long edge, so no object storage is needed for this build.

## Environment variables

Names only. Values live in the hosting provider's secret store and in a local `.env` that is never committed.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by Prisma and the app |
| `AUTH_SECRET` | Signs the Auth.js session JWT |
| `AUTH_TRUST_HOST` | `true` so Auth.js accepts the deployment host behind Vercel's proxy |
| `AUTH_URL` | Public URL of the deployment, for example `https://karigar-ledger.vercel.app` (optional on Vercel) |
| `ANTHROPIC_API_KEY` | Claude API key for reading scale and karat meter photos |
| `SCALE_READER` | `claude` to use the Claude reader, anything else or unset for the mock |
| `DEMO_PASSWORD` | Password given to the two seeded demo users (seed time only) |

## Operational notes

- Slip and job numbers come from Postgres sequences (`txn_number_seq`, `job_number_seq`), so concurrent clerks never collide.
- Every state change writes an `AuditEvent` row. Nothing in the ledger is edited or deleted; corrections are new entries.
- The photo reader is behind a port. If the Anthropic call fails or returns low confidence, the clerk is told to type the value; saving is blocked only when a typed value contradicts a confident reading.
- Business thresholds (drift points, minimum history, PAN threshold) are rows in the `Setting` table and can be changed without a deploy.
