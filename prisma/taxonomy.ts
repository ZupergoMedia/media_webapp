/**
 * The ZuperGo media taxonomy, expressed as seed data rather than code.
 *
 * This file is the ONLY place asset types are enumerated, and it exists purely
 * to populate the database. Nothing in `src/` imports it. UI components read
 * categories and types from the database at runtime, so adding a new medium is
 * a data change, not a deploy.
 *
 * `specs` on each type are field descriptors. They drive:
 *   - the Add Asset wizard's dynamic form
 *   - runtime Zod validation (compiled by buildZodFromDescriptors)
 *   - the specification table on the asset detail page
 */

export type SpecInput =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "time"
  | "textarea";

export interface SpecDescriptor {
  name: string;
  label: string;
  input: SpecInput;
  unit?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  group?: string;
  order?: number;
  help?: string;
  /**
   * Withheld from public listing pages. The owner supplies it and admins see it
   * during verification, but publishing it would expose information that can be
   * used to track or impersonate a specific physical asset (e.g. a vehicle's
   * registration plate). Enforced by SpecificationTable.
   */
  sensitive?: boolean;
}

export interface SeedAssetType {
  slug: string;
  name: string;
  defaultLocationMode:
    | "FIXED"
    | "AREA"
    | "ROUTE"
    | "MOBILE"
    | "VENUE"
    | "EVENT";
  supportedBookingModels: Array<
    "FULL_ASSET" | "DATE_RANGE" | "TIME_SLOT" | "DIGITAL_SLOT" | "CAMPAIGN"
  >;
  isDigital?: boolean;
  isMobile?: boolean;
  specs: SpecDescriptor[];
}

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
  types: SeedAssetType[];
}

// ---------------------------------------------------------------------------
// Reusable descriptor groups
// ---------------------------------------------------------------------------

/** Physical print/static media: a face with dimensions and lighting. */
const staticFaceSpecs: SpecDescriptor[] = [
  {
    name: "widthFt",
    label: "Width",
    input: "number",
    unit: "ft",
    required: true,
    min: 1,
    group: "Dimensions",
    order: 1,
  },
  {
    name: "heightFt",
    label: "Height",
    input: "number",
    unit: "ft",
    required: true,
    min: 1,
    group: "Dimensions",
    order: 2,
  },
  {
    name: "illumination",
    label: "Illumination",
    input: "select",
    options: ["None", "Backlit", "Frontlit"],
    required: true,
    group: "Display",
    order: 3,
  },
  {
    name: "orientation",
    label: "Orientation",
    input: "select",
    options: ["Portrait", "Landscape"],
    group: "Display",
    order: 4,
  },
  {
    name: "facing",
    label: "Traffic facing",
    input: "text",
    group: "Placement",
    order: 5,
    help: "Direction of oncoming traffic, e.g. 'North-bound towards Airport'",
  },
];

/** Digital screens: resolution, loop economics, operating hours. */
const digitalScreenSpecs: SpecDescriptor[] = [
  {
    name: "screenWidthPx",
    label: "Resolution width",
    input: "number",
    unit: "px",
    required: true,
    min: 1,
    group: "Display",
    order: 1,
  },
  {
    name: "screenHeightPx",
    label: "Resolution height",
    input: "number",
    unit: "px",
    required: true,
    min: 1,
    group: "Display",
    order: 2,
  },
  {
    name: "screenSizeInches",
    label: "Screen size",
    input: "number",
    unit: "in",
    group: "Display",
    order: 3,
  },
  {
    name: "pixelPitch",
    label: "Pixel pitch",
    input: "number",
    unit: "mm",
    group: "Display",
    order: 4,
  },
  {
    name: "slotDurationSeconds",
    label: "Slot duration",
    input: "number",
    unit: "sec",
    required: true,
    min: 1,
    group: "Inventory",
    order: 5,
  },
  {
    name: "loopDurationSeconds",
    label: "Loop duration",
    input: "number",
    unit: "sec",
    required: true,
    min: 1,
    group: "Inventory",
    order: 6,
    help: "Total loop length. Slot duration must divide into this.",
  },
  {
    name: "operatingHours",
    label: "Operating hours",
    input: "text",
    group: "Operations",
    order: 7,
    help: "e.g. 06:00 – 23:00",
  },
  {
    name: "audioEnabled",
    label: "Audio supported",
    input: "boolean",
    group: "Display",
    order: 8,
  },
];

