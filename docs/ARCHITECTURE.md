# Architecture

Why the unusual parts of this codebase are the way they are. If you are only
trying to run the app, [README.md](../README.md) is enough — this is for when
something looks wrong and you need to know whether it is.

---

## 1. The marketplace model

**ZuperGo does not own or control the inventory it lists.** Every asset belongs
to an independent media partner who may also sell it through their own channels.
Almost every design decision below follows from that one fact.

| Consequence | Where it shows up |
|---|---|
| A request reserves nothing | Exclusion constraint applies only to `CONFIRMED` |
| Competing requests are legal | No duplicate check across advertisers |
| Prices are indicative | `PricingDisclosure` on every money surface |
| Availability is indicative | Calendar shows confirmed + blackouts only |
| No payment is taken | No gateway; partners invoice directly |

The failure mode this guards against: an advertiser believing they have secured
a billboard when they have only enquired. Every label in the request flow is
worded against that.

---

## 2. Data layer

### PostGIS through `Unsupported()`

Prisma cannot read or write geography columns. They are declared
`Unsupported("geography(Point, 4326)")`, which lets Prisma create and index them
but not touch their values.

Two consequences you will hit:

1. **Every geography write goes through `src/server/db/spatial.ts`.** Creating
   an asset with coordinates is a `create()` followed by `setAssetPoint()`. Miss
   the second call and the asset exists but never appears on the map — see
   `createAsset()` for the pattern.

2. **Denormalised `lat`/`lng` sit alongside `geog`.** List rendering and map
   pins read those, so ordinary reads stay on the typed client. `db:smoke`
   asserts the two never drift.

### Raw SQL is confined to one module

`spatial.ts` is the only file with raw SQL. Two rules inside it:

- **Interpolate only through `Prisma.sql` tagged templates.** Bounds and filter
  values come from the query string; string concatenation would be injection.
- **Parse every result through Zod.** `$queryRaw<T>` is an unchecked assertion,
  not a guarantee — Postgres returns `bigint` for `COUNT()` as a *string*, and
  the declared type will happily lie about it.

### Three location shapes, one query

A billboard has a point. A van has an operating area. A bus has a route. The
search predicate unions all three, which is why a mobile asset based in Andheri
correctly appears in a search centred on BKC.

That also explains something that looks like a bug: **`distanceMeters` is null
for mobile assets.** They match via their operating area, so a distance to their
base point would misrepresent coverage. The UI shows "Area coverage" instead.

---

## 3. Booking integrity

### The exclusion constraint

`BookingItem_no_overlap` makes double-confirmation impossible at the database
level:

```sql
EXCLUDE USING GIST ("assetId" WITH =, "period" WITH &&)
WHERE ("holdsInventory" = true AND "bookingModel" <> 'DIGITAL_SLOT')
```

Three things to know:

**`period` is a trigger-maintained `tstzrange`**, not a generated column —
Prisma would try to write a generated column. Half-open `[)`, so a campaign
ending on the 30th does not collide with one starting on the 30th.

**`holdsInventory` is a denormalised boolean**, not a subquery. An exclusion
constraint's `WHERE` clause must be `IMMUTABLE`, so it cannot reference
`Booking.status`. Two triggers keep the flag in sync; `test-requests.ts` proves
cancellation releases inventory.

**`DIGITAL_SLOT` is exempt.** A DOOH screen sells N slots per loop, so overlap
is legal up to capacity. Those bookings run in a `SERIALIZABLE` transaction that
counts existing slots first.

### Serialization retries

Digital slot bookings can abort with a write conflict under contention. Prisma
surfaces this **three different ways**, and `isSerializationFailure()` in
`src/server/db/errors.ts` handles all of them:

1. `PrismaClientKnownRequestError` code `P2034`, with `40001` nested in
   `meta.driverAdapterError.cause`
2. A bare `DriverAdapterError` whose entire message is `TransactionWriteConflict`
   — **no code, no meta**
3. Raw SQLSTATE `40001`

Shape 2 is the one that matters: missing it turns a routine conflict into a 500.
The retry budget is 6 with jittered backoff, because 5 concurrent writers can
force more than 3 retries.

---

## 4. Data-driven taxonomy

68 asset types, and **no component names any of them.**

```
AssetType.specSchema  (JSONB, array of field descriptors)
        │
        ├─→ DynamicSpecFields      renders the listing wizard's form
        ├─→ buildSpecValidator     compiles a Zod schema at runtime
        └─→ SpecificationTable     renders the detail page
```

A descriptor is `{ name, label, input, unit, required, options, group, order,
help, sensitive }`. The wizard also computes **its own steps** from the type:
`isDigital` adds a Slots step, `isMobile` adds Coverage.

Two details worth knowing:

- **`sensitive: true` fields never render publicly.** Vehicle registration
  plates are collected and shown to admins, but publishing them would let anyone
  track a specific vehicle. `test-owner.ts` asserts the plate is absent from the
  rendered page.
- **`prisma/taxonomy.ts` is seed data, not runtime code.** Nothing in `src/`
  imports it. `src/lib/specs.ts` re-declares the descriptor shape as a Zod
  schema, which is the contract between them — a mismatch surfaces as a parse
  failure, not a crash.

