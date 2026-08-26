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

Seven suites, ~190 checks, all against a real database. No mocks — the things
most likely to break (PostGIS predicates, exclusion constraints, serialization
retries) cannot be mocked meaningfully.

| Suite | Covers |
|---|---|
| `db:smoke` | PostGIS present, geog/latlng agreement, radius and bounds |
| `test:search` | Filters, sorting, pagination, clustering, mobile matching |
| `test:pricing` | Pro-rating, minimums, GST order, integer safety |
| `test:requests` | Competing requests, confirmation, decline, withdrawal |
| `test:owner` | Listing creation, verification gating, ownership scoping |
| `test:admin` | Approval, rejection, suspension cascade, audit trail |
| `test:sales` | Snapshot/drift, location privacy, projection allow-lists, enquiry limits |
| `test:auth` | Sign-in, role separation, request privacy (needs a server) |

**Tests must be idempotent.** They run against a shared database and clean up
after themselves. `test:auth` originally failed on its second run because it
left a request behind and hit its own duplicate guard — a test-isolation bug
that looked exactly like a product bug.

The prefix-and-cleanup harness (`PREFIX` + `cleanup()`, baseline asserted
restored at the end) is what makes that safe. Follow it exactly in any new
suite.

**`db:smoke` is the exception, and it is worth knowing why it fails.** It
asserts absolute counts — "50 searchable assets", "all locations have geog" —
so *any* asset created by hand through the dev UI makes it fail. That is a
statement about the database, not about the code. A DRAFT asset saved without
coordinates legitimately has `lat`/`lng`/`geog` all NULL. Before chasing a
smoke failure, check whether a stray non-seed row explains it; `pnpm db:seed`
resets the demo data.

---

## 9. Migrations

Seven, applied in order, all hand-numbered. Several cannot be generated:

| Migration | Why it is hand-written |
|---|---|
| `0000_enable_postgis` | Must run first; created **by migration** so new Neon branches and CI databases get it automatically |
| `0001_init` | Generated DDL **plus** GiST indexes, the trigger, and the exclusion constraint |
| `0002_enquiry_model` | Enum values only — Postgres forbids using a new enum value in the transaction that adds it |
| `0003_enquiry_constraint` | Data migration and constraint rebuild |
| `0004_media_partner` | `MEDIA_OWNER` → `MEDIA_PARTNER` |
| `0005_partner_type` | `PartnerType` column |
| `0006_sale_listings` | Sale enums and tables, GiST index on `publicGeog`, GIN indexes, a partial index for the public predicate, and the drift trigger |

Never edit an applied migration. Add a new one.

### `prisma migrate dev` will damage this database

`0001_init` created `BookingStatus` with 11 labels; the Prisma enum declares 7.
`migrate dev` resolves that by dropping four values, which Postgres can only do
by recreating the type — and that takes `BookingItem_no_overlap` with it. The
exclusion constraint in §3 is the single guarantee that two confirmed bookings
cannot overlap. Losing it silently is the worst failure this repo has
available.

So: write SQL by hand, apply with `prisma migrate deploy`, then
`prisma generate` (Prisma 7 no longer chains it) and `pnpm test`.

`migration_lock.toml` is committed. It was missing for a long time — nothing
had ever run `migrate dev` to create it — which meant `migrate diff
--from-migrations` could not run at all.

---

## 10. The sales marketplace

Added on top of the advertising marketplace without modifying it: every schema
change is additive, no column was dropped, no existing enum modified, and
`Verification` is untouched.

### Why new verification enums instead of extending `VerificationStatus`

Adding `DOCUMENTS_SUBMITTED` / `UNDER_REVIEW` to the existing enum would break
exhaustiveness in `admin-service.ts` and give `Asset` and `MediaOwner` states
that are meaningless for them. **Postgres cannot drop an enum value** — it is a
one-way door. So `SellerVerificationStatus`, `ListingVerificationStatus` and
`VerificationCheckStatus` are separate types.

`MediaOwner.saleVerificationStatus` is nullable, and null means *never engaged
with sales* — deliberately distinct from `UNVERIFIED`. Selling is a
higher-trust act than listing for advertising, so the two states must be able
to disagree.

### Location privacy: persist once, never jitter

`SaleListing.locationPrecision` defaults to `APPROXIMATE` (fail closed).

Random per-request jitter is **not** privacy. Zero-mean noise averages out, so
~100 requests recover the true point to a tenth of the jitter radius. The
public point is therefore computed once at publish and persisted to
`publicGeog`, snapped to a 0.01° grid at the **cell centre**:

```sql
ST_SetSRID(ST_SnapToGrid(al."geog"::geometry, 0.005, 0.005, 0.01, 0.01), 4326)::geography
```

The offsets matter: corner-snapping biases the point toward the origin and
gives away half a cell for free.

Persisting rather than snapping at query time is the important half of the
decision. *"No public query names `AssetLocation.geog`"* is verifiable with
grep; *"every public query remembers to snap"* has to be re-verified on every
future PR. `spatial.ts` already selects `l."lat", l."lng"` directly for
advertising search — precisely the shape of mistake that would leak here.

