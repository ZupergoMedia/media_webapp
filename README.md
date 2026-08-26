# ZuperGo Media

A marketplace for out-of-home advertising. Advertisers discover billboards,
digital screens, vehicles and venues on a map, then request availability from
the media partner who operates them.

There is a second marketplace alongside it: partners can put an asset **up for
sale**, and anyone can browse those listings without an account. See
[Assets for sale](#assets-for-sale).

**Find. Book. Be Seen.**

---

## Quick start

You need **Node 20+**, **pnpm**, and a **PostgreSQL 15+ database with PostGIS**.

```bash
pnpm install
cp .env.example .env        # then fill in DATABASE_URL (see below)
pnpm db:deploy              # create the schema
pnpm db:seed                # 50 Mumbai listings + demo accounts
pnpm dev                    # http://localhost:3000
```

If that worked, `pnpm db:smoke` should print 11 passing checks.

### Getting a database

Either works. **Docker** is the fastest start:

```bash
docker compose up -d        # PostGIS on localhost:5432
```

```env
DATABASE_URL="postgresql://zupergo:zupergo@localhost:5432/zupergo"
DIRECT_URL="postgresql://zupergo:zupergo@localhost:5432/zupergo"
```

**Neon** (or any hosted Postgres) also works — create a project and paste both
URLs. Use the pooled endpoint for `DATABASE_URL` and the direct one for
`DIRECT_URL`; migrations cannot run through a connection pooler.

You do **not** need to enable PostGIS by hand. The first migration does it, so
new branches and CI databases get it automatically.

### Demo accounts

Seeded with the password in `SEED_DEMO_PASSWORD` (see `.env.example`).

| Email | Role | What you can see |
|---|---|---|
| `advertiser@demo.zupergo.test` | Advertiser | Browse, request availability |
| `owner.skyline@demo.zupergo.test` | Media partner | 20 listings, requests inbox |
| `admin@demo.zupergo.test` | Admin | Verification queue, platform metrics |

Set `SEED_DEMO_PASSWORD` before seeding, or accounts are created **without a
password** and cannot be signed into. That is deliberate — it stops a deployed
database ending up with predictable credentials.

---

## The 60-second tour

Worth walking through in this order; it is the journey the product is built
around.

1. **`/explore`** — card grid, filter by city and media type
2. **Open any asset** — gallery, specs, audience, map, price panel
3. **Request availability** — pick dates, fill campaign details, send
4. **Sign in as the media partner** → **`/owner/requests`** — the request is
   there with the advertiser's phone and email
5. **Confirm or decline** — the advertiser's status page updates

Then try the thing that surprises people: **send two requests for the same
asset and dates from different accounts.** Both are accepted. See
[Requests, not bookings](#requests-not-bookings).

For the sales side: as the partner, **`/owner/sales/new`** → pick an existing
asset → publish. Then open **`/assets-for-sale` signed out** and confirm every
claim on the detail page reads *Seller-declared* and the word *Verified*
appears nowhere.

---

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm check            # generate + typecheck + lint  (run before pushing)

pnpm db:deploy        # apply migrations
pnpm db:seed          # reset demo data (idempotent)
pnpm db:studio        # browse the database
pnpm db:reset         # drop everything and re-migrate

pnpm test             # all database-backed suites
pnpm test:all         # the above plus test:auth (needs `pnpm dev` running)
pnpm db:smoke         # PostGIS + seed sanity check
```

`test:auth` drives real HTTP against a running dev server, so it is excluded
from `pnpm test`. Everything else runs against the database directly.

---

## Architecture

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 7 ·
PostgreSQL + PostGIS · MapLibre · Auth.js v5 · TanStack Query · Zod

```
src/
  app/                     routes (App Router)
    api/                   route handlers
    explore/               card grid
    map/                   full-screen map
    assets/[slug]/         asset detail + request wizard
    assets-for-sale/       public sale marketplace ([...segments] catch-all)
    blog/                  blog index + posts
    owner/                 media partner dashboard (inventory + sales)
    admin/                 verification and moderation
    partners/join/         partner registration
    sitemap.ts, robots.ts  crawler discovery
  components/
    marketplace/           asset cards, panels, pricing, disclosures
    sales/                 sale listing cards, ownership/rights, disclaimers
    map/                   MapLibre components
    layout/                navbar, menu, theme toggle
    analytics/             Google Analytics tag
    providers/             session, query, theme context
    ui/                    shadcn primitives
  content/
    blog.ts                blog posts as typed blocks (no MDX pipeline)
  server/
    db/                    Prisma client, raw spatial SQL, error helpers
    services/              business logic — the only place that touches Prisma
    auth/                  session, role guards
  lib/                     pure helpers (pricing, formatting, schemas)
prisma/
  schema.prisma            data model
  migrations/              SQL, including hand-written PostGIS and constraints
  seed.ts, taxonomy.ts     demo data
  test-*.ts                test suites
```

**Rule of thumb:** UI never talks to Prisma. Pages and routes call
`src/server/services/*`, which owns every query. That keeps business logic
testable without a browser and stops storage details leaking into components.

For the reasoning behind the parts that are unusual — the spatial layer, the
booking constraint, the taxonomy — see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Six things that will surprise you

Each of these looks like a bug until you know why it is that way.

### Requests, not bookings

ZuperGo does not own the inventory it lists. A billboard can be sold through the
partner's own sales channel at any moment, so **sending a request reserves
nothing**. Several advertisers may request the same asset and dates; the partner
chooses.

Only a partner **confirmation** claims a window. At that point a database
exclusion constraint prevents a second confirmation for overlapping dates — the
one thing that is physically impossible.

```
3 advertisers request 1–30 Sept  ->  all 3 accepted, nothing blocked
partner confirms one              ->  that window is now claimed
partner confirms another          ->  rejected by the database (23P01)
```

Prices are **indicative** for the same reason: the partner sets the final
figure. Every surface that shows money says so.

### Prices are pro-rated

Five days on a monthly rate bills as `5/30` of the month, not a full month.
Partners who genuinely will not sell short periods set `minDuration` on their
rate card; the UI then explains why the figure is higher than the days chosen.

All money is **integer paise**. `src/lib/pricing.ts` is the single
implementation, used by the browser quote and the server total alike — a quote
the server disagrees with is worse than no quote.

### Asset types are data, not code

68 asset types across 6 categories, and **no component names any of them**.
`AssetType.specSchema` holds field descriptors that drive the listing wizard,
runtime Zod validation, and the specification table.

Adding a new medium is a row in the database. Adding a spec field is a change to
`prisma/taxonomy.ts`. Neither needs a deploy of new UI code.

### "Media partner", not "media owner"

The party listing inventory is often an agency, franchisee or site manager
rather than the owner. `PartnerType` records which. The database model is still
called `MediaOwner` — renaming the table would break every relation for no
functional gain — but all user-facing copy says *partner*.

### Approximate locations are snapped once, not jittered per request

A sale listing may hide its exact position (`locationPrecision`, default
`APPROXIMATE` — fail closed). The obvious implementation, adding random offset
per request, is **not privacy**: zero-mean noise averages out, so roughly 100
requests recover the true point to a tenth of the jitter radius.

Instead the public point is derived **once, at publish**, snapped to a ~1.1 km
grid at the *cell centre* (a corner-snapped point is biased toward the origin
and gives away half a cell), and persisted to `SaleListing.publicGeog`. N
requests then reveal exactly what one request reveals.

The related rule is **filter on truth, project approximation.** Radius and
bbox searches run against the asset's real `geog`, so an approximate listing
still turns up in a search of the area it is actually in — hiding it would
cost the seller a buyer for no privacy gain, since the buyer already knows
what they searched. Only the coordinates *rendered back* are snapped.

`SalePropertyDetails` exists as a separate table for the same reason: the
land owner's name, survey number and lease particulars live behind a
relation the public read path never names, so a careless `findUnique` without
a `select` structurally cannot leak them. That is a privacy boundary the type
system enforces rather than one a reviewer has to remember.

### Image bytes never touch the server

Partner photos upload **browser → Vercel Blob directly**.
`/api/owner/uploads` issues a short-lived client token and never receives the
file, so a multi-megabyte photo does not have to fit inside a serverless
request body or bill function time proportional to its size.

Two consequences worth knowing:

- **The auth check lives inside `onBeforeGenerateToken`**, because that is the
  only point that gates whether an upload can happen at all. Checking earlier
  in the handler would leave the completion callback path open.
- **`onUploadCompleted` deliberately writes nothing to the database.** An image
  is attached to an asset when the *form is submitted*. So abandoning a
  half-filled form leaves an unreferenced blob — cheap and cleanable — rather
  than an `AssetImage` row pointing at a file that no listing shows.

Binaries are never stored in Postgres. That would inflate Neon storage and
every backup, lose CDN caching, and force a server round-trip per view for
data that is only ever fetched whole. `AssetImage.url` holds a URL; that is
the whole integration.

`next.config.ts` allows `*.public.blob.vercel-storage.com` wildcarded rather
than pinned to this store's id, so recreating the store cannot silently stop
every uploaded image from rendering. URL paste is retained alongside the
picker for externally-hosted images and the seeded demo data.

---

## Assets for sale

A second marketplace on the same inventory. A partner takes an asset they
already list for advertising and offers it for outright sale;
`/assets-for-sale` is fully public, no account required.

### The seller usually does not own the land

This is the fact the whole data model is built around. A hoarding vendor may
hold nothing but a three-year advertising right granted by a building society.
So `SaleListing.ownershipType` and `inclusions SaleInclusion[]` model physical
ownership, the land relationship, lease rights, advertising rights, concession
and operating rights, and municipal permissions **separately** — and no UI
copy anywhere implies a title the seller has not claimed.

`SalePermit` records municipal permissions with authority, number and expiry.
An expired permit renders in red with the date, never silently omitted.

### Nothing on a sale listing says "Verified"

Listings **auto-publish** — there is no admin review in this phase. So every
seller claim renders a neutral `Seller-declared` badge (`src/lib/sale-trust.ts`),
deliberately not amber or red: seller-declared is the normal case, not a
warning. Every level is labelled, including the lowest, because a field with no
badge invites the reader to assume somebody checked it.

`VerificationBadge` — which renders the bare word *Verified* and is correct on
the advertising side, where it means staff inspected the site — must not be
used on any sale surface. A buyer reads it as legal verification of title.
`sale-trust.ts` keeps `PLATFORM_REVIEWED` and `AUTHORITY_ISSUED` defined but
unreachable, so adding admin review later needs no component changes.

### Listings are snapshots, not live views

Publishing copies title, description, specs, taxonomy, locality and image URLs
onto the listing. A buyer evaluating a 40×20 hoarding must not have it become
20×10 because the seller edited the asset for an unrelated advertising reason.

Image **URLs** are snapshotted rather than FK references, so deleting an
`AssetImage` cannot destroy the evidence of what the buyer saw.

A Postgres trigger on `Asset` flags `syncState = 'DRIFTED'` when a snapshotted
column changes. It names its columns explicitly, so rating rollups and
`publishedAt` writes never fire it. The seller then chooses: *accept changes*
(re-snapshot) or *keep the published version* — both legitimate. `SOLD` and
`WITHDRAWN` listings never re-snapshot; the snapshot is the record of what was
sold.

Company name and asset status stay **live-joined** — a buyer wants today's
truth, and an archived asset must pull its listing.

### One catch-all route

`/assets-for-sale/[slug]` and `/assets-for-sale/[city]` cannot be sibling
dynamic segments, so `[...segments]` resolves everything by segment count
(`src/lib/sale-routes.ts`) with no database lookup needed to disambiguate:

```
/assets-for-sale                          national index
/assets-for-sale/mumbai                   city landing         (1 segment)
/assets-for-sale/digital-billboards       curated collection   (1 segment)
/assets-for-sale/mumbai/hoardings         city + type landing  (2 segments)
/assets-for-sale/mumbai/40x20-billboard-x listing detail       (2 segments)
```

That stays total because **listing-slug generation rejects any slug colliding
with an `AssetType` slug**, enforced server-side at create.

> `sale-routes.ts` must stay free of server-only imports — client components
> import `citySlug()` from it. A Prisma import here reaches the browser bundle
> and the build fails on `tls`. This has happened; the guard is that the file
> imports nothing from `src/server/`.

### Enquiries are public; offers are not

Enquiring needs no account. Mitigations, none of which pretend to be
sufficient (see Known gaps): the seller's phone and email are **never in the
enquiry response**, messages are capped and reject URLs, and a DB-backed
sliding window limits per email and per hashed IP.

Offers require a session, no exception — an offer asserts financial intent,
and anonymous offers are unenforceable spam surface.

---

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Pooled endpoint. Runtime queries. |
| `DIRECT_URL` | yes | Unpooled. Migrations only. |
| `AUTH_SECRET` | production | Signs session cookies. `openssl rand -base64 32` |
| `SEED_DEMO_PASSWORD` | dev only | Without it, demo accounts get no password. |
| `NEXT_PUBLIC_MAP_PROVIDER` | no | `maplibre` (default) or `maptiler` |
| `NEXT_PUBLIC_MAPTILER_KEY` | no | Upgrades to vector tiles |
| `NEXT_PUBLIC_APP_URL` | **production** | Absolute URLs in metadata. See warning below. |
| `SALE_ENQUIRY_IP_SALT` | production | Salts the IP hash on anonymous sale enquiries |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | no | Google Analytics. Unset locally on purpose. |
| `BLOB_READ_WRITE_TOKEN` | for uploads | Vercel Blob. Set by `vercel blob create-store`. |

> **`NEXT_PUBLIC_APP_URL` is not optional in production.** It backs
> `metadataBase`, so without it every canonical URL and `og:url` on the site
> falls back to `http://localhost:3000` — which tells search engines the real
> page lives at an address they cannot reach. This shipped broken once; if SEO
> looks wrong, check this first.

Note that all `NEXT_PUBLIC_*` values are **inlined at build time**. Setting one
in Vercel does not affect an existing deployment — you must redeploy. That
applies to the GA id and the app URL both.

Maps work with **no key at all** — MapLibre over free OpenStreetMap tiles.
Before launch, add a MapTiler key: the default OSM tile servers are fine for
development but their usage policy rules out production traffic.

---

## Known gaps

Honest list of what is not built, so nobody goes looking:

- **No payments.** Partners and advertisers settle directly. There is a
  `Payment` model and a mock abstraction, but no gateway.
- **Notifications are persisted, not delivered.** Rows are written to
  `Notification`; no email or push transport exists.
- **Campaigns and favourites** are modelled in the schema but have no UI.
- **Free OSM tiles** — see above.
- **Sale-listing documents are metadata only.** A `SaleDocument` row records
  that a title deed or permit *exists*, with its number, authority and dates.
  There is no file attached, deliberately: legal documents need signed URLs,
  per-viewer access checks and download auditing, which asset photos do not.
- **Anonymous sale enquiries have no real rate limiting.** There is a
  DB-backed sliding window (per email, per hashed IP) and a URL-stripped
  message, but no captcha and no edge rate limiter. Good enough against
  casual abuse, not a determined actor. Do this before any marketing push.
- **Nothing garbage-collects orphaned blobs.** Removing a photo from a
  listing leaves the uploaded file in Blob storage.
- **Admin moderation of sale listings is not built.** Listings auto-publish,
  and no "verified" badge renders anywhere on the sale surface as a result —
  see `src/lib/sale-trust.ts`.

---

## Contributing

Run `pnpm check` before pushing — it generates the Prisma client, typechecks and
lints in one pass. If you touched anything data-related, run `pnpm test` too.

### Migrations: do not run `prisma migrate dev`

Migrations are checked in, hand-numbered and applied in order with
`prisma migrate deploy`. Never edit an applied migration; add a new one.

**`prisma migrate dev` is destructive in this repo.** The initial migration
created `BookingStatus` with 11 labels; the Prisma enum declares 7.
`migrate dev` tries to drop the extra four, which Postgres can only do by
recreating the type — taking the `BookingItem_no_overlap` exclusion
constraint with it, the one guarantee that stops double-confirming a booking.

So write the SQL by hand, apply it with `pnpm db:deploy`, then run
`pnpm db:generate` (Prisma 7 no longer generates automatically) and
`pnpm test` to confirm nothing regressed.

To check that the migration files and `schema.prisma` actually agree, Prisma
can diff the two — but `migrate diff --from-migrations` needs a **shadow
database** it is free to drop and recreate, so it needs
`datasource.shadowDatabaseUrl` in `prisma.config.ts` pointing at a throwaway
database. Never point it at the Neon URL. With `docker compose up -d` running,
a second local database serves the purpose:

```bash
pnpm exec prisma migrate diff   --from-migrations prisma/migrations --to-schema prisma/schema.prisma
```

Expect **only** the known `BookingStatus` label difference. Any additional
line means schema and migration have drifted. (`migration_lock.toml` is
committed so this works at all — the hand-authored migrations never created
one.)

The hand-written migrations (PostGIS setup, the booking constraint, and the
sale-listing tables with their GiST index and drift trigger) carry comments
explaining why they cannot be generated.
