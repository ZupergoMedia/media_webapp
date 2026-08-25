import { getOwnerForUser } from "@/server/services/owner-service";
import { requireUser } from "./index";

/**
 * Resolves the media owner account for the signed-in user.
 *
 * The owner record is derived from the session, never from a caller-supplied
 * id. That distinction is the whole security boundary here: accepting an
 * ownerId from the request would let anyone create, pause or archive listings
 * under someone else's account.
 *
 * Admins are deliberately *not* auto-granted an owner identity. An admin acting
 * on inventory should do so through the admin tools, which record who acted;
 * silently borrowing an owner account would make that audit trail wrong.
 */
export type OwnerResult =
  | { ok: true; owner: NonNullable<Awaited<ReturnType<typeof getOwnerForUser>>>; userId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requireOwner(): Promise<OwnerResult> {
  const auth = await requireUser(["MEDIA_PARTNER", "ADMIN"]);

  if (!auth.ok) {
    return auth.reason === "unauthenticated"
      ? { ok: false, status: 401, error: "Sign in to continue." }
      : { ok: false, status: 403, error: "This area is for media owners." };
  }

  const owner = await getOwnerForUser(auth.user.id);

  if (!owner) {
    return {
      ok: false,
      status: 403,
      error:
        "Your account is not registered as a media owner yet. Create a company profile to list inventory.",
    };
  }

  return { ok: true, owner, userId: auth.user.id };
}
