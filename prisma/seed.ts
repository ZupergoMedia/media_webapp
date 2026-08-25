/**
 * Seeds the taxonomy, demo owners and 50 Mumbai assets.
 *
 * Prisma 7 removed automatic seeding, so this runs explicitly:  pnpm db:seed
 *
 * Idempotent: taxonomy is upserted, and demo assets are cleared and rebuilt on
 * each run so repeated seeding does not accumulate duplicates.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { TAXONOMY } from "./taxonomy";
import { LOCALITIES, OWNERS, demoImages, jitter } from "./mumbai";
import "dotenv/config";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set to seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Password for the seeded demo accounts.
 *
 * Read from the environment rather than hardcoded: a literal here would ship a
 * known password to every database this seed ever touches, including any
 * deployed one. Absent, accounts are created with no password and simply cannot
 * be signed into — which is the safe failure.
 */
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;

async function demoPasswordHash(): Promise<string | undefined> {
  if (!DEMO_PASSWORD) return undefined;
  return bcrypt.hash(DEMO_PASSWORD, 12);
}

/** Rupees -> paise. Money is stored as integers throughout. */
const rupees = (amount: number) => amount * 100;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ---------------------------------------------------------------------------
// Asset blueprints
// ---------------------------------------------------------------------------

interface AssetBlueprint {
  title: string;
  typeSlug: string;
  ownerSlug: string;
  locality: keyof typeof LOCALITIES;
  price: number;
  priceUnit: Prisma.AssetPricingCreateManyAssetInput["unit"];
  impressions: number;
  specs: Record<string, unknown>;
  audience?: string;
  featured?: boolean;
  digital?: {
    slotDurationSeconds: number;
    loopDurationSeconds: number;
    slotsPerLoop: number;
    screenWidthPx: number;
    screenHeightPx: number;
    operatingHoursStart: number;
    operatingHoursEnd: number;
  };
  operatingAreas?: Array<{
    name: string;
    city: string;
    centerLocality: keyof typeof LOCALITIES;
    radiusMeters: number;
  }>;
  route?: {
    name: string;
    startLabel: string;
    endLabel: string;
    via: Array<keyof typeof LOCALITIES>;
  };
}

const staticSpecs = (
  w: number,
  h: number,
  illumination: string,
  facing: string,
) => ({
  widthFt: w,
  heightFt: h,
  illumination,
  orientation: w >= h ? "Landscape" : "Portrait",
  facing,
});

// --- 20 fixed outdoor -------------------------------------------------------
const FIXED_ASSETS: AssetBlueprint[] = [
  {
    title: "Premium Billboard — BKC Signal Junction",
    typeSlug: "billboard",
    ownerSlug: "skyline-outdoor-demo",
    locality: "bkc",
    price: rupees(150000),
    priceUnit: "PER_MONTH",
    impressions: 185000,
    specs: staticSpecs(40, 20, "Backlit", "North-bound towards Airport"),
    audience: "Corporate commuters, senior decision makers, premium retail",
    featured: true,
  },
  {
    title: "Unipole — Western Express Highway, Andheri",
    typeSlug: "unipole",
    ownerSlug: "skyline-outdoor-demo",
    locality: "andheri",
    price: rupees(120000),
    priceUnit: "PER_MONTH",
    impressions: 210000,
    specs: staticSpecs(30, 20, "Frontlit", "South-bound towards Bandra"),
    audience: "Daily highway commuters, airport traffic",
    featured: true,
  },
  {
    title: "Hoarding — Linking Road, Bandra West",
    typeSlug: "hoarding",
    ownerSlug: "skyline-outdoor-demo",
    locality: "bandra",
    price: rupees(95000),
    priceUnit: "PER_MONTH",
    impressions: 140000,
    specs: staticSpecs(20, 10, "Backlit", "Shopping district frontage"),
    audience: "Young shoppers, retail footfall",
  },
  {
    title: "Gantry — Lower Parel Business District",
    typeSlug: "gantry",
    ownerSlug: "skyline-outdoor-demo",
    locality: "lowerParel",
    price: rupees(175000),
    priceUnit: "PER_MONTH",
    impressions: 165000,
    specs: staticSpecs(50, 12, "Backlit", "Both directions"),
    audience: "Corporate offices, finance sector professionals",
    featured: true,
  },
  {
    title: "Wallscape — Worli Sea Face Approach",
    typeSlug: "wallscape",
    ownerSlug: "skyline-outdoor-demo",
    locality: "worli",
    price: rupees(210000),
    priceUnit: "PER_MONTH",
    impressions: 195000,
    specs: staticSpecs(60, 40, "Frontlit", "Sea-link bound traffic"),
    audience: "High-income residents, sea-link commuters",
  },
  {
    title: "Building Facade — Powai Lakeside",
    typeSlug: "building-facade",
    ownerSlug: "skyline-outdoor-demo",
    locality: "powai",
    price: rupees(160000),
    priceUnit: "PER_MONTH",
    impressions: 120000,
    specs: staticSpecs(45, 35, "Backlit", "Lake-facing arterial road"),
    audience: "Tech workforce, students, affluent residents",
  },
  {
    title: "Bridge Panel — Dadar Rail Overbridge",
    typeSlug: "bridge-panel",
    ownerSlug: "skyline-outdoor-demo",
    locality: "dadar",
    price: rupees(85000),
    priceUnit: "PER_MONTH",
    impressions: 230000,
    specs: staticSpecs(25, 10, "None", "Station-bound pedestrians"),
    audience: "Rail commuters, mass market",
  },
  {
    title: "Flyover Panel — Juhu Circle",
    typeSlug: "flyover-panel",
    ownerSlug: "skyline-outdoor-demo",
    locality: "juhu",
    price: rupees(78000),
    priceUnit: "PER_MONTH",
    impressions: 105000,
    specs: staticSpecs(20, 8, "Frontlit", "Beach-bound traffic"),
    audience: "Leisure travellers, families",
  },
  {
    title: "Foot-over-bridge Branding — Goregaon East",
    typeSlug: "foot-over-bridge",
    ownerSlug: "skyline-outdoor-demo",
    locality: "goregaon",
    price: rupees(62000),
    priceUnit: "PER_MONTH",
    impressions: 145000,
    specs: staticSpecs(30, 8, "Backlit", "Pedestrian crossing both sides"),
    audience: "Office commuters, exhibition visitors",
  },
  {
    title: "Underpass Branding — Malad Subway",
    typeSlug: "underpass",
    ownerSlug: "skyline-outdoor-demo",
    locality: "malad",
    price: rupees(48000),
    priceUnit: "PER_MONTH",
    impressions: 88000,
    specs: staticSpecs(15, 8, "Backlit", "Both walkways"),
    audience: "Local commuters, students",
  },
  {
    title: "Billboard — Thane Ghodbunder Road",
    typeSlug: "billboard",
    ownerSlug: "skyline-outdoor-demo",
    locality: "thane",
    price: rupees(92000),
    priceUnit: "PER_MONTH",
    impressions: 132000,
    specs: staticSpecs(40, 20, "Frontlit", "Highway-bound"),
    audience: "Suburban families, highway traffic",
  },
  {
    title: "Unipole — Vashi Junction, Navi Mumbai",
    typeSlug: "unipole",
    ownerSlug: "skyline-outdoor-demo",
    locality: "naviMumbai",
    price: rupees(74000),
    priceUnit: "PER_MONTH",
    impressions: 118000,
    specs: staticSpecs(30, 20, "Backlit", "Palm Beach Road facing"),
    audience: "Navi Mumbai residents, IT workforce",
  },
  {
    title: "Roadside Kiosk Cluster — Bandra Station Road",
    typeSlug: "roadside-kiosk",
    ownerSlug: "skyline-outdoor-demo",
    locality: "bandra",
    price: rupees(35000),
    priceUnit: "PER_MONTH",
    impressions: 96000,
    specs: staticSpecs(6, 4, "Backlit", "Pedestrian eye level"),
    audience: "Station footfall, local retail",
  },
  {
    title: "Pole Advertising Series — Powai Ring Road",
    typeSlug: "pole-advertising",
    ownerSlug: "skyline-outdoor-demo",
    locality: "powai",
    price: rupees(28000),
    priceUnit: "PER_MONTH",
    impressions: 64000,
    specs: staticSpecs(4, 6, "None", "Sequential along ring road"),
    audience: "Residential and campus traffic",
  },
  {
    title: "Hoarding — Andheri Link Road",
    typeSlug: "hoarding",
    ownerSlug: "skyline-outdoor-demo",
    locality: "andheri",
    price: rupees(88000),
    priceUnit: "PER_MONTH",
    impressions: 128000,
    specs: staticSpecs(20, 10, "Frontlit", "Metro-bound traffic"),
    audience: "Suburban commuters, retail shoppers",
  },
  {
    title: "Billboard — Lower Parel Mill Compound",
    typeSlug: "billboard",
    ownerSlug: "skyline-outdoor-demo",
    locality: "lowerParel",
    price: rupees(138000),
    priceUnit: "PER_MONTH",
    impressions: 152000,
    specs: staticSpecs(40, 20, "Backlit", "Office district entry"),
    audience: "Corporate professionals, premium dining",
  },
  {
    title: "Wallscape — Dadar TT Circle",
    typeSlug: "wallscape",
    ownerSlug: "skyline-outdoor-demo",
    locality: "dadar",
    price: rupees(115000),
    priceUnit: "PER_MONTH",
    impressions: 205000,
    specs: staticSpecs(50, 30, "Frontlit", "Circle-facing"),
    audience: "Mass market, high-density commuter zone",
  },
  {
    title: "Gantry — Goregaon Expo Approach",
    typeSlug: "gantry",
    ownerSlug: "skyline-outdoor-demo",
    locality: "goregaon",
    price: rupees(142000),
    priceUnit: "PER_MONTH",
    impressions: 138000,
    specs: staticSpecs(50, 12, "Backlit", "Exhibition-bound traffic"),
    audience: "Exhibition visitors, business travellers",
  },
  {
    title: "Billboard — Juhu Tara Road",
    typeSlug: "billboard",
    ownerSlug: "skyline-outdoor-demo",
    locality: "juhu",
    price: rupees(108000),
    priceUnit: "PER_MONTH",
    impressions: 112000,
    specs: staticSpecs(40, 20, "Backlit", "Beach-bound"),
    audience: "Affluent residents, hospitality guests",
  },
  {
    title: "Bridge Panel — Thane Creek Approach",
    typeSlug: "bridge-panel",
    ownerSlug: "skyline-outdoor-demo",
    locality: "thane",
    price: rupees(68000),
    priceUnit: "PER_MONTH",
    impressions: 124000,
    specs: staticSpecs(25, 10, "Frontlit", "Mumbai-bound"),
    audience: "Inter-city commuters",
  },
];

