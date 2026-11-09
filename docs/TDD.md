# Karigar Ledger: Technical Design Document

**GitHub:** https://github.com/satyamsolanki100/karigar-ledger
**Live app:** https://karigar-ledger.vercel.app
**Author:** Satyam Kumar Solanki · November 2026
**Brief:** Jewellery chain's karigar gold ledger and old-gold desk app (Company A, Coimbatore)

## 1. What was built

The core build from the brief, end to end: karigar master with agreed wastage per item category, issue and receipt entries with exact fine-gold maths to 3 decimals, running fine-gold balances per karigar, loss alerts that go to the finance head, and a daily stock statement with a Tally-style CSV export. Two roles, issue clerk and finance head. The AI part reads photos of the scale display or karat meter, shows the reading beside the photo for the clerk to confirm, and blocks saving when a typed value contradicts a confident reading.

Eight screens: Sign in, Today, Issue gold, Record receipt, Karigars (list and detail), Jobs (list and detail with settlement), Loss alerts, Daily stock statement. Slips print from the browser.

Everything runs on realistic seeded data: 8 karigars, 5 item categories, 138 jobs and 520 slips over September to November 2026, including the client's three sample rows for Murugesan S under their original slip numbers TX-30411, TX-30437 and TX-30438.

## 2. Architecture and why

One Next.js 16 application (App Router, server actions, route handlers) on top of PostgreSQL 16 through Prisma 7. Auth.js handles credential sign-in with a JWT session that carries the role. Tailwind v4 for styling. decimal.js for every gold figure. The Anthropic SDK reads photos. Deployed as a single unit on Vercel with Neon Postgres.

Why one deployable rather than a separate API: the brief is a 6 to 8 screen internal tool with two roles and a tight budget (₹6 lakh, 6 weeks). Server actions give typed, validated mutations without a second service to host, version and secure. The hard parts of this product are correctness of the maths and clarity of the figures on screen, not scale; a split backend would add cost without buying anything the client asked for.

Why Postgres: the ledger is relational and append-only, balances are sums, and slip numbers must be unique across tablets. Sequences give collision-free TX and JOB numbers for free. Decimal columns (`numeric(10,3)` for grams, `numeric(5,2)` for purity) hold exact values; no floats anywhere in the gold path.

Why the photo goes through a port: the brief requires behaviour when the AI is wrong or unavailable. `ScaleReader` is an interface with two adapters, Claude vision and a deterministic mock. The app behaves identically with either, so local dev, tests and demos do not need an API key, and a provider change is one file.

Layering inside `src/`:

- `lib/gold`: pure functions. `fine-gold.ts` (rounding rules, fine weight, settlement, running balance, input parsing) and `loss-drift.ts` (alert rule). No I/O, fully unit tested.
- `lib/ledger`: use cases over Prisma. `record-entry.ts` (issue and receipt with all business checks), `settle-job.ts` (close a job, raise alerts, audit), `queries.ts` (balances, ledgers, stock statement), `txn-number.ts` (sequences).
- `lib/scale-reader`: the port and its adapters.
- `app/(app)/*`: screens. Server components read through `lib/ledger`, client components only where the form needs live feedback. Each mutation is a server action that re-checks the session and the role.
- `components/ui.tsx`: the small set of primitives every screen uses, including the `Grams` component that renders every weight with aligned decimals.

## 3. Data model

```
User            id, email, name, passwordHash, role (CLERK | FINANCE_HEAD)
ItemCategory    id, name, defaultWastagePct
Karigar         id, code (K-01), name, phone, active, joinedAt
KarigarAllowance (karigarId, categoryId) -> allowedWastagePct     agreed % per category
Job             id, jobNumber (JOB-2701), karigarId, categoryId, description,
                allowedPct (copied from the allowance when the job opens),
                status OPEN | CLOSED, openedAt, closedAt,
                settlement columns filled on close: issuedFine, receivedFine,
                lossGrams, allowedGrams, excessGrams, actualPct
LedgerEntry     id, txnNumber (TX-30411), type, fromLocation, toLocation,
                karigarId?, jobId?, grossWeight, purityPct, fineWeight, huid?,
                note?, occurredAt, enteredById, readingId?
ScaleReading    id, photo (bytes), photoMime, provider, readWeight?, readPurityPct?,
                confidence, rawResponse, status PENDING | CONFIRMED | REJECTED
LossAlert       id, karigarId, jobId, kind OVER_ALLOWANCE | DRIFT, allowedPct, actualPct,
                baselinePct?, excessGrams, status OPEN | REVIEWED | DISMISSED, reviewNote
AuditEvent      actorId, action, entityType, entityId, details, createdAt   (append-only)
Setting         key, value   (drift.points, drift.minHistoryJobs, oldGold.panThresholdInr, ...)
```