---

## 5. Pricing

`src/lib/pricing.ts` is pure, dependency-free, and the **single** implementation
used by the browser quote, the server total, and the tests.

- **Integer paise throughout.** Every intermediate result is rounded.
- **Pro-rated, not rounded up.** Five days on a monthly rate is `5/30` of the
  month. The original `Math.ceil(days / 30)` overcharged six-fold.
- **3dp rounding on unit counts.** At 2dp, `5/30` rounds *up* to 0.17 — a 2%
  overcharge always favouring the partner.
- **`minDuration` is the honest escape hatch.** A partner who will not sell
  below a month says so; the quote reports `minimumApplied` and the UI explains
  the uplift.
- **Discount applies on days booked**, not billable units, so "10% off 30+ days"
  behaves the same on a daily or monthly rate card.

---

## 6. Auth

### The Edge/Node split

`src/server/auth/config.ts` is **Edge-safe**: callbacks, page paths, session
shape. No Prisma, no bcrypt.

`src/server/auth/index.ts` is **Node-only**: the Credentials provider and the
Prisma adapter.

Middleware imports only the first. Mixing them produces a build that succeeds
and then fails at the first middleware invocation.

### Middleware must be a real function

```ts
export default function middleware(request: NextRequest) { ... }   // works
export const { auth: middleware } = NextAuth(authConfig);          // silently broken
```

Next 16 detects the export by static analysis. The destructured form typechecks,
builds, logs a warning — and **leaves every protected route open**. If you touch
`src/middleware.ts`, verify with `curl -I localhost:3000/admin` and expect a 307.

### Layered guards

Middleware blocks unauthenticated requests to protected prefixes. It cannot
express per-record ownership, so services check again:

- `requireUser(roles?)` — signed in, optionally with a role
- `requireOwner()` — resolves the partner record **from the session**, never
  from a caller-supplied id
- `requireAdmin()` — single chokepoint, fails closed

Queries are additionally scoped by `ownerId`, so a mismatched id affects zero
rows rather than someone else's data.

### Deliberate non-disclosure

- Wrong password and unknown email return **identically**, and a bcrypt compare
  runs even with no user so timing cannot distinguish them.
- A request belonging to someone else returns **404, not 403** — confirming a
  reference exists would let it be probed.
- `callbackUrl` accepts only same-origin relative paths (open-redirect guard).

---

## 7. Rendering

| Kind | Pages |
|---|---|
| Static / ISR | none currently — the navbar reads the session |
| Dynamic | everything else |

The homepage and `/explore` became dynamic when the navbar started reading the
session. That is correct but costs ISR caching. **If homepage performance
matters, make the navbar's user menu a client island** — worth doing before
launch, not before then.

`/owner/*` and `/admin/*` are `force-dynamic` explicitly. They were being
prerendered at one point, which baked one account's dashboard into the build
output — a correctness bug then, a data leak once auth landed.

---

## 8. Testing

Six suites, ~154 checks, all against a real database. No mocks — the things most
likely to break (PostGIS predicates, exclusion constraints, serialization
retries) cannot be mocked meaningfully.

| Suite | Covers |
|---|---|
| `db:smoke` | PostGIS present, geog/latlng agreement, radius and bounds |
| `test:search` | Filters, sorting, pagination, clustering, mobile matching |
| `test:pricing` | Pro-rating, minimums, GST order, integer safety |
| `test:requests` | Competing requests, confirmation, decline, withdrawal |
| `test:owner` | Listing creation, verification gating, ownership scoping |
| `test:admin` | Approval, rejection, suspension cascade, audit trail |
| `test:auth` | Sign-in, role separation, request privacy (needs a server) |

**Tests must be idempotent.** They run against a shared database and clean up
after themselves. `test:auth` originally failed on its second run because it
left a request behind and hit its own duplicate guard — a test-isolation bug
that looked exactly like a product bug.

---

## 9. Migrations

Five, applied in order. Two are hand-written and cannot be generated:

| Migration | Why it is hand-written |
|---|---|
| `0000_enable_postgis` | Must run first; created **by migration** so new Neon branches and CI databases get it automatically |
| `0001_init` | Generated DDL **plus** GiST indexes, the trigger, and the exclusion constraint |
| `0002_enquiry_model` | Enum values only — Postgres forbids using a new enum value in the transaction that adds it |
| `0003_enquiry_constraint` | Data migration and constraint rebuild |
| `0004_media_partner` | `MEDIA_OWNER` → `MEDIA_PARTNER` |
| `0005_partner_type` | `PartnerType` column |

Never edit an applied migration. Add a new one.

---

## 10. Conventions

- **Money is integer paise.** Never floats. `formatPaise()` for display.
- **Dates are half-open `[)`** everywhere, matching the database.
- **Services own queries.** UI imports from `src/server/services/*`, never
  Prisma directly.
- **Zod at every boundary** — URL params, request bodies, raw SQL results.
- **Typed failures over exceptions** for expected outcomes. `{ ok: false,
  failure: { kind: "unavailable" } }` maps cleanly to a status code; a thrown
  error becomes a 500.
- **Comments explain *why*.** The what is readable from the code.
