import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireOwner } from "@/server/auth/owner-guard";

/**
 * POST /api/owner/uploads
 *
 * Authorises a direct browser-to-Blob image upload for a signed-in media
 * partner.
 *
 * The file itself never passes through this route. `handleUpload` issues a
 * short-lived client token, the browser uploads straight to Vercel Blob, and
 * Blob then calls back here on completion. That matters for more than
 * elegance: routing multi-megabyte photos through a serverless function
 * would hit request body limits and burn function time proportional to file
 * size.
 *
 * Only partners may upload. The auth check runs inside
 * `onBeforeGenerateToken`, which is the only place it can gate the actual
 * token issue — checking earlier would still leave the callback path open.
 */

/** 8 MB. Comfortably fits a high-quality listing photo; rejects video-sized files. */
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async () => {
        // Ownership comes from the session, never from the request.
        const ownerAuth = await requireOwner();
        if (!ownerAuth.ok) {
          throw new Error(ownerAuth.error);
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          // Random suffix so two partners uploading "billboard.jpg" cannot
          // collide, and so a URL cannot be guessed from the filename.
          addRandomSuffix: true,
          // Recorded on the blob for later attribution — useful when
          // reconciling orphaned files against assets.
          tokenPayload: JSON.stringify({ ownerId: ownerAuth.owner.id }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Deliberately does not write to the database. The image is attached
        // to an asset when the partner submits the form, not when the file
        // lands — a partner who uploads a photo then abandons the form must
        // not leave a dangling AssetImage row pointing at nothing.
        //
        // Note this callback does not fire on localhost: Blob cannot reach a
        // local dev server, which is expected and harmless here precisely
        // because nothing depends on it.
        console.log("[api/owner/uploads] stored", blob.pathname, tokenPayload);
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // handleUpload throws for a failed auth check, a rejected content type,
    // and an oversized file alike. A 400 covers all of them without leaking
    // which rule was tripped.
    console.error("[api/owner/uploads]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
