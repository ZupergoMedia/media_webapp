import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

/**
 * robots.txt.
 *
 * Disallows the authenticated areas (matching PROTECTED_ROUTES in
 * server/auth/config.ts) and the API, and points crawlers at the sitemap.
 *
 * The disallow list is belt-and-braces: those pages already send
 * `robots: noindex` and are behind auth, so a crawler could not read them
 * anyway. Stating it here saves the crawl budget being spent on redirects
 * to /signin.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/owner", "/requests", "/api", "/signin"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
