import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

/**
 * Sets `data-theme` before first paint, so a returning visitor with "dark"
 * saved never sees a flash of the light palette while React hydrates.
 * Deliberately plain script text, not a React component: it must run
 * synchronously in <head>, before any CSS-driven paint, which only
 * `strategy="beforeInteractive"` guarantees.
 *
 * Mirrors the fallback logic in theme-provider.tsx exactly — "system" (the
 * default, and what a parse failure or missing value falls back to) removes
 * any attribute, since globals.css already handles that case via
 * `prefers-color-scheme` on bare `:root`.
 */
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("zupergo-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ZuperGo — Find. Book. Be Seen.",
    template: "%s · ZuperGo",
  },
  description:
    "Discover and book billboards, digital screens, vehicles, venues and more. ZuperGo is the marketplace for out-of-home advertising.",
  keywords: [
    "out of home advertising",
    "OOH media",
    "billboard booking",
    "DOOH",
    "digital screens",
    "transit advertising",
    "Mumbai advertising",
  ],
  openGraph: {
    type: "website",
    siteName: "ZuperGo",
    title: "ZuperGo — Find. Book. Be Seen.",
    description:
      "Discover and book billboards, digital screens, vehicles, venues and more.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "ZuperGo — Find. Book. Be Seen.",
    description:
      "Discover and book billboards, digital screens, vehicles, venues and more.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <Script id="theme-no-flash" strategy="beforeInteractive">
          {NO_FLASH_THEME_SCRIPT}
        </Script>
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <GoogleAnalytics />
        <ThemeProvider>
          <AuthSessionProvider>
            <QueryProvider>{children}</QueryProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