// --- 10 digital / DOOH ------------------------------------------------------
const digitalSpec = (w: number, h: number, pitch: number, hours: string) => ({
  screenWidthPx: w,
  screenHeightPx: h,
  pixelPitch: pitch,
  slotDurationSeconds: 15,
  loopDurationSeconds: 180,
  operatingHours: hours,
  audioEnabled: false,
});

const DIGITAL_ASSETS: AssetBlueprint[] = [
  {
    title: "LED Billboard — BKC Corporate Park",
    typeSlug: "led-billboard",
    ownerSlug: "pulse-digital-demo",
    locality: "bkc",
    price: rupees(4500),
    priceUnit: "PER_SLOT",
    impressions: 220000,
    specs: digitalSpec(1920, 1080, 6, "06:00 – 23:00"),
    audience: "Corporate professionals, premium brands",
    featured: true,
    digital: {
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
      slotsPerLoop: 12,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      operatingHoursStart: 6,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Digital Roadside Screen — Western Express, Andheri",
    typeSlug: "digital-roadside-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "andheri",
    price: rupees(3800),
    priceUnit: "PER_SLOT",
    impressions: 245000,
    specs: digitalSpec(1920, 1080, 8, "06:00 – 23:00"),
    audience: "Highway commuters, mass reach",
    featured: true,
    digital: {
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
      slotsPerLoop: 12,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      operatingHoursStart: 6,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Mall Screen Network — Lower Parel Retail Hub",
    typeSlug: "mall-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "lowerParel",
    price: rupees(2600),
    priceUnit: "PER_SLOT",
    impressions: 95000,
    specs: digitalSpec(1080, 1920, 3, "10:00 – 22:00"),
    audience: "Shoppers, families, young professionals",
    digital: {
      slotDurationSeconds: 10,
      loopDurationSeconds: 120,
      slotsPerLoop: 12,
      screenWidthPx: 1080,
      screenHeightPx: 1920,
      operatingHoursStart: 10,
      operatingHoursEnd: 22,
    },
  },
  {
    title: "Cinema Screen Pre-roll — Goregaon Multiplex",
    typeSlug: "cinema-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "goregaon",
    price: rupees(5200),
    priceUnit: "PER_SLOT",
    impressions: 42000,
    specs: digitalSpec(4096, 2160, 2, "11:00 – 23:30"),
    audience: "Captive cinema audience, entertainment seekers",
    digital: {
      slotDurationSeconds: 30,
      loopDurationSeconds: 300,
      slotsPerLoop: 10,
      screenWidthPx: 4096,
      screenHeightPx: 2160,
      operatingHoursStart: 11,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Elevator Screens — Powai IT Towers",
    typeSlug: "elevator-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "powai",
    price: rupees(1400),
    priceUnit: "PER_SLOT",
    impressions: 38000,
    specs: digitalSpec(1080, 1920, 2, "08:00 – 21:00"),
    audience: "IT workforce, repeated daily exposure",
    digital: {
      slotDurationSeconds: 10,
      loopDurationSeconds: 120,
      slotsPerLoop: 12,
      screenWidthPx: 1080,
      screenHeightPx: 1920,
      operatingHoursStart: 8,
      operatingHoursEnd: 21,
    },
  },
  {
    title: "Gym Screen Network — Bandra Fitness Studios",
    typeSlug: "gym-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "bandra",
    price: rupees(1100),
    priceUnit: "PER_SLOT",
    impressions: 24000,
    specs: digitalSpec(1920, 1080, 3, "05:30 – 23:00"),
    audience: "Fitness-focused, health and wellness buyers",
    digital: {
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
      slotsPerLoop: 12,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      operatingHoursStart: 5,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Airport Screen — Domestic Terminal Approach",
    typeSlug: "airport-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "andheri",
    price: rupees(7800),
    priceUnit: "PER_SLOT",
    impressions: 165000,
    specs: digitalSpec(3840, 2160, 2, "04:00 – 23:59"),
    audience: "Business travellers, high disposable income",
    featured: true,
    digital: {
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
      slotsPerLoop: 12,
      screenWidthPx: 3840,
      screenHeightPx: 2160,
      operatingHoursStart: 4,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Metro Screen Network — Andheri Metro Concourse",
    typeSlug: "metro-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "andheri",
    price: rupees(2200),
    priceUnit: "PER_SLOT",
    impressions: 188000,
    specs: digitalSpec(1080, 1920, 3, "05:30 – 23:30"),
    audience: "Daily metro commuters, young workforce",
    digital: {
      slotDurationSeconds: 10,
      loopDurationSeconds: 120,
      slotsPerLoop: 12,
      screenWidthPx: 1080,
      screenHeightPx: 1920,
      operatingHoursStart: 5,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Restaurant Screens — Lower Parel Food District",
    typeSlug: "restaurant-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "lowerParel",
    price: rupees(900),
    priceUnit: "PER_SLOT",
    impressions: 18000,
    specs: digitalSpec(1920, 1080, 3, "11:00 – 23:30"),
    audience: "Diners, social groups, evening leisure",
    digital: {
      slotDurationSeconds: 15,
      loopDurationSeconds: 180,
      slotsPerLoop: 12,
      screenWidthPx: 1920,
      screenHeightPx: 1080,
      operatingHoursStart: 11,
      operatingHoursEnd: 23,
    },
  },
  {
    title: "Residential Society Screens — Thane Township",
    typeSlug: "residential-society-screen",
    ownerSlug: "pulse-digital-demo",
    locality: "thane",
    price: rupees(750),
    priceUnit: "PER_SLOT",
    impressions: 31000,
    specs: digitalSpec(1080, 1920, 3, "06:00 – 23:00"),
    audience: "Families, household decision makers",
    digital: {
      slotDurationSeconds: 10,
      loopDurationSeconds: 120,
      slotsPerLoop: 12,
      screenWidthPx: 1080,
      screenHeightPx: 1920,
      operatingHoursStart: 6,
      operatingHoursEnd: 23,
    },
  },
];

// --- 10 mobile / transit ----------------------------------------------------
const vehicleSpec = (
  type: string,
  reg: string,
  area: string,
  km: number,
  hours: string,
) => ({
  vehicleType: type,
  registrationNumber: reg,
  brandingArea: area,
  panelWidthFt: 8,
  panelHeightFt: 4,
  dailyRunKm: km,
  operatingHours: hours,
  gpsEnabled: true,
});

const MOBILE_ASSETS: AssetBlueprint[] = [
  {
    title: "LED Advertising Van — Mumbai Metro Region",
    typeSlug: "van",
    ownerSlug: "metro-transit-demo",
    locality: "andheri",
    price: rupees(18000),
    priceUnit: "PER_DAY",
    impressions: 65000,
    specs: vehicleSpec("Mobile LED Van", "MH-01-DEMO-1001", "Both sides + rear", 120, "09:00 – 21:00"),
    audience: "Flexible city-wide reach, event amplification",
    featured: true,
    operatingAreas: [
      { name: "Western Suburbs", city: "Mumbai", centerLocality: "andheri", radiusMeters: 8000 },
      { name: "Bandra & BKC", city: "Mumbai", centerLocality: "bkc", radiusMeters: 5000 },
    ],
  },
  {
    title: "Branded Bus Fleet — Western Suburbs Route",
    typeSlug: "bus",
    ownerSlug: "metro-transit-demo",
    locality: "bandra",
    price: rupees(42000),
    priceUnit: "PER_MONTH",
    impressions: 145000,
    specs: vehicleSpec("City Bus", "MH-02-DEMO-2002", "Full wrap", 180, "06:00 – 22:00"),
    audience: "Mass market commuters across the western corridor",
    operatingAreas: [
      { name: "Bandra to Borivali corridor", city: "Mumbai", centerLocality: "malad", radiusMeters: 10000 },
    ],
    route: {
      name: "Bandra — Malad Express Route",
      startLabel: "Bandra Station",
      endLabel: "Malad West",
      via: ["bandra", "juhu", "andheri", "goregaon", "malad"],
    },
  },
  {
    title: "Auto-rickshaw Fleet — Andheri & Powai",
    typeSlug: "auto-rickshaw",
    ownerSlug: "metro-transit-demo",
    locality: "powai",
    price: rupees(2200),
    priceUnit: "PER_MONTH",
    impressions: 28000,
    specs: vehicleSpec("Auto-rickshaw", "MH-03-DEMO-3003", "Rear panel + hood", 85, "07:00 – 23:00"),
    audience: "Neighbourhood-level reach, last-mile visibility",
    operatingAreas: [
      { name: "Powai & Andheri East", city: "Mumbai", centerLocality: "powai", radiusMeters: 6000 },
    ],
  },
  {
    title: "Taxi Fleet Branding — South & Central Mumbai",
    typeSlug: "taxi",
    ownerSlug: "metro-transit-demo",
    locality: "dadar",
    price: rupees(3400),
    priceUnit: "PER_MONTH",
    impressions: 42000,
    specs: vehicleSpec("Taxi", "MH-01-DEMO-4004", "Rooftop + doors", 140, "24 hours"),
    audience: "Broad urban reach, high dwell in traffic",
    operatingAreas: [
      { name: "Dadar to Colaba", city: "Mumbai", centerLocality: "dadar", radiusMeters: 9000 },
    ],
  },
  {
    title: "Cab Fleet Branding — Airport Corridor",
    typeSlug: "cab",
    ownerSlug: "metro-transit-demo",
    locality: "andheri",
    price: rupees(3900),
    priceUnit: "PER_MONTH",
    impressions: 51000,
    specs: vehicleSpec("Sedan Cab", "MH-01-DEMO-5005", "Doors + rear", 160, "24 hours"),
    audience: "Airport travellers, business commuters",
    operatingAreas: [
      { name: "Airport & Western Suburbs", city: "Mumbai", centerLocality: "andheri", radiusMeters: 12000 },
    ],
  },
  {
    title: "Truck Branding — Mumbai–Thane Freight Route",
    typeSlug: "truck",
    ownerSlug: "metro-transit-demo",
    locality: "thane",
    price: rupees(26000),
    priceUnit: "PER_MONTH",
    impressions: 88000,
    specs: vehicleSpec("Container Truck", "MH-04-DEMO-6006", "Both sides + rear", 220, "06:00 – 20:00"),
    audience: "Highway audiences, inter-city corridor",
    operatingAreas: [
      { name: "Mumbai–Thane–Navi Mumbai", city: "Thane", centerLocality: "thane", radiusMeters: 15000 },
    ],
  },
  {
    title: "Delivery Vehicle Fleet — Suburban Coverage",
    typeSlug: "delivery-vehicle",
    ownerSlug: "metro-transit-demo",
    locality: "goregaon",
    price: rupees(8500),
    priceUnit: "PER_MONTH",
    impressions: 36000,
    specs: vehicleSpec("Delivery Van", "MH-02-DEMO-7007", "Side panels", 95, "08:00 – 20:00"),
    audience: "Residential neighbourhoods, repeat exposure",
    operatingAreas: [
      { name: "Goregaon & Malad", city: "Mumbai", centerLocality: "goregaon", radiusMeters: 7000 },
    ],
  },
  {
    title: "School Bus Branding — Thane Education Belt",
    typeSlug: "school-bus",
    ownerSlug: "metro-transit-demo",
    locality: "thane",
    price: rupees(14000),
    priceUnit: "PER_MONTH",
    impressions: 22000,
    specs: vehicleSpec("School Bus", "MH-04-DEMO-8008", "Rear + sides", 60, "06:30 – 17:00"),
    audience: "Parents, families, education sector",
    operatingAreas: [
      { name: "Thane West schools", city: "Thane", centerLocality: "thane", radiusMeters: 5000 },
    ],
  },
  {
    title: "Advertising Van — Navi Mumbai Circuit",
    typeSlug: "van",
    ownerSlug: "metro-transit-demo",
    locality: "naviMumbai",
    price: rupees(15000),
    priceUnit: "PER_DAY",
    impressions: 48000,
    specs: vehicleSpec("Mobile LED Van", "MH-43-DEMO-9009", "Both sides + rear", 110, "09:00 – 21:00"),
    audience: "Navi Mumbai residential and commercial belt",
    operatingAreas: [
      { name: "Vashi, Nerul, Belapur", city: "Navi Mumbai", centerLocality: "naviMumbai", radiusMeters: 10000 },
    ],
  },
  {
    title: "Car Fleet Branding — BKC Business District",
    typeSlug: "car",
    ownerSlug: "metro-transit-demo",
    locality: "bkc",
    price: rupees(4200),
    priceUnit: "PER_MONTH",
    impressions: 33000,
    specs: vehicleSpec("Hatchback", "MH-01-DEMO-1010", "Doors + rear windscreen", 90, "08:00 – 20:00"),
    audience: "Corporate corridor, premium office traffic",
    operatingAreas: [
      { name: "BKC & Kurla", city: "Mumbai", centerLocality: "bkc", radiusMeters: 6000 },
    ],
  },
];

// --- 10 venue ---------------------------------------------------------------
const venueSpec = (
  type: string,
  visitors: number,
  hours: string,
  placement: string,
  profile: string,
  units = 4,
) => ({
  venueType: type,
  dailyVisitors: visitors,
  operatingHours: hours,
  placement,
  audienceProfile: profile,
  unitsAvailable: units,
});

const VENUE_ASSETS: AssetBlueprint[] = [
  {
    title: "Mall Atrium Branding — Lower Parel",
    typeSlug: "mall",
    ownerSlug: "venue-reach-demo",
    locality: "lowerParel",
    price: rupees(185000),
    priceUnit: "PER_MONTH",
    impressions: 78000,
    specs: venueSpec("Shopping Mall", 26000, "10:00 – 22:00", "Central atrium, ground floor", "Affluent shoppers, families, 25–45", 6),
    audience: "Premium retail shoppers, high purchase intent",
    featured: true,
  },
  {
    title: "Gym Branding Network — Bandra West",
    typeSlug: "gym",
    ownerSlug: "venue-reach-demo",
    locality: "bandra",
    price: rupees(48000),
    priceUnit: "PER_MONTH",
    impressions: 9500,
    specs: venueSpec("Fitness Centre", 850, "05:30 – 23:00", "Cardio floor and reception", "Health-conscious, 22–40, high disposable income"),
    audience: "Fitness and wellness category buyers",
  },
  {
    title: "Café Chain Branding — Juhu & Bandra",
    typeSlug: "cafe",
    ownerSlug: "venue-reach-demo",
    locality: "juhu",
    price: rupees(32000),
    priceUnit: "PER_MONTH",
    impressions: 12000,
    specs: venueSpec("Café", 1100, "07:00 – 23:00", "Table tents and wall panels", "Students, creatives, young professionals", 8),
    audience: "Young urban audience, long dwell time",
  },
  {
    title: "IT Park Branding — Powai Tech Campus",
    typeSlug: "office-it-park",
    ownerSlug: "venue-reach-demo",
    locality: "powai",
    price: rupees(125000),
    priceUnit: "PER_MONTH",
    impressions: 34000,
    specs: venueSpec("IT Park", 18000, "08:00 – 21:00", "Lobby, cafeteria, walkways", "IT professionals, 24–40, high income", 10),
    audience: "Technology workforce, B2B and premium consumer",
  },
  {
    title: "Supermarket Branding — Thane West",
    typeSlug: "supermarket",
    ownerSlug: "venue-reach-demo",
    locality: "thane",
    price: rupees(58000),
    priceUnit: "PER_MONTH",
    impressions: 21000,
    specs: venueSpec("Supermarket", 3400, "08:00 – 22:00", "Aisle ends and checkout", "Household shoppers, families", 12),
    audience: "FMCG buyers at point of purchase",
  },
  {
    title: "Residential Society Branding — Goregaon Complex",
    typeSlug: "residential-society",
    ownerSlug: "venue-reach-demo",
    locality: "goregaon",
    price: rupees(38000),
    priceUnit: "PER_MONTH",
    impressions: 15000,
    specs: venueSpec("Residential Society", 2200, "24 hours", "Lobby, lift areas, notice boards", "Families, homeowners, 30–55", 15),
    audience: "Household decision makers, high frequency",
  },
  {
    title: "College Campus Branding — Andheri",
    typeSlug: "college",
    ownerSlug: "venue-reach-demo",
    locality: "andheri",
    price: rupees(42000),
    priceUnit: "PER_MONTH",
    impressions: 18500,
    specs: venueSpec("College", 4200, "08:00 – 18:00", "Canteen, notice boards, corridors", "Students, 17–24, trend-driven", 10),
    audience: "Youth market, education and lifestyle brands",
  },
  {
    title: "Hotel Lobby Branding — BKC Business Hotel",
    typeSlug: "hotel",
    ownerSlug: "venue-reach-demo",
    locality: "bkc",
    price: rupees(95000),
    priceUnit: "PER_MONTH",
    impressions: 8200,
    specs: venueSpec("Business Hotel", 620, "24 hours", "Lobby and lift lobbies", "Business travellers, senior executives", 5),
    audience: "Premium business audience, high net worth",
  },
  {
    title: "Coworking Space Branding — Lower Parel",
    typeSlug: "coworking-space",
    ownerSlug: "venue-reach-demo",
    locality: "lowerParel",
    price: rupees(36000),
    priceUnit: "PER_MONTH",
    impressions: 6800,
    specs: venueSpec("Coworking Space", 780, "07:00 – 22:00", "Common areas and phone booths", "Founders, freelancers, 25–38", 6),
    audience: "Startup ecosystem, B2B SaaS and fintech",
  },
  {
    title: "Multiplex Lobby Branding — Malad",
    typeSlug: "cinema",
    ownerSlug: "venue-reach-demo",
    locality: "malad",
    price: rupees(72000),
    priceUnit: "PER_MONTH",
    impressions: 26000,
    specs: venueSpec("Multiplex", 3100, "10:00 – 00:30", "Lobby, concession stand, corridors", "Entertainment seekers, families, couples", 8),
    audience: "Leisure audience in a high-attention setting",
  },
];

const ALL_BLUEPRINTS = [
  ...FIXED_ASSETS,
  ...DIGITAL_ASSETS,
  ...MOBILE_ASSETS,
  ...VENUE_ASSETS,
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedTaxonomy() {
  let categoryCount = 0;
  let typeCount = 0;

  for (const [index, category] of TAXONOMY.entries()) {
    const created = await prisma.assetCategory.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: index,
      },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: index,
      },
    });
    categoryCount += 1;

    for (const [typeIndex, type] of category.types.entries()) {
      await prisma.assetType.upsert({
        where: { slug: type.slug },
        create: {
          slug: type.slug,
          name: type.name,
          categoryId: created.id,
          defaultLocationMode: type.defaultLocationMode,
          supportedBookingModels: type.supportedBookingModels,
          isDigital: type.isDigital ?? false,
          isMobile: type.isMobile ?? false,
          specSchema: type.specs as unknown as Prisma.InputJsonValue,
          sortOrder: typeIndex,
        },
        update: {
          name: type.name,
          categoryId: created.id,
          defaultLocationMode: type.defaultLocationMode,
          supportedBookingModels: type.supportedBookingModels,
          isDigital: type.isDigital ?? false,
          isMobile: type.isMobile ?? false,
          specSchema: type.specs as unknown as Prisma.InputJsonValue,
          sortOrder: typeIndex,
        },
      });
      typeCount += 1;
    }
  }

  return { categoryCount, typeCount };
}

async function seedOwners() {
  const owners = new Map<string, string>();
  const passwordHash = await demoPasswordHash();

  for (const owner of OWNERS) {
    const user = await prisma.user.upsert({
      where: { email: owner.contactEmail },
      create: {
        email: owner.contactEmail,
        name: owner.contactName,
        role: "MEDIA_PARTNER",
        emailVerified: new Date(),
        passwordHash,
      },
      update: { role: "MEDIA_PARTNER", passwordHash },
    });

    const record = await prisma.mediaOwner.upsert({
      where: { slug: owner.slug },
      create: {
        slug: owner.slug,
        userId: user.id,
        companyName: owner.companyName,
        description: owner.description,
        city: owner.city,
        state: "Maharashtra",
        contactName: owner.contactName,
        contactEmail: owner.contactEmail,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        ratingAverage: owner.rating,
        ratingCount: owner.ratingCount,
      },
      update: {
        companyName: owner.companyName,
        verificationStatus: "VERIFIED",
        ratingAverage: owner.rating,
        ratingCount: owner.ratingCount,
      },
    });

    owners.set(owner.slug, record.id);
  }

  return owners;
}

async function seedAdvertiser() {
  const passwordHash = await demoPasswordHash();
  return prisma.user.upsert({
    where: { email: "advertiser@demo.zupergo.test" },
    create: {
      email: "advertiser@demo.zupergo.test",
      name: "Demo Advertiser",
      role: "ADVERTISER",
      emailVerified: new Date(),
      passwordHash,
    },
    update: { passwordHash },
  });
}

async function seedAdmin() {
  const passwordHash = await demoPasswordHash();
  return prisma.user.upsert({
    where: { email: "admin@demo.zupergo.test" },
    create: {
      email: "admin@demo.zupergo.test",
      name: "Platform Admin",
      role: "ADMIN",
      emailVerified: new Date(),
      passwordHash,
    },
    update: { role: "ADMIN", passwordHash },
  });
}

async function seedAssets(owners: Map<string, string>) {
  const types = await prisma.assetType.findMany({
    select: { id: true, slug: true, categoryId: true, isDigital: true, isMobile: true },
  });
  const typeBySlug = new Map(types.map((t) => [t.slug, t]));

  /*
   * Rebuild demo assets each run so re-seeding does not accumulate duplicates.
   *
   * Requests are cleared first. BookingItem.assetId is RESTRICT, so deleting an
   * asset that someone has enquired about fails — which meant the seed worked
   * on a fresh database and broke on any database that had actually been used.
   * Removing the parent Booking cascades to its items.
   */
  const ownerIds = [...owners.values()];

  const affectedBookings = await prisma.booking.findMany({
    where: { items: { some: { asset: { ownerId: { in: ownerIds } } } } },
    select: { id: true },
  });

  if (affectedBookings.length > 0) {
    await prisma.booking.deleteMany({
      where: { id: { in: affectedBookings.map((booking) => booking.id) } },
    });
    console.log(
      `  Cleared        ${affectedBookings.length} demo request(s) referencing seeded assets`,
    );
  }

  await prisma.asset.deleteMany({ where: { ownerId: { in: ownerIds } } });

  let created = 0;

  for (const [index, bp] of ALL_BLUEPRINTS.entries()) {
    const type = typeBySlug.get(bp.typeSlug);
    if (!type) {
      throw new Error(
        `Blueprint "${bp.title}" references unknown asset type "${bp.typeSlug}".`,
      );
    }

    const ownerId = owners.get(bp.ownerSlug);
    if (!ownerId) {
      throw new Error(`Blueprint "${bp.title}" references unknown owner.`);
    }

    const locality = LOCALITIES[bp.locality];
    const lat = jitter(locality.lat, index);
    const lng = jitter(locality.lng, index + 7);
    const slug = `${slugify(bp.title)}-${index + 1}`;
    const images = demoImages(slug);

    const locationMode = type.isMobile
      ? "MOBILE"
      : type.isDigital && bp.typeSlug !== "led-billboard" && bp.typeSlug !== "digital-roadside-screen"
        ? "VENUE"
        : bp.typeSlug.includes("mall") ||
            bp.typeSlug.includes("gym") ||
            bp.typeSlug.includes("cafe") ||
            bp.typeSlug.includes("hotel") ||
            bp.typeSlug.includes("college") ||
            bp.typeSlug.includes("office") ||
            bp.typeSlug.includes("supermarket") ||
            bp.typeSlug.includes("residential") ||
            bp.typeSlug.includes("cinema") ||
            bp.typeSlug.includes("coworking")
          ? "VENUE"
          : "FIXED";

    const asset = await prisma.asset.create({
      data: {
        slug,
        title: bp.title,
        description: `${bp.title}. Demo listing seeded for platform evaluation — not a real advertising site.`,
        ownerId,
        categoryId: type.categoryId,
        typeId: type.id,
        locationMode,
        bookingModel: type.isDigital ? "DIGITAL_SLOT" : "DATE_RANGE",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        specs: bp.specs as Prisma.InputJsonValue,
        dailyImpressions: bp.impressions,
        audienceProfile: bp.audience,
        isFeatured: bp.featured ?? false,
        publishedAt: new Date(),
        ratingAverage: Number((4 + ((index % 10) / 10) * 0.9).toFixed(1)),
        ratingCount: 5 + (index % 25),
        location: {
          create: {
            addressLine: `${locality.name}, ${locality.city}`,
            locality: locality.name,
            city: locality.city,
            state: locality.state,
            pincode: locality.pincode,
            country: "India",
            lat,
            lng,
            areaLabel: type.isMobile ? `${locality.city} metro region` : null,
          },
        },
        images: {
          create: images.map((url, i) => ({
            url,
            alt: `${bp.title} — view ${i + 1}`,
            width: 1200,
            height: 800,
            sortOrder: i,
            isPrimary: i === 0,
          })),
        },
        pricing: {
          create: [
            {
              unit: bp.priceUnit,
              amount: bp.price,
              currency: "INR",
              isDefault: true,
              minDuration: bp.priceUnit === "PER_DAY" ? 1 : undefined,
              discountThreshold: 30,
              discountPercent: 10,
            },
          ],
        },
      },
    });

    // Geography columns are unreachable through the typed client.
    await prisma.$executeRaw`
      UPDATE "AssetLocation"
         SET "geog" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
       WHERE "assetId" = ${asset.id}
    `;

    if (bp.digital) {
      const activeHours = bp.digital.operatingHoursEnd - bp.digital.operatingHoursStart;
      const loopsPerHour = 3600 / bp.digital.loopDurationSeconds;
      await prisma.digitalInventory.create({
        data: {
          assetId: asset.id,
          slotDurationSeconds: bp.digital.slotDurationSeconds,
          loopDurationSeconds: bp.digital.loopDurationSeconds,
          slotsPerLoop: bp.digital.slotsPerLoop,
          operatingHoursStart: bp.digital.operatingHoursStart,
          operatingHoursEnd: bp.digital.operatingHoursEnd,
          screenWidthPx: bp.digital.screenWidthPx,
          screenHeightPx: bp.digital.screenHeightPx,
          estimatedPlaysPerDay: Math.round(activeHours * loopsPerHour),
        },
      });
    }

    for (const area of bp.operatingAreas ?? []) {
      const center = LOCALITIES[area.centerLocality];
      await prisma.operatingArea.create({
        data: {
          assetId: asset.id,
          name: area.name,
          city: area.city,
          centerLat: center.lat,
          centerLng: center.lng,
          radiusMeters: area.radiusMeters,
        },
      });
    }

    if (bp.route) {
      const route = await prisma.route.create({
        data: {
          assetId: asset.id,
          name: bp.route.name,
          startLabel: bp.route.startLabel,
          endLabel: bp.route.endLabel,
        },
      });

      const points = bp.route.via.map((key) => {
        const l = LOCALITIES[key];
        return `${l.lng} ${l.lat}`;
      });
      const wkt = `SRID=4326;LINESTRING(${points.join(", ")})`;

      await prisma.$executeRaw`
        UPDATE "Route"
           SET "path" = ST_GeogFromText(${wkt}),
               "lengthKm" = ST_Length(ST_GeogFromText(${wkt})) / 1000.0
         WHERE "id" = ${route.id}
      `;
    }

    created += 1;
  }

  return created;
}

interface SaleListingBlueprint {
  /** Index into the just-seeded assets for this owner, oldest first. */
  assetIndex: number;
  ownerSlug: string;
  askingPrice: number; // rupees; converted to paise below, matching the `rupees()` helper
  negotiable: boolean;
  locationPrecision: "EXACT" | "APPROXIMATE";
  ownershipType:
    | "FREEHOLD_OWNED"
    | "LEASED"
    | "LONG_TERM_LEASE"
    | "SUB_LEASE"
    | "CONCESSION"
    | "LICENSE"
    | "ADVERTISING_RIGHTS"
    | "OPERATING_RIGHTS"
    | "GOVERNMENT_TENDER"
    | "REVENUE_SHARE"
    | "PARTNERSHIP_JV"
    | "OTHER";
  inclusions: string[];
  inclusionsNote?: string;
  /** Omitted fields render as "Not disclosed by seller" — several blueprints deliberately leave these out. */
  financials?: {
    currentMonthlyRevenue?: number;
    currentAnnualRevenue?: number;
    averageOccupancyPercent?: number;
    expectedRoiPercent?: number;
  };
  property?: {
    propertyOwnershipType: string;
    landOwnerRelationship: string;
    landOwnerName: string;
    surveyNumber: string;
    monthlyLandRent?: number;
  };
  permits?: Array<{
    permitType: string;
    issuingAuthority: string;
    status: "VALID" | "EXPIRED" | "PENDING_RENEWAL" | "NOT_AVAILABLE" | "NOT_APPLICABLE";
    documentNumber?: string;
  }>;
  status: "PUBLISHED" | "DRAFT" | "PAUSED" | "SUBMITTED";
}

/**
 * A representative spread of sale listings, not one-per-asset: the public
 * marketplace demo needs variety across ownership type, disclosed-vs-not
 * financials, and location precision, more than it needs volume.
 */
const SALE_LISTING_BLUEPRINTS: SaleListingBlueprint[] = [
  {
    assetIndex: 0,
    ownerSlug: "skyline-outdoor-demo",
    askingPrice: 4_500_000,
    negotiable: true,
    locationPrecision: "APPROXIMATE",
    ownershipType: "ADVERTISING_RIGHTS",
    inclusions: ["ADVERTISING_RIGHTS", "PHYSICAL_STRUCTURE"],
    inclusionsNote: "Advertising rights cover the road-facing panel only.",
    financials: {
      currentMonthlyRevenue: 65_000,
      currentAnnualRevenue: 780_000,
      averageOccupancyPercent: 82,
      expectedRoiPercent: 17,
    },
    permits: [
      {
        permitType: "MUNICIPAL_ADVERTISING_PERMIT",
        issuingAuthority: "Brihanmumbai Municipal Corporation",
        status: "VALID",
        documentNumber: "BMC/ADV/2024/11827",
      },
      {
        permitType: "STRUCTURAL_STABILITY_CERTIFICATE",
        issuingAuthority: "Licensed structural engineer",
        status: "VALID",
      },
    ],
    status: "PUBLISHED",
  },
  {
    assetIndex: 1,
    ownerSlug: "skyline-outdoor-demo",
    askingPrice: 12_000_000,
    negotiable: false,
    locationPrecision: "EXACT",
    ownershipType: "FREEHOLD_OWNED",
    inclusions: [
      "PHYSICAL_STRUCTURE",
      "LAND_RIGHTS",
      "ADVERTISING_RIGHTS",
      "ELECTRICAL_INFRASTRUCTURE",
    ],
    property: {
      propertyOwnershipType: "Freehold",
      landOwnerRelationship: "Seller owns the land outright",
      landOwnerName: "Skyline Media Pvt. Ltd.",
      surveyNumber: "CTS 412/A, Andheri",
    },
    financials: {
      currentAnnualRevenue: 1_450_000,
      averageOccupancyPercent: 91,
    },
    permits: [
      {
        permitType: "MUNICIPAL_ADVERTISING_PERMIT",
        issuingAuthority: "Brihanmumbai Municipal Corporation",
        status: "VALID",
      },
      {
        permitType: "HIGHWAY_AUTHORITY_PERMISSION",
        issuingAuthority: "National Highways Authority of India",
        status: "PENDING_RENEWAL",
      },
    ],
    status: "PUBLISHED",
  },
  {
    assetIndex: 2,
    ownerSlug: "venue-reach-demo",
    askingPrice: 2_200_000,
    negotiable: true,
    locationPrecision: "APPROXIMATE",
    ownershipType: "OPERATING_RIGHTS",
    inclusions: ["OPERATING_RIGHTS", "DIGITAL_DISPLAY_EQUIPMENT", "CUSTOMER_CONTRACTS"],
    inclusionsNote: "Includes the existing advertiser roster; seller does not hold the venue lease itself.",
    // Financials deliberately omitted — demonstrates "Not disclosed by seller".
    status: "PUBLISHED",
  },
  {
    assetIndex: 3,
    ownerSlug: "venue-reach-demo",
    askingPrice: 8_500_000,
    negotiable: false,
    locationPrecision: "EXACT",
    ownershipType: "LONG_TERM_LEASE",
    inclusions: ["LEASE_RIGHTS", "ADVERTISING_RIGHTS", "PHYSICAL_STRUCTURE"],
    property: {
      propertyOwnershipType: "Leased from a private landowner",
      landOwnerRelationship: "15-year lease, 8 years remaining",
      landOwnerName: "Private landowner (undisclosed to buyers pre-verification)",
      surveyNumber: "Gat No. 221, Powai",
      monthlyLandRent: 45_000,
    },
    financials: {
      currentMonthlyRevenue: 110_000,
      currentAnnualRevenue: 1_320_000,
      expectedRoiPercent: 14,
    },
    permits: [
      {
        permitType: "LAND_OWNER_NOC",
        issuingAuthority: "Private landowner",
        status: "VALID",
      },
      {
        permitType: "FIRE_SAFETY_APPROVAL",
        issuingAuthority: "Mumbai Fire Brigade",
        status: "EXPIRED",
      },
    ],
    status: "PUBLISHED",
  },
  {
    assetIndex: 4,
    ownerSlug: "metro-transit-demo",
    askingPrice: 3_800_000,
    negotiable: true,
    locationPrecision: "APPROXIMATE",
    ownershipType: "GOVERNMENT_TENDER",
    inclusions: ["CONCESSION_RIGHTS", "ADVERTISING_RIGHTS"],
    inclusionsNote: "Concession awarded via municipal tender; buyer must be eligible to hold a transferred concession.",
    financials: {
      currentAnnualRevenue: 890_000,
      averageOccupancyPercent: 76,
    },
    permits: [
      {
        permitType: "GOVERNMENT_CONCESSION_DOC",
        issuingAuthority: "Mumbai Metropolitan Region Transport Corporation",
        status: "VALID",
        documentNumber: "MMRTC/CONC/2022/0043",
      },
      {
        permitType: "RAILWAY_METRO_PERMISSION",
        issuingAuthority: "Mumbai Metro Rail Corporation",
        status: "VALID",
      },
    ],
    status: "PUBLISHED",
  },
  {
    assetIndex: 5,
    ownerSlug: "metro-transit-demo",
    askingPrice: 1_650_000,
    negotiable: true,
    locationPrecision: "APPROXIMATE",
    ownershipType: "SUB_LEASE",
    inclusions: ["LEASE_RIGHTS", "PHYSICAL_STRUCTURE"],
    // Still being prepared for listing — shown as DRAFT in the seller dashboard.
    status: "DRAFT",
  },
  {
    assetIndex: 6,
    ownerSlug: "skyline-outdoor-demo",
    askingPrice: 5_600_000,
    negotiable: false,
    locationPrecision: "EXACT",
    ownershipType: "REVENUE_SHARE",
    inclusions: ["ADVERTISING_RIGHTS", "CUSTOMER_CONTRACTS", "BRANDING_SIGNAGE_RIGHTS"],
    financials: {
      currentMonthlyRevenue: 58_000,
      averageOccupancyPercent: 68,
      expectedRoiPercent: 12,
    },
    // Temporarily taken down by the seller — shown as PAUSED.
    status: "PAUSED",
  },
];

/**
 * Seeds a representative spread of sale listings on top of the demo assets
 * seedAssets just created. Rebuilt each run for the same reason assets are:
 * re-seeding must not accumulate duplicates.
 *
 * The public location point is derived here with the same logic as
 * publishSaleListingLocation in src/server/db/spatial.ts, rather than
 * importing that function — seed scripts build their own PrismaClient
 * instance (see the header comment), so sharing the app's db client module
 * would pull in a second, unwanted connection pool.
 */
async function seedSaleListings(owners: Map<string, string>) {
  const assetsByOwner = new Map<string, { id: string; title: string }[]>();

  for (const ownerSlug of new Set(SALE_LISTING_BLUEPRINTS.map((bp) => bp.ownerSlug))) {
    const ownerId = owners.get(ownerSlug);
    if (!ownerId) throw new Error(`Sale listing blueprint references unknown owner "${ownerSlug}".`);

    const assets = await prisma.asset.findMany({
      where: { ownerId, status: "ACTIVE", verificationStatus: "VERIFIED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true },
    });
    assetsByOwner.set(ownerSlug, assets);
  }

  // Rebuild each run — SaleListing has no unique business key to upsert on,
  // and this keeps re-seeding idempotent the same way seedAssets does.
  const ownerIds = [...owners.values()];
  await prisma.saleListing.deleteMany({ where: { ownerId: { in: ownerIds } } });

  let created = 0;

  for (const bp of SALE_LISTING_BLUEPRINTS) {
    const assets = assetsByOwner.get(bp.ownerSlug) ?? [];
    const asset = assets[bp.assetIndex];
    if (!asset) {
      throw new Error(
        `Sale listing blueprint references asset index ${bp.assetIndex} for owner "${bp.ownerSlug}", but only ${assets.length} eligible assets exist.`,
      );
    }

    const fullAsset = await prisma.asset.findUniqueOrThrow({
      where: { id: asset.id },
      include: {
        type: true,
        location: true,
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    });

    const slug = `${slugify(asset.title)}-for-sale-${created + 1}`;
    const isPublished = bp.status === "PUBLISHED";

    const listing = await prisma.saleListing.create({
      data: {
        assetId: asset.id,
        ownerId: owners.get(bp.ownerSlug)!,
        slug,
        status: bp.status,
        askingPriceAmount: rupees(bp.askingPrice),
        negotiable: bp.negotiable,
        ownershipType: bp.ownershipType,
        inclusions: bp.inclusions as Prisma.SaleListingCreateInput["inclusions"],
        inclusionsNote: bp.inclusionsNote,
        locationPrecision: bp.locationPrecision,

        currentMonthlyRevenue: bp.financials?.currentMonthlyRevenue
          ? rupees(bp.financials.currentMonthlyRevenue)
          : undefined,
        currentAnnualRevenue: bp.financials?.currentAnnualRevenue
          ? rupees(bp.financials.currentAnnualRevenue)
          : undefined,
        averageOccupancyPercent: bp.financials?.averageOccupancyPercent,
        expectedRoiPercent: bp.financials?.expectedRoiPercent,

        ...(bp.property
          ? {
              propertyDetails: {
                create: {
                  propertyOwnershipType: bp.property.propertyOwnershipType,
                  landOwnerRelationship: bp.property.landOwnerRelationship,
                  landOwnerName: bp.property.landOwnerName,
                  surveyNumber: bp.property.surveyNumber,
                  monthlyLandRent: bp.property.monthlyLandRent
                    ? rupees(bp.property.monthlyLandRent)
                    : undefined,
                },
              },
            }
          : {}),

        ...(bp.permits?.length
          ? {
              permits: {
                create: bp.permits.map((permit) => ({
                  permitType: permit.permitType as Prisma.SalePermitCreateManySaleListingInput["permitType"],
                  issuingAuthority: permit.issuingAuthority,
                  status: permit.status,
                  documentNumber: permit.documentNumber,
                })),
              },
            }
          : {}),

        // Every declared document is metadata only, per the product decision
        // that this module records claims, not files — see SaleDocument's
        // doc comment in schema.prisma.
        documents: {
          create: [
            {
              category: "OWNERSHIP",
              documentType:
                bp.ownershipType === "FREEHOLD_OWNED" ? "Sale deed" : "Lease / rights agreement",
              visibility: "BUYER_ON_REQUEST",
            },
          ],
        },

        events: {
          create: { eventType: "CREATED" },
        },

        ...(isPublished
          ? {
              publishedAt: new Date(),
              snapshotTitle: fullAsset.title,
              snapshotDescription: fullAsset.description,
              snapshotCategoryId: fullAsset.categoryId,
              snapshotTypeId: fullAsset.typeId,
              snapshotTypeName: fullAsset.type.name,
              snapshotSpecs: fullAsset.specs as Prisma.InputJsonValue,
              snapshotCity: fullAsset.location?.city,
              snapshotState: fullAsset.location?.state,
              snapshotLocality: fullAsset.location?.locality,
              snapshotImageUrls: fullAsset.images.map((image) => image.url),
              snapshotDailyImpressions: fullAsset.dailyImpressions,
              snapshotAt: new Date(),
              syncState: "IN_SYNC",
            }
          : {}),
      },
    });

    // Public location point, derived once here at "publish" time — matching
    // publishSaleListingLocation's logic: EXACT copies the true point through,
    // APPROXIMATE snaps to a ~1.1km grid cell centre so repeated public reads
    // can never average back to the true site.
    if (isPublished && fullAsset.location?.lat !== undefined && fullAsset.location?.lat !== null) {
      await prisma.$executeRaw`
        UPDATE "SaleListing" sl
           SET "publicGeog" = CASE
                 WHEN sl."locationPrecision" = 'EXACT' THEN al."geog"
                 ELSE ST_SetSRID(
                        ST_SnapToGrid(al."geog"::geometry, 0.005, 0.005, 0.01, 0.01),
                        4326
                      )::geography
               END,
               "publicLat" = CASE
                 WHEN sl."locationPrecision" = 'EXACT' THEN al."lat"
                 ELSE ROUND((FLOOR(al."lat" / 0.01) * 0.01 + 0.005)::numeric, 6)::float8
               END,
               "publicLng" = CASE
                 WHEN sl."locationPrecision" = 'EXACT' THEN al."lng"
                 ELSE ROUND((FLOOR(al."lng" / 0.01) * 0.01 + 0.005)::numeric, 6)::float8
               END,
               "publicLocality" = CASE
                 WHEN sl."locationPrecision" = 'EXACT' THEN al."locality"
                 ELSE NULL
               END,
               "publicCity" = al."city",
               "publicState" = al."state",
               "publicAreaLabel" = al."areaLabel"
          FROM "AssetLocation" al
         WHERE al."assetId" = sl."assetId"
           AND sl."id" = ${listing.id}
      `;
    }

    created += 1;
  }

  return created;
}

async function main() {
  console.log("Seeding ZuperGo demo data...\n");

  const { categoryCount, typeCount } = await seedTaxonomy();
  console.log(`  Taxonomy      ${categoryCount} categories, ${typeCount} asset types`);

  const owners = await seedOwners();
  console.log(`  Media owners  ${owners.size} (verified)`);

  await seedAdvertiser();
  await seedAdmin();
  console.log(
    DEMO_PASSWORD
      ? "  Users         advertiser + admin demo accounts (password set)"
      : "  Users         advertiser + admin demo accounts (NO password — set SEED_DEMO_PASSWORD to enable sign-in)",
  );

  const assetCount = await seedAssets(owners);
  console.log(`  Assets        ${assetCount} Mumbai listings`);

  const saleListingCount = await seedSaleListings(owners);
  console.log(`  Sale listings ${saleListingCount} (demo assets for sale)\n`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
