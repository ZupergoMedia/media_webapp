import { ImageResponse } from "next/og";

/**
 * Apple touch icon — the same roadside-hoarding mark as `icon.svg`, as a PNG.
 *
 * It has to be generated rather than shipped as an SVG: the `apple-icon` file
 * convention accepts only .jpg/.jpeg/.png, so an `apple-icon.svg` is ignored —
 * it 404s and silently emits no <link rel="apple-touch-icon"> at all. `icon`
 * does accept .svg, which is why the favicon stays a hand-written SVG and only
 * this one is code-generated.
 *
 * Built from divs, not <svg> shapes, because ImageResponse renders through
 * Satori — a flexbox subset of CSS with no SVG element support. The splayed
 * legs are therefore rotated divs rather than <path>.
 *
 * Two differences from the favicon, both because iOS composites this
 * differently:
 *   - square corners, since iOS applies its own mask (rounding here would be
 *     clipped twice and fringe at the corners);
 *   - the mark sits at ~70% of the canvas rather than filling it, because a
 *     home-screen icon is read far larger than a 16px tab icon, where a
 *     full-bleed glyph looks cramped beside Apple's own icons.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Hard-coded: this runs at build time with no document to inherit from.
// Keep in sync with `--brand` and `--surface` in globals.css.
const BRAND = "#2f43c4";
const SURFACE = "#fffefb";

/**
 * One leg of the hoarding. `dir` is -1 for the left leg, 1 for the right.
 *
 * The rotation is NEGATIVE `dir`: rotating about the top edge, a positive
 * angle swings the bottom of the leg anticlockwise, i.e. to the LEFT. So the
 * right-hand leg needs a negative angle to kick its foot outward. Getting this
 * backwards produces a narrow converging V — a lectern, not a hoarding.
 */
function Leg({ dir }: { dir: 1 | -1 }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 112,
        left: 90 + dir * 22 - 6,
        width: 12,
        height: 54,
        background: SURFACE,
        opacity: 0.92,
        transform: `rotate(${-dir * 17}deg)`,
        transformOrigin: "top center",
      }}
    />
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: BRAND,
          display: "flex",
        }}
      >
        <Leg dir={-1} />
        <Leg dir={1} />

        {/* The board, drawn after the legs so it covers where they meet it. */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 22,
            width: 136,
            height: 72,
            background: SURFACE,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            paddingLeft: 21,
          }}
        >
          {/* Single copy bar, matching the favicon. */}
          <div
            style={{
              width: 83,
              height: 21,
              borderRadius: 10.5,
              background: BRAND,
              opacity: 0.85,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
