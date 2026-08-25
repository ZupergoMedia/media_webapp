import Script from "next/script";
import { gaMeasurementId } from "@/lib/env";

/**
 * Google Analytics (gtag.js), loaded site-wide from the root layout.
 *
 * Renders nothing when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset — see env.ts —
 * so local development and any environment that hasn't been given a
 * measurement id never fires real analytics events.
 *
 * `afterInteractive` (next/script's default) loads gtag.js early but after
 * hydration, which is the strategy Next's own guide recommends for
 * analytics: high priority, but not render-blocking.
 */
export function GoogleAnalytics() {
  if (!gaMeasurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaMeasurementId}');
        `}
      </Script>
    </>
  );
}
