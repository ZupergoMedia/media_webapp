# ZuperGo Media

A marketplace for out-of-home advertising. Advertisers discover billboards,
digital screens, vehicles and venues on a map, then request availability from
the media partner who operates them.

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
    owner/                 media partner dashboard
    admin/                 verification and moderation
    partners/join/         partner registration
  components/
    marketplace/           asset cards, panels, pricing, disclosures
    map/                   MapLibre components
    layout/                navbar and menu
    ui/                    shadcn primitives
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

## Four things that will surprise you

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
| `NEXT_PUBLIC_APP_URL` | no | Absolute URLs in metadata |

Maps work with **no key at all** — MapLibre over free OpenStreetMap tiles.
Before launch, add a MapTiler key: the default OSM tile servers are fine for
development but their usage policy rules out production traffic.

---

## Known gaps

Honest list of what is not built, so nobody goes looking:

- **No payments.** Partners and advertisers settle directly. There is a
  `Payment` model and a mock abstraction, but no gateway.
- **Photos are URL-paste**, not file upload. Image storage is not wired up.
- **Notifications are persisted, not delivered.** Rows are written to
  `Notification`; no email or push transport exists.
- **Campaigns and favourites** are modelled in the schema but have no UI.
- **SEO landing pages** (`/mumbai/billboards`) are not built.
- **Free OSM tiles** — see above.

---

## Contributing

Run `pnpm check` before pushing — it generates the Prisma client, typechecks and
lints in one pass. If you touched anything data-related, run `pnpm test` too.

Migrations are checked in and applied in order. Never edit an applied migration;
add a new one. The two hand-written ones (PostGIS setup and the booking
constraint) have comments explaining why they cannot be generated.