The ledger is double-entry by location. Every entry moves fine gold from one `Location` to another: `VAULT`, `KARIGAR`, `REFINER`, `EXTERNAL`. A karigar's balance is the sum of entries into `KARIGAR` for them minus the sum out. The vault balance, the refiner balance and the daily stock statement are the same query over different locations, so the three totals always add up to the fine gold the shop owns. This is what lets the finance head see "every gram that leaves my vault" without a separate stock table that can drift from the slips.

`Job.allowedPct` is a snapshot. If the finance head renegotiates a karigar's wastage next month, closed jobs are not retroactively rewritten; the audit log records who changed what.

## 4. Main flows

**Issue.** Clerk picks a karigar, opens a new job (item category sets the agreed wastage) or adds to an open one, enters gross weight and purity (22K, 18K, 24K presets), optionally photographs the scale. Fine weight and the balance after are shown live. On save: karigar must be active, job must be open and belong to that karigar, a photo reading, if attached, must match the typed values. The entry is written with the next TX number, the audit row is appended, and the slip page opens for printing.

**Receipt.** Clerk picks the open job, says what came back (finished piece with HUID, scrap, or filings), enters net weight and purity (defaults to the issue purity), optionally photographs the scale. The form shows live: fine coming back, still with karigar, allowed wastage, actual %, grams over allowance if closed now. A receipt that would bring the total returned above 102% of what was issued is rejected as a typing slip. Ticking "close the job" settles it in the same transaction.

**Settlement.** `settleJob` computes loss = issued − received, allowed = issued × agreed %, excess = loss − allowed, actual % = loss ÷ issued, all rounded half-up to 3 decimals for grams and 2 for percent. Results are stored on the job so history is immutable even if the maths module changes later.

**Alerts.** On close, `evaluateLoss` raises `OVER_ALLOWANCE` when excess > 0, and `DRIFT` when the job's gap to its own allowance is at least `drift.points` (default 0.50 points) above the median gap of the karigar's earlier closed jobs, given at least `drift.minHistoryJobs` (default 3) of them. Comparing gaps rather than raw percentages means a ring job (2% allowance) and a necklace job (3%) compare fairly. Alerts are grouped by karigar on the finance head's screen and worded as items to review; the finance head marks each reviewed or dismissed with a note. Clerks never see them.

**Stock statement.** For any day, balance by location at end of day, movements on the day, and per-karigar holdings. The CSV export is the layout the accounts team keys into Tally. Owner-only, enforced in the page and in the route handler.

## 5. The AI part

`POST /api/readings` accepts one photo (downscaled in the browser to 1280 px, max 5 MB) and a kind (`scale` or `karat`). The active `ScaleReader` returns `{ weight, purity, confidence, notes }`. The reading and the photo are stored, and the response tells the form whether the reading is `sure` (confidence ≥ 0.75 and at least one value read).

Claude adapter: `claude-opus-5-5`, effort `low`, a system prompt that restricts the model to legible digits, asks for a JSON object, and defines confidence as certainty about every digit including the decimal point. The response is parsed with a zod schema. A refusal, an unparsable reply, an API error or a timeout all degrade to "could not read, type the value", never to a guess.

When the AI is wrong:

- Below the threshold: the form shows "Not sure, type it" with the best guess and the model's note. Nothing is filled in.
- Confident but wrong: the reading fills the fields, the clerk sees it beside the photo and can correct it. The moment the typed value differs from the reading, the field is marked and the save button is disabled with "Typed value differs from the photo reading"; the server enforces the same check in `confirmReading`, so a stale form cannot bypass it. The clerk either fixes the typed value or retakes the photo.
- No API key or `SCALE_READER` not `claude`: the mock adapter derives a deterministic figure from the image hash, with one in five readings marked unsure, so the whole flow including the fallback can be demonstrated offline. It is clearly labelled `mock` on the slip.

Every reading is audited with provider and confidence, and every slip records whether its weight was confirmed from a photo or typed.

## 6. UI and design decisions

The brief asks for minimal design with nothing on screen that lacks a purpose, and figures that are easy to read and hard to misread.

