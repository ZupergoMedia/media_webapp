"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Signed-in user menu.
 *
 * Destinations are role-dependent: an advertiser has no partner dashboard, and
 * showing them a link to one would lead straight to an access-denied page.
 */
export function UserMenu({
  email,
  name,
  role,
}: {
  email: string;
  name?: string | null;
  role: "ADVERTISER" | "MEDIA_PARTNER" | "ADMIN";
}) {
  const initial = (name ?? email).charAt(0).toUpperCase();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold transition-colors hover:bg-surface-sunken"
        >
          {initial}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-1">
        <div className="border-b border-border px-3 py-2">
          <p className="truncate text-sm font-medium">{name ?? "Account"}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-0.5 text-xs capitalize text-subtle-foreground">
            {role.replace("_", " ").toLowerCase()}
          </p>
        </div>

        <nav className="py-1">
          {(role === "MEDIA_PARTNER" || role === "ADMIN") && (
            <MenuLink href="/owner">Partner dashboard</MenuLink>
          )}
          {role === "ADMIN" && <MenuLink href="/admin">Admin</MenuLink>}
          <MenuLink href="/explore">Explore inventory</MenuLink>
        </nav>

        <div className="border-t border-border p-1">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
    >
      <User className="size-4 opacity-0" aria-hidden="true" />
      {children}
    </Link>
  );
}