/** Vehicles: registration, coverage, duty cycle. */
const vehicleSpecs: SpecDescriptor[] = [
  {
    name: "vehicleType",
    label: "Vehicle type",
    input: "text",
    required: true,
    group: "Vehicle",
    order: 1,
  },
  {
    name: "registrationNumber",
    label: "Registration number",
    input: "text",
    group: "Vehicle",
    order: 2,
    sensitive: true,
    help: "Shown only to the platform and confirmed bookers.",
  },
  {
    name: "brandingArea",
    label: "Branding area",
    input: "text",
    group: "Vehicle",
    order: 3,
    help: "e.g. Both sides + rear",
  },
  {
    name: "panelWidthFt",
    label: "Panel width",
    input: "number",
    unit: "ft",
    group: "Dimensions",
    order: 4,
  },
  {
    name: "panelHeightFt",
    label: "Panel height",
    input: "number",
    unit: "ft",
    group: "Dimensions",
    order: 5,
  },
  {
    name: "dailyRunKm",
    label: "Average daily run",
    input: "number",
    unit: "km",
    group: "Operations",
    order: 6,
  },
  {
    name: "operatingHours",
    label: "Operating hours",
    input: "text",
    group: "Operations",
    order: 7,
  },
  {
    name: "gpsEnabled",
    label: "GPS tracking available",
    input: "boolean",
    group: "Operations",
    order: 8,
  },
];

/** Venues: footfall and audience character. */
const venueSpecs: SpecDescriptor[] = [
  {
    name: "venueType",
    label: "Venue type",
    input: "text",
    required: true,
    group: "Venue",
    order: 1,
  },
  {
    name: "dailyVisitors",
    label: "Average daily visitors",
    input: "number",
    required: true,
    min: 0,
    group: "Audience",
    order: 2,
  },
  {
    name: "operatingHours",
    label: "Operating hours",
    input: "text",
    group: "Operations",
    order: 3,
  },
  {
    name: "audienceProfile",
    label: "Audience profile",
    input: "textarea",
    group: "Audience",
    order: 4,
    help: "Who typically visits — age band, income, intent.",
  },
  {
    name: "placement",
    label: "Placement within venue",
    input: "text",
    group: "Venue",
    order: 5,
  },
  {
    name: "unitsAvailable",
    label: "Units available",
    input: "number",
    min: 1,
    group: "Inventory",
    order: 6,
  },
];

const streetFurnitureSpecs: SpecDescriptor[] = [
  {
    name: "widthFt",
    label: "Width",
    input: "number",
    unit: "ft",
    required: true,
    group: "Dimensions",
    order: 1,
  },
  {
    name: "heightFt",
    label: "Height",
    input: "number",
    unit: "ft",
    required: true,
    group: "Dimensions",
    order: 2,
  },
  {
    name: "illumination",
    label: "Illumination",
    input: "select",
    options: ["None", "Backlit", "Frontlit"],
    group: "Display",
    order: 3,
  },
  {
    name: "panelCount",
    label: "Number of panels",
    input: "number",
    min: 1,
    group: "Inventory",
    order: 4,
  },
];

