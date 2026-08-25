import Link from "next/link";
import { LayoutDashboard, Megaphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth";
import { getOwnerForUser } from "@/server/services/owner-service";
import { UserMenu } from "./user-menu";
import { NavMenu } from "./nav-menu";
import { ThemeToggle } from "./theme-toggle";

/**
 * Primary navigation.
 *
 * A server component so the session is read during render — no signed-out flash
 * before the menu appears, and no client-side session fetch on every page.
 *
 * The right-hand side changes by who is looking:
 *
 *   signed out           two audience entry points, so a visitor can
 *                        self-select before being asked to sign in
 *   signed-in partner    a single dashboard button — someone who has already
 *                        joined does not need to be sold on joining
 *   signed-in advertiser the partner entry point stays, since an advertiser may
 *                        also have media to list
 *
 * There is no "Get started" button: it competed with the audience links without
 * saying where it went.
 */
export async function Navbar() {
  const user = await getCurrentUser();

  // Only a user with a partner profile gets the dashboard shortcut. Showing it
  // to an advertiser would lead straight to an access notice.
  const partner = user ? await getOwnerForUser(user.id) : null;

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-surface/95 backdrop-blur">
      <nav
        className="mx-auto flex h-full max-w-[1600px] items-center gap-3 px-4"
        aria-label="Main"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="text-lg">ZuperGo Media</span>
        </Link>

        <div className="ml-4 hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <Link href="/explore" className="transition-colors hover:text-foreground">
            Explore sites
          </Link>
          <Link href="/map" className="transition-colors hover:text-foreground">
            Map
          </Link>
          <Link
            href="/assets-for-sale"
            className="transition-colors hover:text-foreground"
          >
            Assets for sale
          </Link>
          <Link
            href="/how-it-works"
            className="transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link href="/blog" className="transition-colors hover:text-foreground">
            Blog
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {partner ? (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/owner">
                <LayoutDashboard className="size-4" />
                Partner dashboard
              </Link>
            </Button>
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/for-advertisers"
                className="flex items-center gap-1.5 rounded-control px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <Megaphone className="size-4" aria-hidden="true" />
                For advertisers
              </Link>
              <Link
                href="/for-media-partners"
                className="flex items-center gap-1.5 rounded-control px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <Store className="size-4" aria-hidden="true" />
                For media partners
              </Link>
            </div>
          )}

          {/*
            Hidden below sm — NavMenu's drawer already carries a Theme
            section (ThemeToggleInline), and showing both crowds the bar on
            a phone-width screen alongside the account avatar and hamburger.
          */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {user ? (
            // Hidden below sm — the drawer's account footer already shows
            // name/email/role and sign-out, so a phone-width screen would
            // otherwise carry two separate account entry points at once.
            <div className="hidden sm:block">
              <UserMenu email={user.email} name={user.name} role={user.role} />
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <Link href="/signin">Sign in</Link>
            </Button>
          )}

          <NavMenu
            user={
              user
                ? { email: user.email, name: user.name, role: user.role }
                : null
            }
            isPartner={Boolean(partner)}
          />
        </div>
      </nav>
    </header>
  );
}
