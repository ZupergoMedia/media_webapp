/**
 * Blog content.
 *
 * Posts are typed data rather than HTML strings or MDX: the renderer
 * (src/app/blog) maps each block to a component, so a post can never inject
 * markup and there is no `dangerouslySetInnerHTML` in the rendering path.
 * That also means no new build dependency — this project has no MDX pipeline.
 *
 * Adding a post: append to POSTS with a unique `slug`. `publishedAt` is an
 * ISO date string so it sorts lexicographically and needs no parsing to
 * order the index.
 */

export type BlogBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  /** Bulleted list. Each item may lead with a bolded term before a colon. */
  | { kind: "list"; items: string[] }
  /** Pulled-out statement — used sparingly, for the one line that matters most. */
  | { kind: "callout"; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description and index-card summary. One or two sentences. */
  summary: string;
  publishedAt: string;
  /** Rough reading time in minutes, shown on the card and the post header. */
  readingMinutes: number;
  category: string;
  body: BlogBlock[];
}

export const POSTS: BlogPost[] = [
  {
    slug: "types-of-outdoor-advertising-media",
    title: "The main types of outdoor advertising media, and what each is good for",
    summary:
      "Billboards, transit, street furniture, venue and experiential formats all reach people differently. A plain-language guide to what each format does well.",
    publishedAt: "2026-07-14",
    readingMinutes: 7,
    category: "Fundamentals",
    body: [
      {
        kind: "paragraph",
        text: "Out-of-home advertising is often discussed as though it were one thing. It is not. A hoarding on a national highway and a screen beside a gym treadmill both count as OOH, but they reach different people in different states of mind, and they are bought on completely different logic. Choosing between them starts with understanding what each format is actually good at.",
      },
      { kind: "heading", text: "Large-format roadside" },
      {
        kind: "paragraph",
        text: "Billboards, hoardings, unipoles and gantries are the formats most people picture first. They are built for reach and recall: high traffic volumes, long sight lines, and a message that has to land in the two or three seconds a driver can spare. That constraint is the format's defining feature. Six words and one image will outperform a paragraph every time.",
      },
      {
        kind: "paragraph",
        text: "Large-format sites work well for brand building, launches, and anything where the goal is for a lot of people to know a name. They are weaker for detail — a phone number on a highway hoarding is close to wasted ink.",
      },
      { kind: "heading", text: "Transit and mobile" },
      {
        kind: "paragraph",
        text: "Bus exteriors, auto-rickshaw hoods, taxi and cab branding, and truck or van wraps move the advertisement through the city rather than waiting for the city to pass it. The trade-off is precision: a mobile asset covers an area rather than a point, so it is measured by route and operating zone instead of a single set of coordinates.",
      },
      {
        kind: "paragraph",
        text: "Transit suits campaigns that want repeated, incidental exposure across a wide catchment — the same vehicle passing the same commuters on several days a week. It is also the format that most reliably reaches pedestrians and slow traffic at eye level.",
      },
      { kind: "heading", text: "Street furniture" },
      {
        kind: "paragraph",
        text: "Bus shelters, kiosks, benches, lamp posts, utility boxes and traffic islands sit close to the ground and close to the viewer. Dwell time is the advantage here: somebody waiting for a bus has minutes, not seconds. That makes street furniture one of the few OOH formats where a longer message, a QR code, or a specific offer can genuinely work.",
      },
      { kind: "heading", text: "Venue and in-store" },
      {
        kind: "paragraph",
        text: "Malls, gyms, cafés, cinemas, offices, colleges and residential societies offer something roadside cannot: a known audience in a known context. A screen in a gym reaches people already thinking about health. A panel in an IT park reaches a salaried, urban, time-poor audience during their working week.",
      },
      {
        kind: "callout",
        text: "Venue media trades scale for relevance. Fewer people see it, but you know far more about who they are.",
      },
      { kind: "heading", text: "Experiential and temporary" },
      {
        kind: "paragraph",
        text: "Event branding, exhibitions, roadshows, sampling counters and promotional kiosks are the only OOH formats where the audience can respond in the moment. They cost more per person reached and take real operational effort, but they are the only ones that can put a product in somebody's hand.",
      },
      { kind: "heading", text: "How to choose" },
      {
        kind: "list",
        items: [
          "Reach as many people as possible: large-format roadside, then transit.",
          "Reach a specific kind of person: venue media, chosen by the venue's own audience.",
          "Say something that needs more than a few words: street furniture, or venue screens with dwell time.",
          "Cover a whole city rather than one junction: transit and mobile.",
          "Get a reaction, not just recall: experiential.",
        ],
      },
      {
        kind: "paragraph",
        text: "Most real campaigns mix two or three. A launch might pair a handful of large-format sites for awareness with venue screens for relevance, and transit to fill the gaps between them.",
      },
    ],
  },
  {
    slug: "led-outdoor-media-what-to-check",
    title: "LED and digital outdoor media: what actually matters when you buy it",
    summary:
      "Pixel pitch, loop length, slot duration and operating hours decide what a digital screen is worth. Here is how to read a DOOH spec sheet without being misled.",
    publishedAt: "2026-07-28",
    readingMinutes: 8,
    category: "Digital / DOOH",
    body: [
      {
        kind: "paragraph",
        text: "Digital out-of-home is sold on numbers, and the numbers are easy to present flatteringly. A screen advertised as reaching two hundred thousand people a day may be showing your creative for six seconds in a ninety-second loop, which is a very different proposition. Knowing which figures to interrogate is most of the skill in buying DOOH well.",
      },
      { kind: "heading", text: "Slot duration and loop length" },
      {
        kind: "paragraph",
        text: "These two numbers together decide your actual share of the screen. A ten-second slot in a sixty-second loop means your creative is on screen one sixth of the time — roughly ten minutes in every hour of operation. The same ten-second slot in a one-hundred-and-eighty-second loop is a third of that.",
      },
      {
        kind: "callout",
        text: "Share of voice is slot duration divided by loop length. Ask for both numbers, never just one.",
      },
      {
        kind: "paragraph",
        text: "Loop length also tends to grow over a site's life as more advertisers are added. A site that quoted a sixty-second loop when it opened may be running one hundred and twenty seconds a year later, halving what every existing advertiser gets without anyone renegotiating.",
      },
      { kind: "heading", text: "Operating hours" },
      {
        kind: "paragraph",
        text: "An impression count is meaningless without the hours behind it. A screen running from six in the morning to eleven at night gives seventeen hours of plays; one that switches off at eight in the evening gives fourteen, and loses the entire evening commute. When comparing two sites, normalise to plays per day rather than trusting the headline reach.",
      },
      { kind: "heading", text: "Pixel pitch and viewing distance" },
      {
        kind: "paragraph",
        text: "Pixel pitch is the distance in millimetres between adjacent LEDs. Smaller pitch means finer detail and a higher price. The important point is that pitch only matters relative to how far away the viewer is: a P10 screen looks coarse from three metres and perfectly sharp from thirty. Paying for a P4 panel on a highway is paying for detail nobody is close enough to resolve.",
      },
      {
        kind: "list",
        items: [
          "Indoor, close viewing (malls, lifts, retail): finer pitch earns its cost.",
          "Roadside at distance: a coarser pitch is usually the honest choice.",
          "Ask for screen resolution in pixels, not only the physical size — that is what your creative must be authored to.",
        ],
      },
      { kind: "heading", text: "Brightness and legibility" },
      {
        kind: "paragraph",
        text: "Brightness is measured in nits. A screen bright enough indoors will wash out completely in direct afternoon sun, and a screen bright enough for daylight will be uncomfortably glaring at night unless it dims automatically. Automatic brightness adjustment is worth asking about specifically — without it, a site is either unreadable for part of the day or a nuisance for the rest of it.",
      },
      { kind: "heading", text: "What to ask for in writing" },
      {
        kind: "list",
        items: [
          "Slot duration, loop length, and whether loop length is capped.",
          "Operating hours, and estimated plays per day derived from them.",
          "Screen resolution in pixels and accepted creative formats.",
          "Whether the site shares the loop with public-service or operator content.",
          "Uptime history, and what happens to your slots if the screen fails.",
        ],
      },
      {
        kind: "paragraph",
        text: "That last point is the one most often left vague. A digital site that goes dark for a week has not delivered what a static hoarding would have delivered in the same week, and the contract should say what follows from that.",
      },
    ],
  },
  {
    slug: "van-and-mobile-media-guide",
    title: "Van and mobile media: buying advertising that moves",
    summary:
      "Mobile assets are measured by route and coverage rather than a fixed point. What LED vans, truck wraps and vehicle branding are good for, and how to verify what you are buying.",
    publishedAt: "2026-08-11",
    readingMinutes: 7,
    category: "Transit / Mobile",
    body: [
      {
        kind: "paragraph",
        text: "A hoarding waits for its audience. A van goes and finds them. That difference sounds simple and changes almost everything about how mobile media is priced, verified and judged.",
      },
      { kind: "heading", text: "The formats" },
      {
        kind: "list",
        items: [
          "LED vans: a screen mounted on a vehicle, usually with sound, parked at events or driven along a set route. The most attention-getting mobile format and the most expensive.",
          "Truck and van wraps: printed vinyl across the vehicle body. Cheap per impression, and the vehicle is doing its normal commercial work anyway.",
          "Bus exteriors: large, repeated, route-bound exposure on a fixed timetable — the most predictable mobile format.",
          "Auto-rickshaw and taxi branding: dense, eye-level, and unusually good at reaching pedestrians and slow traffic in congested areas.",
        ],
      },
      { kind: "heading", text: "Coverage, not coordinates" },
      {
        kind: "paragraph",
        text: "A fixed site is a point on a map, and you can stand at it. A mobile asset is an area and a schedule. That means the questions change: not \"where is it?\" but \"where does it go, how often, and at what times of day?\"",
      },
      {
        kind: "callout",
        text: "For a mobile asset, the route and the operating hours are the inventory. Everything else is detail.",
      },
      {
        kind: "paragraph",
        text: "A van that covers an affluent suburb between ten in the morning and four in the afternoon is reaching a very different audience from the same van covering the same suburb during the evening commute. Ask for the route and the timings together; neither is informative alone.",
      },
      { kind: "heading", text: "Verifying delivery" },
      {
        kind: "paragraph",
        text: "This is where mobile media has historically been weakest, and where it has improved most. A static hoarding can be photographed. A van's route has to be evidenced, and the credible options are GPS logs, timestamped photographs from the route, or both.",
      },
      {
        kind: "list",
        items: [
          "Ask whether the vehicle carries GPS tracking, and whether you get access to the logs.",
          "Agree what counts as a day of delivery — hours on route, distance covered, or both.",
          "Ask what happens on a day the vehicle breaks down or is off the road.",
          "For LED vans, confirm whether audio is permitted at the intended locations. Many municipalities restrict it.",
        ],
      },
      { kind: "heading", text: "Where mobile media earns its place" },
      {
        kind: "paragraph",
        text: "Mobile formats are strong when the goal is coverage of an area rather than domination of a location — a new outlet wanting to be known across a few neighbourhoods, a service business whose catchment is a radius, or a campaign that needs presence at several events in one week. They are a poor substitute for a landmark site if the objective is prestige or a single, unmissable statement.",
      },
      {
        kind: "paragraph",
        text: "They also tend to be the most forgiving entry point. Budgets are smaller, commitments are shorter, and a campaign that does not work has cost less to learn from.",
      },
    ],
  },
  {
    slug: "how-outdoor-advertising-is-changing",
    title: "What is actually changing in outdoor advertising",
    summary:
      "Digitisation, programmatic buying, measurement, and tighter permitting are reshaping OOH. A look at which shifts are real and which are mostly marketing.",
    publishedAt: "2026-08-19",
    readingMinutes: 8,
    category: "Industry",
    body: [
      {
        kind: "paragraph",
        text: "Outdoor advertising has been declared on the verge of transformation for most of the last decade. Some of that has now genuinely happened, and some of it remains a pitch deck. It is worth separating the two.",
      },
      { kind: "heading", text: "Digitisation is real, and uneven" },
      {
        kind: "paragraph",
        text: "Screens have replaced printed panels at a genuine pace in premium locations — airports, malls, metro concourses, business districts. What has not happened is wholesale replacement. Static large-format remains the backbone of roadside inventory, because it is cheaper to build, cheaper to run, needs no power at every site, and does not fail visibly when a controller dies.",
      },
      {
        kind: "paragraph",
        text: "The practical consequence for buyers is a two-speed market: digital where the footfall is dense and premium, static almost everywhere else. Campaigns that insist on one or the other tend to overpay or under-reach.",
      },
      { kind: "heading", text: "Measurement has improved, but the ground truth is still local" },
      {
        kind: "paragraph",
        text: "Mobility data, anonymised device counts and camera-based traffic estimates have made audience figures far better than the guesswork of a decade ago. They have not made them exact. A count of vehicles passing a site is not a count of people who looked at it, and no vendor's methodology fully closes that gap.",
      },
      {
        kind: "callout",
        text: "Treat impression figures as comparative, not absolute. They are useful for ranking two sites and unreliable as a promise.",
      },
      { kind: "heading", text: "Programmatic buying is arriving slowly" },
      {
        kind: "paragraph",
        text: "Programmatic DOOH — buying screen time through an automated exchange, sometimes triggered by weather or time of day — works, and is genuinely useful for national advertisers running many sites. For a business buying a handful of sites in one city, it mostly adds a layer of intermediation to a transaction that was already a phone call to the site owner.",
      },
      { kind: "heading", text: "Permitting and compliance are tightening" },
      {
        kind: "paragraph",
        text: "This is the shift that gets the least attention and affects owners most. Municipal authorities across Indian cities have become considerably more active on hoarding permits, structural stability certification and unauthorised sites. Several high-profile structural failures accelerated that.",
      },
      {
        kind: "list",
        items: [
          "Structural stability certification is increasingly non-negotiable, not paperwork.",
          "Permit validity is checked more often, and expired permits are enforced against.",
          "Sites near highways, railways and airports face additional authority approvals that can take months.",
          "Buyers increasingly ask to see permits before committing, which was rare not long ago.",
        ],
      },
      { kind: "heading", text: "Ownership is getting more complicated to describe" },
      {
        kind: "paragraph",
        text: "The party selling a site is frequently not the party that owns the land, and often does not own the structure either. Advertising rights, operating rights, concessions and revenue-share arrangements have layered up. That is not new, but the expectation that it be stated clearly is.",
      },
      {
        kind: "paragraph",
        text: "For anyone buying or investing, the useful discipline is to ask separately about the structure, the land, the advertising right and the permits, rather than accepting a single word like \"owned\" to cover all four.",
      },
    ],
  },
  {
    slug: "understanding-media-asset-ownership-and-rights",
    title: "Understanding media asset ownership: structure, land, rights and permits",
    summary:
      "The seller of an outdoor advertising asset often owns neither the land nor the structure. A guide to the four things that are actually being transacted.",
    publishedAt: "2026-08-25",
    readingMinutes: 9,
    category: "Ownership & Rights",
    body: [
      {
        kind: "paragraph",
        text: "\"I own a billboard\" is one of the least precise sentences in outdoor advertising. It can mean the speaker holds title to the land, or built and owns the steel, or has a five-year right to sell advertising on somebody else's wall, or won a municipal concession to operate a set of bus shelters. These are materially different positions, and confusing them is how deals go wrong.",
      },
      {
        kind: "callout",
        text: "Four things can be owned independently: the land, the structure, the advertising right, and the permits. Ask about each separately.",
      },
      { kind: "heading", text: "The land" },
      {
        kind: "paragraph",
        text: "Somebody owns the ground or the building the asset stands on. Often it is a private landowner, a housing society, a commercial building, or a government body. The advertising operator's relationship to them is usually a lease or a licence with a term, a rent, and renewal conditions — and that term is one of the most important numbers in the whole transaction. A hoarding with eighteen months left on its land lease is a substantially different asset from the same hoarding with twelve years.",
      },
      { kind: "heading", text: "The structure" },
      {
        kind: "paragraph",
        text: "The physical steel, foundation, panels, lighting and any digital equipment. This can be owned outright by the operator even when the land is not. It carries its own obligations: structural stability certification, maintenance, insurance, and eventual replacement. Ask when it was installed, when it was last inspected, and what its remaining useful life is.",
      },
      { kind: "heading", text: "The advertising right" },
      {
        kind: "paragraph",
        text: "The right to sell and display advertising at that location. This is what actually generates revenue, and it is frequently the only thing being sold. It may be granted by the landowner, won through a municipal tender, or sub-licensed from another operator — and it may be non-transferable, which matters enormously if you are buying.",
      },
      {
        kind: "list",
        items: [
          "Is the right transferable, and does the transfer need the landowner's or authority's consent?",
          "How long does it run, and on what renewal terms?",
          "Is it exclusive, or can the landowner grant a competing right nearby?",
          "Does any revenue share apply, and to whom?",
        ],
      },
      { kind: "heading", text: "The permits" },
      {
        kind: "paragraph",
        text: "Permissions are separate from all of the above and are granted by authorities, not by the seller. Depending on the site these can include a municipal advertising permit, a hoarding permit, structural stability certification, land or property owner NOCs, traffic authority clearance, and — near highways, railways or airports — additional authority permissions.",
      },
      {
        kind: "paragraph",
        text: "Permits expire. A site with a lapsed permit is not a discounted site; it is a site that may be required to come down. Check the expiry dates, the issuing authority, and whether renewal is routine or contested at that location.",
      },
      { kind: "heading", text: "Why this matters for buyers and sellers alike" },
      {
        kind: "paragraph",
        text: "For a buyer, separating these four questions turns a vague proposition into something that can be valued. For a seller, answering them clearly is the fastest way to be taken seriously — a listing that states plainly \"we own the structure, hold a ten-year advertising right, do not own the land, and have a current municipal permit expiring in 2028\" is far more credible than one that just says \"prime hoarding for sale\".",
      },
      {
        kind: "paragraph",
        text: "It is also worth being clear about what a marketplace can and cannot verify. Documents provided by a seller are exactly that until somebody with the authority to do so has checked them. Treat seller-stated information as a starting point for due diligence, not a substitute for it.",
      },
    ],
  },
];

/** Newest first — the order the index and any feed should use. */
export const POSTS_BY_DATE = [...POSTS].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug);
}
