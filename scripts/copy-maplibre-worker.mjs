/**
 * Copies MapLibre GL's worker script (and its sibling shared chunk) into
 * public/, so it can be served as a plain static file and loaded via
 * `setWorkerUrl()` in src/lib/map/config.ts.
 *
 * Why this exists: MapLibre GL v6 ships its worker as a separate ES module
 * (dist/maplibre-gl-worker.mjs) rather than bundling it inline, and expects
 * the app to resolve a URL to it at runtime. Turbopack's asset handling
 * turns a bundler-relative `new URL(..., import.meta.url)` reference into a
 * hashed asset without carrying along the worker's own import of
 * maplibre-gl-shared.mjs, so the worker fails to load — in production this
 * surfaced as "Loading Worker from https://<site>/ was blocked (disallowed
 * MIME type text/html)", because the broken resolution fell back to the
 * page's own URL. Serving both files from public/ untouched by any bundler
 * sidesteps the problem entirely.
 *
 * Run before both `next dev` and `next build` — see the predev/prebuild
 * scripts in package.json. Plain Node, no TypeScript: this must run before
 * any build tooling is guaranteed available.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const SOURCE_DIR = join(projectRoot, "node_modules", "maplibre-gl", "dist");
const DEST_DIR = join(projectRoot, "public", "maplibre");

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(DEST_DIR)) {
  mkdirSync(DEST_DIR, { recursive: true });
}

for (const file of FILES) {
  const source = join(SOURCE_DIR, file);
  const dest = join(DEST_DIR, file);

  if (!existsSync(source)) {
    console.error(`[copy-maplibre-worker] Missing ${source} — has maplibre-gl been installed?`);
    process.exit(1);
  }

  copyFileSync(source, dest);
}

console.log(`[copy-maplibre-worker] Copied ${FILES.join(", ")} to public/maplibre/`);
