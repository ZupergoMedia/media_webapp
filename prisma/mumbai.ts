/**
 * Mumbai seed inventory.
 *
 * All coordinates are real locations, so the map, bounds queries and distance
 * sorting behave believably. Company and asset names are invented and marked as
 * demo data — no real media owner or brand is represented here.
 */

export interface SeedLocality {
  name: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

/** Real Mumbai localities with approximate centroids. */
export const LOCALITIES: Record<string, SeedLocality> = {
  bkc: {
    name: "Bandra Kurla Complex",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400051",
    lat: 19.0662,
    lng: 72.8686,
  },
  bandra: {
    name: "Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    lat: 19.0596,
    lng: 72.8295,
  },
  andheri: {
    name: "Andheri East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400069",
    lat: 19.1136,
    lng: 72.8697,
  },
  lowerParel: {
    name: "Lower Parel",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400013",
    lat: 18.9977,
    lng: 72.8302,
  },
  worli: {
    name: "Worli",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400018",
    lat: 19.0176,
    lng: 72.8162,
  },
  powai: {
    name: "Powai",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400076",
    lat: 19.1176,
    lng: 72.906,
  },
  thane: {
    name: "Thane West",
    city: "Thane",
    state: "Maharashtra",
    pincode: "400601",
    lat: 19.2183,
    lng: 72.9781,
  },
  naviMumbai: {
    name: "Vashi, Navi Mumbai",
    city: "Navi Mumbai",
    state: "Maharashtra",
    pincode: "400703",
    lat: 19.077,
    lng: 72.9986,
  },
  juhu: {
    name: "Juhu",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400049",
    lat: 19.1075,
    lng: 72.8263,
  },
  dadar: {
    name: "Dadar",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400014",
    lat: 19.0183,
    lng: 72.8435,
  },
  goregaon: {
    name: "Goregaon East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400063",
    lat: 19.1663,
    lng: 72.8526,
  },
  malad: {
    name: "Malad West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400064",
    lat: 19.1864,
    lng: 72.8484,
  },
};

/**
 * Demo media owners. Names are fictional and suffixed so they can never be
 * mistaken for real companies.
 */
export const OWNERS = [
  {
    slug: "skyline-outdoor-demo",
    companyName: "Skyline Outdoor Media (Demo)",
    description:
      "Large-format roadside inventory across the western suburbs. Demo account for platform evaluation.",
    city: "Mumbai",
    contactName: "Operations Desk",
    contactEmail: "owner.skyline@demo.zupergo.test",
    rating: 4.6,
    ratingCount: 38,
  },
  {
    slug: "pulse-digital-demo",
    companyName: "Pulse Digital Networks (Demo)",
    description:
      "DOOH screen network spanning malls, offices and transit hubs. Demo account.",
    city: "Mumbai",
    contactName: "Network Operations",
    contactEmail: "owner.pulse@demo.zupergo.test",
    rating: 4.8,
    ratingCount: 52,
  },
  {
    slug: "metro-transit-demo",
    companyName: "Metro Transit Ads (Demo)",
    description:
      "Vehicle and transit branding fleet operating across Mumbai and Thane. Demo account.",
    city: "Mumbai",
    contactName: "Fleet Desk",
    contactEmail: "owner.metro@demo.zupergo.test",
    rating: 4.3,
    ratingCount: 21,
  },
  {
    slug: "venue-reach-demo",
    companyName: "VenueReach Media (Demo)",
    description:
      "In-venue advertising across gyms, cafés, malls and residential societies. Demo account.",
    city: "Mumbai",
    contactName: "Partnerships",
    contactEmail: "owner.venuereach@demo.zupergo.test",
    rating: 4.5,
    ratingCount: 29,
  },
];

/**
 * Deterministic placeholder imagery.
 *
 * picsum.photos with a fixed seed returns a stable photo per asset, so the
 * gallery looks like real inventory without shipping binaries or implying that
 * any particular site is depicted.
 */
export function demoImages(seed: string, count = 4): string[] {
  return Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/seed/${seed}-${i}/1200/800`,
  );
}

/** Nudges a coordinate off its locality centroid so pins do not stack. */
export function jitter(base: number, index: number, scale = 0.004): number {
  // Deterministic pseudo-offset: golden-ratio stride keeps points spread evenly
  // and repeatable between seed runs.
  const offset = ((index * 0.6180339887) % 1) - 0.5;
  return Number((base + offset * scale * 2).toFixed(6));
}
