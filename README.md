# Karigar Ledger

Gold issue and receipt ledger for a jewellery workshop. Every gram of fine gold that leaves the vault is tracked per karigar and per job until it comes back as a finished piece, scrap, filings or an agreed wastage allowance. Scale photos are read by a vision model and confirmed by the clerk before anything is saved.

## Run locally

```bash
cp .env.example .env          # fill AUTH_SECRET, optionally ANTHROPIC_API_KEY
docker compose up -d          # Postgres 16 on port 5433
pnpm install
pnpm db:migrate               # applies migrations
pnpm db:seed                  # karigars, categories, two months of ledger
pnpm dev                      # http://localhost:3000
```

## Test

```bash
pnpm test
```

See `deployment.md` for hosting and demo logins.
