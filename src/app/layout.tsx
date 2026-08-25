import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <GoogleAnalytics />
        <AuthSessionProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