Two consequences:

- **Filter on truth, project approximation.** Radius and bbox predicates run
  against the real `geog`, so an approximate listing still appears in a search
  of the area it is genuinely in. Excluding it would cost the seller a buyer
  for no privacy gain — the buyer already knows what they searched.
- For `APPROXIMATE`, `addressLine`, `landmark` and `pincode` are never
  projected. A street address defeats coordinate snapping entirely.

`SalePropertyDetails` is a separate 1:1 table for the same reason. Land owner
name, survey/plot number and lease particulars sit behind a relation the public
read path never names, so it is **structurally incapable** of leaking them.
Inlined, one careless `findUnique` without a `select` ships `landOwnerName` to
an anonymous visitor. Public serialisers allow-list fields; they never delete
from a full row.

### Sale spatial SQL is parallel, not parameterised

`searchSaleListings` does not reuse `searchAssets` with a flag. The privacy
rule is a *projection* difference with no advertising analogue, and a shared
function would thread a "should I lie about the coordinates" boolean through a
path where forgetting it is a breach with no test to catch it. It would also
break the file's stated invariant that only ACTIVE + VERIFIED assets are
visible to advertisers.

### Snapshot at publish, flag drift, never auto-apply

Publishing copies title, description, taxonomy, `specs`, locality and image
URLs onto the listing. A buyer evaluating a 40×20 hoarding must not have it
silently become 20×10 because the seller edited the asset for an unrelated
advertising reason.

`snapshotImageUrls` holds **URLs, not FKs**, so deleting an `AssetImage` cannot
destroy the evidence of what the buyer saw.

Live-joined instead: `MediaOwner.companyName` and standing (the buyer wants
today's truth) and `Asset.status` / `verificationStatus` (an archived asset must
pull its listing — a business rule, not a snapshot).

Drift detection is an `AFTER UPDATE OF (title, description, specs, typeId,
categoryId, dailyImpressions) ON "Asset"` trigger that flags
`syncState = 'DRIFTED'` on live listings only. Naming the columns explicitly
means it never fires on rating rollups or `publishedAt`, so the hot path costs
nothing. The field-level diff is computed in the service layer when the seller
opens the listing.

The seller chooses: *accept* (re-snapshot) or *keep the published version* —
both legitimate, since they may have edited the asset for advertising only.
`SOLD` and `WITHDRAWN` listings refuse re-snapshot; the snapshot is the
historical record of what was sold.