- **Numbers first.** Every weight renders through one `Grams` component with tabular, lining numerals so decimals align in any column. Gold going out is amber, gold coming back is green, balances are larger and darker than the figures around them, and excess over allowance is red with a sign. Purity is always shown with 2 decimals, weight with 3.
- **One palette, warm paper background, white cards, one accent.** Pills carry state (Issue, Receipt, Open, Closed, Over allowance, Drifting) so tables stay text-only.
- **Forms give the answer before you save.** Fine weight, balance after, allowed wastage and grams over allowance update as the clerk types, so a wrong digit is caught before it becomes a slip.
- **Confirm beside the photo.** The photo and the reading sit next to the inputs, not in a modal, so the clerk's eye moves between the display, the reading and the typed value.
- **Phone layout.** The sidebar becomes a top scrolling tab bar under 768 px; cards stack; tables scroll horizontally inside their card. Checked at 375 px.
- **Printable slip.** The slip page is the printed slip: slip number, karigar, job, gross, purity, fine, balance after, who entered it and whether it was photo-confirmed.
- **Empty, loading and error states.** Every list has an empty state with the next action; every form shows a single error line from the server; buttons disable while pending.
- **Role-aware navigation.** Finance-only items (Loss alerts, Stock) are absent from the clerk's navigation and rejected server-side if reached by URL.

## 7. Security and validation

- Credentials hashed with bcrypt; sessions are signed JWTs valid 12 hours.
- The proxy redirects anonymous requests; every page and server action re-reads the session and role server-side.
- Every input is parsed with zod or a strict regex: weights up to 3 decimals, purity 0 to 100 with 2 decimals, HUID 6 alphanumerics, bounded text lengths. Business rules are enforced in `lib/ledger`, not in the UI.
- Uploads: JPEG, PNG or WebP only, 5 MB cap, photos served only to signed-in users.
- No secrets in the repository: `.env` is ignored, `.env.example` has names only, the seed reads `DEMO_PASSWORD` from the environment.
- Append-only audit of sign-in-protected actions: issue, receipt, job close, allowance change, karigar add, alert review, photo capture.
- Sample data uses invented names and phone numbers.

## 8. Tests

20 vitest unit tests cover the logic that would cost the client money if wrong:

- fine weight reproduces the client's sample rows exactly (109.920, 103.004, 3.023) and the balance column (6.916, 3.893)
- half-up rounding at the third decimal, no binary float drift on large or small values
- settlement: Murugesan's sample job is 0.595 g over the 3% allowance; loss exactly on the allowance is within; returning more than allowed gives a negative excess
- drift: needs three earlier jobs, compares gaps to allowance so categories compare fairly, ignores the current and later jobs when building the baseline, can raise both findings on one job
- input parsing rejects too many decimals, negatives, zero, commas and purity above 100

Flows were exercised end to end in the browser against the seeded database: sign-in with wrong and right passwords, issue, receipt with close, alert review, stock statement and CSV export, phone layout.

## 9. Assumptions

Labelled as the brief requires.

1. Allowed wastage is a percentage of the fine gold issued on the job, not of the finished weight. The sample row's 3.00% against 109.920 g issued is consistent with this.
2. Wastage is settled per job, when the job closes, and the running balance is per karigar across jobs. "Per karigar on any day" is the karigar's balance at the end of that day.
3. Rounding is half-up at 3 decimals for grams and 2 for percent, applied once per figure.
4. Receipts carry the issue purity by default; a karat meter photo can override it.
5. A receipt that brings the returned fine above 102% of what was issued is a data entry mistake and is rejected.
6. Drift thresholds (0.50 points above the karigar's own median gap, at least 3 earlier jobs) are starting values the finance head can change in the settings table; the right numbers come from a month of real data.
7. One workshop, one time zone (Asia/Kolkata); dates on screen are IST.
8. Photos are small enough to keep in Postgres for this build; object storage is the obvious next step.
9. Tally integration is a CSV in the stock journal layout, not a live connection.

## 10. What was cut and what comes next

Cut from the MUST HAVE list because the brief marks them as optional depth beyond the core build:

- **Old-gold desk** (customer exchange with tested purity, deductions, value, PAN and payment mode above the income-tax cash threshold, link to the exchange bill). The data model has the `oldGold.panThresholdInr` setting ready; the screen and the `OldGoldPurchase` table are the first thing to add.
- **Karigar phone view in Tamil** of their own slips and balance. The slip and ledger queries exist; this is a read-only route with a Tamil string table and a per-karigar login or OTP.
- **Offline tolerance on shared tablets.** Forms are small server-action posts and photos are downscaled client-side, but there is no queue for a lost connection yet. Next step is a service worker with an outbox for pending slips.
- **Refiner movements UI.** Refiner in and out entries exist in the ledger and the statement; they are seeded, not entered through a screen.

Beyond the brief, in order of value to the client: object storage for photos; a Playwright suite over the issue and receipt flows; a month-end reconciliation page that lists every open job older than a configurable age; two-person confirmation for issues above a weight threshold; WhatsApp slip delivery to the karigar (mocked message port is the pattern already used for the reader).

## 11. Use of AI tools

Claude Code was used to draft code, tests and this document against the brief, in small reviewed commits. The design decisions above, the maths rules, the drift metric and the seeded story (Selvam R drifting through October and November) are mine, and the maths was checked by hand against the client's sample rows before the first commit.
