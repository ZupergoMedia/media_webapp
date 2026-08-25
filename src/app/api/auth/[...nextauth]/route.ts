/**
 * Auth.js route handlers.
 *
 * Serves sign-in, sign-out, callback and session endpoints under /api/auth/*.
 */
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;