Two things that bit during testing and will bite again: re-writing the *same*
value does not fire an `IS DISTINCT FROM` trigger, and comparing snapshots with
`JSON.stringify` is key-order sensitive (the lesson already recorded in
`owner-service.ts`'s `specsDiffer`).

### Documents are claims, not files

A `SaleDocument` row asserts that a document exists — type, number, issuing
authority, dates — with no file and no URL column. Legal documents change hands
off-platform, consistent with how booking confirmation already works, and
attaching them would demand signed URLs, per-viewer access checks and download
auditing that asset photos do not.

`visibility` still gates whether the *metadata* is shown.
`getVisibleSaleDocuments` returns a `hiddenCount` so the UI can say "3 further
documents available on request" without revealing what they are. Document
numbers, land owner name and survey number are never public.

### Trust labelling under auto-publish

Listings publish without review, so **no sale surface may render the word
"Verified"**. `VerificationBadge` is correct on the advertising side, where it
means staff inspected the site; a buyer reads it as verification of title.

`sale-trust.ts` renders `Seller-declared` in neutral tones — not amber or red,
because seller-declared is the normal case, not a warning — and labels every
level including the lowest, since an unlabelled field invites the assumption
that somebody checked it. `PLATFORM_REVIEWED` and `AUTHORITY_ISSUED` are
defined but unreachable, so Phase 2 adds review without touching components.

### One catch-all route

`/assets-for-sale/[slug]` and `/assets-for-sale/[city]` cannot be sibling
dynamic segments, so `[...segments]` resolves by segment **count** — no DB
lookup needed to disambiguate. One segment: `SALE_COLLECTIONS` (a closed set),
then cities. Two: an `AssetType.slug` match means a type landing, otherwise a
listing slug.

This is total only because **listing-slug generation rejects any slug
colliding with an `AssetType` slug**, enforced server-side at create.

`sale-routes.ts` must import nothing from `src/server/`. Client components
import `citySlug()` from it, so a Prisma import reaches the browser bundle and
the build fails on `tls`. That happened once — `isReservedByAssetType` lived
here and dragged Prisma in; it now lives in `sale-seller-service.ts`.

`PROTECTED_ROUTES` needed no change: `/assets-for-sale/**` is public via the
`authorized()` fall-through, and `/owner/sales/**` is covered by the existing
prefix.

### Public enquiries, authenticated offers

Enquiring needs no account, which makes it an unauthenticated POST that writes
a row. Mitigations, in order of how much they matter:

1. **The seller's phone and email are never in the enquiry response.** This is
   the big one — it removes the incentive to enumerate listings for contact
   scraping.
2. Messages are capped at 500 characters and reject any `http` substring,
   removing the payoff for link spam.
3. A DB-backed sliding window: per email, per hashed IP, and per
   email-per-listing-per-day. `ipHash` is a salted SHA-256 of
   `x-forwarded-for`, so the table is not a plaintext IP log.

None of that is a rate limiter or a captcha. It stops casual abuse, not a
determined actor — see the `TODO(phase-2)` in `sale-enquiry-service.ts`.

Offers require a session, no exception: an offer asserts financial intent, and
anonymous offers are unenforceable spam surface.

---

## 11. Client-side traps

Failures from this codebase that each looked like something else.

### `backdrop-blur` breaks `position: fixed`

`backdrop-blur`, `transform` and `filter` all establish a containing block, so
a `fixed` descendant positions against the blurred ancestor rather than the
viewport. The navbar has `backdrop-blur`, which clipped the mobile drawer
inside the header. The fix is `createPortal` to `document.body`.

Portalling then introduced a second bug: the outside-click handler treated taps
inside the portalled drawer as outside clicks, closing it on `pointerdown`
before the `click` could land, so every link silently did nothing. The handler
must check **both** the trigger container and the drawer refs.

### Scrims cannot use `--foreground`

`bg-foreground/40` looks right in light mode and *lightens* the page in dark
mode, because `--foreground` is a light colour there. Overlay scrims use
`bg-black/60` explicitly. The same bug existed in `map-client.tsx`.

### MapLibre's worker must be self-hosted

MapLibre v6 resolves its worker by URL and Turbopack does not rewrite it — the
browser requested a path that returned HTML and refused it for a disallowed
MIME type. The throw during map init left the whole page un-hydrated, so the
visible symptom was *"the nav drawer is broken"* on a page whose map was
off-screen.

`scripts/copy-maplibre-worker.mjs` copies the worker **and its
`maplibre-gl-shared.mjs` sibling** into `public/maplibre/` on `predev` /
`prebuild`, and `src/lib/map/config.ts` calls `setWorkerUrl`. `public/maplibre/`
is gitignored as a build artifact.

The general lesson: a JS error in one client component can leave an entire
route un-hydrated, so an apparently-unrelated interaction breaks. Check the
console before believing the symptom.

### `tailwindcss-animate` is not installed

`ui/dialog.tsx` carries `animate-in` / `slide-in-from-*` classes that are
**silently inert** — no plugin defines them. Keyframes used by real animations
are hand-written in `globals.css`. Adding an `animate-*` class from a shadcn
snippet will do nothing; write the keyframe.

### Theme has three states, so tokens are defined three times

Explicit `data-theme="light"` / `"dark"` on the root, plus a default "system"
that sets no attribute and falls through to `prefers-color-scheme`. Every token
therefore needs defining in bare `:root`, in
`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, and in
`:root[data-theme="dark"]` — or the toggle wins in one direction only.

---

## 12. SEO surfaces

`sitemap.ts` and `robots.ts` are generated, with `revalidate = 3600`. The
sitemap covers static routes, blog posts, city landings, published assets and
published sale listings.

Its queries **mirror the public search predicates exactly**. A sitemap that
lists a URL the page would 404 on is worse than no sitemap, so the filters
cannot be approximated — if the public predicate changes, this changes with it.

`metadataBase` comes from `NEXT_PUBLIC_APP_URL`. Unset, it silently falls back
to `http://localhost:3000` and every canonical on the site points at a host no
crawler can reach. That shipped to production once. `NEXT_PUBLIC_*` values are
inlined at build time, so fixing it requires a redeploy, not just an env
change — the same trap caught the GA measurement id.

Blog content lives in `src/content/blog.ts` as typed block unions rather than
MDX: no pipeline, no runtime parser, and posts render through the same
components as the rest of the site.

---

## 13. Conventions

- **Money is integer paise.** Never floats. `formatPaise()` for display.
- **Dates are half-open `[)`** everywhere, matching the database.
- **Services own queries.** UI imports from `src/server/services/*`, never
  Prisma directly.
- **Zod at every boundary** — URL params, request bodies, raw SQL results.
- **Typed failures over exceptions** for expected outcomes. `{ ok: false,
  failure: { kind: "unavailable" } }` maps cleanly to a status code; a thrown
  error becomes a 500.
- **Comments explain *why*.** The what is readable from the code.
- **Public serialisers allow-list.** Build a public payload by naming the
  fields it may contain, never by taking a full row and deleting from it. A
  new private column then defaults to hidden instead of leaking.
- **No Server Actions.** Writes are REST handlers under
  `src/app/api/**/route.ts`, called with TanStack `useMutation` + `fetch`, then
  `router.refresh()`. `grep "use server"` returns nothing and should stay that
  way.
- **Forms are `useState` + manual `safeParse`.** `react-hook-form` is
  installed but unused. Follow `add-asset-wizard.tsx`: every numeric field held
  as a `string`, first-issue-per-field error map.
- **One layout.** No route groups, no `loading.tsx` / `error.tsx` /
  `not-found.tsx`. Pages render `<Navbar />` themselves; section tabs are
  components (`admin-nav.tsx`, `owner-nav.tsx`), not nested layouts.
