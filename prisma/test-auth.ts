/**
 * Auth test:  pnpm test:auth
 *
 * Exercises the real sign-in flow over HTTP against the running dev server,
 * including the CSRF handshake Auth.js requires. Then checks that a session
 * cookie actually unlocks the right routes and no others.
 *
 * These are the checks that matter most in this step: a subtle auth mistake
 * does not throw, it just quietly lets the wrong person in.
 */
import "dotenv/config";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.SEED_DEMO_PASSWORD;

let failures = 0;
function check(label: string, passed: boolean, detail: string) {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!passed) failures += 1;
}

/** Minimal cookie jar: Auth.js needs CSRF and session cookies to travel together. */
class Jar {
  private cookies = new Map<string, string>();

  absorb(response: Response) {
    // getSetCookie() keeps multiple Set-Cookie headers separate, which a plain
    // .get() would collapse into one malformed string.
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  header(): string {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  has(substring: string): boolean {
    return [...this.cookies.keys()].some((name) => name.includes(substring));
  }
}

/** Performs a full credentials sign-in, returning the resulting cookie jar. */
async function signIn(email: string, password: string): Promise<Jar | null> {
  const jar = new Jar();

  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    email,
    password,
    csrfToken,
    callbackUrl: BASE,
  });

  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body,
    redirect: "manual",
  });

  jar.absorb(response);

  return jar.has("session-token") ? jar : null;
}

async function status(path: string, jar?: Jar): Promise<number> {
  const response = await fetch(`${BASE}${path}`, {
    headers: jar ? { Cookie: jar.header() } : {},
    redirect: "manual",
  });
  return response.status;
}

async function main() {
  console.log("\nZuperGo auth test\n");

  if (!PASSWORD) {
    console.error("SEED_DEMO_PASSWORD is not set — cannot test sign-in.\n");
    process.exit(1);
  }

  // Confirm the server is up before interpreting failures as auth bugs.
  try {
    await fetch(`${BASE}/api/auth/csrf`);
  } catch {
    console.error(`No server at ${BASE}. Start it with: pnpm dev\n`);
    process.exit(1);
  }

  // --- Signed out ---------------------------------------------------------
  check("Protected page redirects when signed out", (await status("/admin")) === 307, "307");
  check("Owner page redirects when signed out", (await status("/owner")) === 307, "307");
  check("Public page is reachable", (await status("/explore")) === 200, "200");

  const unauthRequest = await fetch(`${BASE}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetSlug: "premium-billboard-bkc-signal-junction-1",
      from: "2029-01-01",
      to: "2029-01-31",
      campaignName: "Unauthenticated",
      brandName: "X",
      contactEmail: "a@b.test",
      contactPhone: "+91 90000 00000",
    }),
  });
  check(
    "Request API rejects anonymous writes",
    unauthRequest.status === 401,
    `${unauthRequest.status}`,
  );

  // --- Bad credentials ----------------------------------------------------
  const wrongPassword = await signIn("admin@demo.zupergo.test", "not-the-password");
  check("Wrong password does not sign in", wrongPassword === null, "no session cookie");

  const unknownUser = await signIn("nobody@nowhere.test", PASSWORD);
  check("Unknown email does not sign in", unknownUser === null, "no session cookie");

  // --- Advertiser ---------------------------------------------------------
  const advertiser = await signIn("advertiser@demo.zupergo.test", PASSWORD);
  check("Advertiser can sign in", advertiser !== null, advertiser ? "session established" : "failed");

  if (advertiser) {
    const session = await fetch(`${BASE}/api/auth/session`, {
      headers: { Cookie: advertiser.header() },
    }).then((r) => r.json());

    check(
      "Session carries identity and role",
      session?.user?.email === "advertiser@demo.zupergo.test" &&
        session?.user?.role === "ADVERTISER",
      `${session?.user?.email} / ${session?.user?.role}`,
    );

    // Role separation: an advertiser must not reach owner or admin areas.
    check("Advertiser blocked from /admin", (await status("/admin", advertiser)) === 307, "307");
    check("Advertiser blocked from /owner", (await status("/owner", advertiser)) === 307, "307");
    check("Advertiser reaches /explore", (await status("/explore", advertiser)) === 200, "200");
  }

  // --- Media owner --------------------------------------------------------
  const owner = await signIn("owner.skyline@demo.zupergo.test", PASSWORD);
  check("Media owner can sign in", owner !== null, owner ? "session established" : "failed");

  if (owner) {
    check("Owner reaches /owner", (await status("/owner", owner)) === 200, "200");
    check("Owner reaches /owner/assets", (await status("/owner/assets", owner)) === 200, "200");
    check("Owner blocked from /admin", (await status("/admin", owner)) === 307, "307");

    // An owner must not be able to self-approve their own listing.
    const selfApprove = await fetch(`${BASE}/api/admin/assets/any-id/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner.header() },
      body: JSON.stringify({ decision: "VERIFIED" }),
    });
    check(
      "Owner cannot self-approve listings",
      selfApprove.status === 403,
      `${selfApprove.status} (expect 403)`,
    );
  }

  // --- Admin --------------------------------------------------------------
  const admin = await signIn("admin@demo.zupergo.test", PASSWORD);
  check("Admin can sign in", admin !== null, admin ? "session established" : "failed");

  if (admin) {
    check("Admin reaches /admin", (await status("/admin", admin)) === 200, "200");
    check(
      "Admin reaches /admin/verifications",
      (await status("/admin/verifications", admin)) === 200,
      "200",
    );
    // Admins are allowed into owner areas by policy — see PROTECTED_ROUTES.
    check("Admin reaches /owner", (await status("/owner", admin)) === 200, "200");
  }

  // --- Booking privacy ----------------------------------------------------
  // A reference is short and human-readable, so it must not be sufficient on
  // its own to read a stranger's request.
  if (advertiser && owner) {
    const created = await fetch(`${BASE}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: advertiser.header() },
      body: JSON.stringify({
        assetSlug: "wallscape-worli-sea-face-approach-5",
        from: "2030-02-01",
        to: "2030-02-20",
        campaignName: "Auth Privacy Test",
        brandName: "Demo",
        contactEmail: "advertiser@demo.zupergo.test",
        contactPhone: "+91 90000 00000",
      }),
    });

    if (created.status === 201) {
      const { reference } = (await created.json()) as { reference: string };

      check(
        "Requester can read their own request",
        (await status(`/requests/${reference}`, advertiser)) === 200,
        "200",
      );

      // VenueReach owns no part of this booking, so it must look absent.
      const stranger = await signIn("owner.venuereach@demo.zupergo.test", PASSWORD);
      if (stranger) {
        const strangerStatus = await status(`/requests/${reference}`, stranger);
        check(
          "Unrelated user cannot read the request",
          strangerStatus === 404,
          `${strangerStatus} (expect 404, not 200)`,
        );
      }

      check(
        "Admin can read any request",
        admin ? (await status(`/requests/${reference}`, admin)) === 200 : false,
        "200",
      );

      // Withdraw so the suite is repeatable. Without this the next run hits the
      // duplicate-request guard on the same dates and fails for the wrong
      // reason — a test-isolation problem masquerading as a product bug.
      await fetch(`${BASE}/api/requests/${reference}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: advertiser.header(),
        },
        body: JSON.stringify({ response: "WITHDRAWN" }),
      });
    } else {
      check("Request created for privacy test", false, `status ${created.status}`);
    }
  }

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Auth test error:\n", error);
  process.exit(1);
});
