import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Remote image hosts. next/image refuses any host not listed here, which is
     * the intended behaviour: it prevents the app from becoming an open image
     * proxy.
     *
     * `picsum.photos` serves the seeded demo imagery. Partner-uploaded photos
     * live on Vercel Blob (below); pasted URLs from any other host will not
     * render until that host is added here.
     */
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      /*
       * Vercel Blob — where partner-uploaded listing photos live. Wildcarded
       * on the subdomain rather than pinned to this store's id, so
       * recreating the store does not silently stop every uploaded image
       * from rendering.
       */
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