const experientialSpecs: SpecDescriptor[] = [
  {
    name: "spaceSqFt",
    label: "Space available",
    input: "number",
    unit: "sq ft",
    group: "Space",
    order: 1,
  },
  {
    name: "expectedFootfall",
    label: "Expected footfall",
    input: "number",
    group: "Audience",
    order: 2,
  },
  {
    name: "powerAvailable",
    label: "Power supply available",
    input: "boolean",
    group: "Facilities",
    order: 3,
  },
  {
    name: "setupAllowed",
    label: "Setup permitted",
    input: "text",
    group: "Facilities",
    order: 4,
    help: "e.g. Canopy, kiosk, inflatable",
  },
  {
    name: "staffingProvided",
    label: "Staffing provided",
    input: "boolean",
    group: "Facilities",
    order: 5,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fixedStatic = (
  slug: string,
  name: string,
  extra: SpecDescriptor[] = [],
): SeedAssetType => ({
  slug,
  name,
  defaultLocationMode: "FIXED",
  supportedBookingModels: ["DATE_RANGE", "FULL_ASSET", "CAMPAIGN"],
  specs: [...staticFaceSpecs, ...extra],
});

const digitalScreen = (
  slug: string,
  name: string,
  mode: SeedAssetType["defaultLocationMode"] = "FIXED",
): SeedAssetType => ({
  slug,
  name,
  defaultLocationMode: mode,
  supportedBookingModels: ["DIGITAL_SLOT", "DATE_RANGE", "CAMPAIGN"],
  isDigital: true,
  specs: digitalScreenSpecs,
});

const vehicle = (slug: string, name: string): SeedAssetType => ({
  slug,
  name,
  defaultLocationMode: "MOBILE",
  supportedBookingModels: ["DATE_RANGE", "CAMPAIGN"],
  isMobile: true,
  specs: vehicleSpecs,
});

const venue = (slug: string, name: string): SeedAssetType => ({
  slug,
  name,
  defaultLocationMode: "VENUE",
  supportedBookingModels: ["DATE_RANGE", "FULL_ASSET", "CAMPAIGN"],
  specs: venueSpecs,
});

const streetFurniture = (slug: string, name: string): SeedAssetType => ({
  slug,
  name,
  defaultLocationMode: "FIXED",
  supportedBookingModels: ["DATE_RANGE", "CAMPAIGN"],
  specs: streetFurnitureSpecs,
});

const experiential = (slug: string, name: string): SeedAssetType => ({
  slug,
  name,
  defaultLocationMode: "EVENT",
  supportedBookingModels: ["DATE_RANGE", "FULL_ASSET", "CAMPAIGN"],
  specs: experientialSpecs,
});

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export const TAXONOMY: SeedCategory[] = [
  {
    slug: "fixed-outdoor",
    name: "Fixed Outdoor",
    description:
      "Billboards, hoardings and large-format structures at fixed roadside locations.",
    icon: "Building2",
    types: [
      fixedStatic("billboard", "Billboard"),
      fixedStatic("hoarding", "Hoarding"),
      fixedStatic("unipole", "Unipole"),
      fixedStatic("gantry", "Gantry"),
      fixedStatic("wallscape", "Wallscape"),
      fixedStatic("building-facade", "Building Facade"),
      fixedStatic("bridge-panel", "Bridge Panel"),
      fixedStatic("flyover-panel", "Flyover Panel"),
      fixedStatic("foot-over-bridge", "Foot-over-bridge"),
      fixedStatic("underpass", "Underpass"),
      fixedStatic("pole-advertising", "Pole Advertising"),
      fixedStatic("roadside-kiosk", "Roadside Kiosk"),
    ],
  },
  {
    slug: "digital-dooh",
    name: "Digital / DOOH",
    description:
      "LED and digital screens sold as time slots within a programmed loop.",
    icon: "MonitorPlay",
    types: [
      digitalScreen("led-billboard", "LED Billboard"),
      digitalScreen("digital-roadside-screen", "Digital Roadside Screen"),
      digitalScreen("mall-screen", "Mall Screen", "VENUE"),
      digitalScreen("cinema-screen", "Cinema Screen", "VENUE"),
      digitalScreen("elevator-screen", "Elevator Screen", "VENUE"),
      digitalScreen("retail-screen", "Retail Screen", "VENUE"),
      digitalScreen("gym-screen", "Gym Screen", "VENUE"),
      digitalScreen("restaurant-screen", "Restaurant Screen", "VENUE"),
      digitalScreen("office-screen", "Office Screen", "VENUE"),
      digitalScreen("residential-society-screen", "Residential Society Screen", "VENUE"),
      digitalScreen("airport-screen", "Airport Screen", "VENUE"),
      digitalScreen("railway-screen", "Railway Screen", "VENUE"),
      digitalScreen("metro-screen", "Metro Screen", "VENUE"),
    ],
  },
  {
    slug: "transit-mobile",
    name: "Transit / Mobile",
    description:
      "Vehicles and transit media that move through defined areas and routes.",
    icon: "Bus",
    types: [
      vehicle("bus", "Bus"),
      vehicle("auto-rickshaw", "Auto-rickshaw"),
      vehicle("taxi", "Taxi"),
      vehicle("cab", "Cab"),
      vehicle("truck", "Truck"),
      vehicle("van", "Advertising Van"),
      vehicle("car", "Car"),
      vehicle("delivery-vehicle", "Delivery Vehicle"),
      vehicle("school-bus", "School Bus"),
      {
        slug: "train",
        name: "Train",
        defaultLocationMode: "ROUTE",
        supportedBookingModels: ["DATE_RANGE", "CAMPAIGN"],
        isMobile: true,
        specs: vehicleSpecs,
      },
      {
        slug: "boat",
        name: "Boat",
        defaultLocationMode: "ROUTE",
        supportedBookingModels: ["DATE_RANGE", "CAMPAIGN"],
        isMobile: true,
        specs: vehicleSpecs,
      },
    ],
  },
  {
    slug: "venue",
    name: "Venue",
    description:
      "Branding inside high-footfall venues where audiences dwell.",
    icon: "Store",
    types: [
      venue("mall", "Mall"),
      venue("gym", "Gym"),
      venue("cafe", "Café"),
      venue("restaurant", "Restaurant"),
      venue("hotel", "Hotel"),
      venue("college", "College"),
      venue("university", "University"),
      venue("office-it-park", "Office / IT Park"),
      venue("coworking-space", "Coworking Space"),
      venue("supermarket", "Supermarket"),
      venue("retail-store", "Retail Store"),
      venue("residential-society", "Residential Society"),
      venue("cinema", "Cinema"),
      venue("event-venue", "Event Venue"),
    ],
  },
  {
    slug: "street-furniture",
    name: "Street Furniture",
    description:
      "Pedestrian-level media embedded in everyday street infrastructure.",
    icon: "Armchair",
    types: [
      streetFurniture("bus-shelter", "Bus Shelter"),
      streetFurniture("bench", "Bench"),
      streetFurniture("kiosk", "Kiosk"),
      streetFurniture("lamp-post", "Lamp Post"),
      streetFurniture("utility-box", "Utility Box"),
      streetFurniture("charging-station", "Charging Station"),
      streetFurniture("parking-area", "Parking Area"),
      streetFurniture("traffic-island", "Traffic Island"),
      streetFurniture("road-divider", "Road Divider"),
    ],
  },
  {
    slug: "experiential",
    name: "Experiential",
    description:
      "Activation space for sampling, roadshows and live brand experiences.",
    icon: "Sparkles",
    types: [
      experiential("event-branding", "Event Branding"),
      experiential("exhibition", "Exhibition"),
      experiential("roadshow", "Roadshow"),
      experiential("brand-activation", "Brand Activation"),
      experiential("promotional-kiosk", "Promotional Kiosk"),
      experiential("sampling-location", "Sampling Location"),
      experiential("college-fest", "College Fest"),
      experiential("sports-event", "Sports Event"),
      experiential("temporary-structure", "Temporary Advertising Structure"),
    ],
  },
];
