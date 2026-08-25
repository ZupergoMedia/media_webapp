"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Building2,
  Home,
  Inbox,
  Plus,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  Search,
  ShieldCheck,
  Store,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggleInline } from "./theme-toggle";
import { cn } from "@/lib/utils";

/**
 * The single navigation menu, at every breakpoint.
 *
 * Presentation differs by width but the contents do not: a right-hand drawer
 * below `md`, a floating dropdown panel above it. One source of navigation
 * means a destination cannot exist on one device and go missing on another —
 * which is exactly what happened when the desktop bar simply hid its links on
 * small screens.
 *
 * The bar keeps Explore, How it works and About us on desktop. Everything else
 * — audience pages, map view, account destinations — lives here, and the bar
 * links are duplicated inside so nothing disappears below `md`.
 */

interface MenuUser {
  email: string;
  name?: string | null;
  role: "ADVERTISER" | "MEDIA_PARTNER" | "ADMIN";
}

export function NavMenu({
  user,
  isPartner = false,
}: {
  user: MenuUser | null;
  /** Whether the signed-in user has a media partner profile. */
  isPartner?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger so keyboard users are not stranded at
        // the top of the document.
        triggerRef.current?.focus();
      }
    };

    /**
     * Dismiss the desktop dropdown on an outside click.
     *
     * The mobile drawer has its own scrim, but the floating panel does not —
     * without this it would stay open while the user interacts with the page
     * behind it.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Body scroll is locked only for the drawer. Locking it for the desktop
  // dropdown would shift the whole page as the scrollbar disappears.
  useEffect(() => {
    if (!open) return;
    const isDrawer = window.matchMedia("(max-width: 767px)").matches;
    if (!isDrawer) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const sections = (
    <>
      {/*
        Explore, How it works and About us also sit in the bar on desktop, but
        the bar hides them below `md` — so they must remain here or phone users
        lose them entirely.
      */}
      <Section label="Browse">
        <Item href="/" icon={Home} onNavigate={close}>
          Home
        </Item>
        <Item href="/explore" icon={Search} onNavigate={close}>
          Explore sites
        </Item>
        <Item href="/map" icon={MapIcon} onNavigate={close}>
          Map
        </Item>
        <Item href="/assets-for-sale" icon={Tag} onNavigate={close}>
          Assets for sale
        </Item>
        <Item href="/how-it-works" icon={ShieldCheck} onNavigate={close}>
          How it works
        </Item>
        <Item href="/about" icon={Building2} onNavigate={close}>
          About us
        </Item>
      </Section>

      <Section label="Theme">
        <ThemeToggleInline />
      </Section>

      {/*
        Shown to everyone who is not already a partner. A partner sees their
        dashboard instead — see the account section below.
      */}
      {!isPartner && (
        <Section label="Who it&rsquo;s for">
          <Item href="/for-advertisers" icon={Megaphone} onNavigate={close}>
            For advertisers
          </Item>
          <Item href="/for-media-partners" icon={Store} onNavigate={close}>
            For media partners
          </Item>
        </Section>
      )}

      {user && (
        <Section label="Your account">
          {isPartner && (
            <>
              <Item href="/owner" icon={LayoutDashboard} onNavigate={close}>
                Partner dashboard
              </Item>
              <Item href="/owner/assets" icon={Store} onNavigate={close}>
                My listings
              </Item>
              <Item href="/owner/requests" icon={Inbox} onNavigate={close}>
                Requests
              </Item>
              <Item href="/owner/assets/new" icon={Plus} onNavigate={close}>
                List new media
              </Item>
              <Item href="/owner/sales" icon={Tag} onNavigate={close}>
                My assets for sale
              </Item>
            </>
          )}
          {user.role === "ADMIN" && (
            <Item href="/admin" icon={ShieldCheck} onNavigate={close}>
              Admin
            </Item>
          )}
        </Section>
      )}
    </>
  );

  const accountFooter = user ? (
    <>
      <div className="px-3 pb-2">
        <p className="truncate text-sm font-medium">{user.name ?? "Account"}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <p className="mt-0.5 text-xs capitalize text-subtle-foreground">
          {user.role.replace("_", " ").toLowerCase()}
        </p>
      </div>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </>
  ) : (
    <div className="flex flex-col gap-2">
      <Button asChild variant="secondary" className="w-full">
        <Link href="/signin" onClick={close}>
          Sign in
        </Link>
      </Button>
      <Button asChild className="w-full">
        <Link href="/partners/join" onClick={close}>
          Become a media partner
        </Link>
      </Button>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="primary-nav-menu"
        className={cn(
          "flex items-center gap-2 rounded-control border px-3 py-2 text-sm font-medium transition-colors",
          open
            ? "border-border-strong bg-surface-muted"
            : "border-border hover:bg-surface-muted",
        )}
      >
        {open ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <Menu className="size-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">More</span>
      </button>

      {/* Drawer — below md */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
          />

          <div
            id="primary-nav-menu"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-surface shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="font-semibold tracking-tight">More</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">{sections}</nav>

            <div className="shrink-0 border-t border-border p-3">
              {accountFooter}
            </div>
          </div>
        </div>
      )}

      {/* Floating dropdown — md and up */}
      {open && (
        <div
          id="primary-nav-menu"
          role="menu"
          aria-label="Navigation"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 hidden w-72 overflow-hidden rounded-card border border-border bg-surface shadow-xl md:block"
        >
          <nav className="max-h-[70vh] overflow-y-auto p-3">{sections}</nav>
          <div className="border-t border-border p-3">{accountFooter}</div>
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Item({
  href,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  // Compare paths only — a query string such as ?view=map should not make an
  // entry look inactive while its page is open.
  const active = pathname === href.split("?")[0];

  return (
    <Link
      href={href}
      role="menuitem"
      // Closed at the point of intent rather than by an effect watching the
      // pathname, which would also fail to close when the tapped link is the
      // page already open.
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-brand-subtle font-medium text-brand"
          : "text-foreground hover:bg-surface-muted",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}
