"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/assets", label: "My assets" },
  { href: "/owner/requests", label: "Requests" },
  { href: "/owner/sales", label: "My assets for sale" },
] as const;

/**
 * Owner section navigation, mirroring admin-nav.tsx.
 *
 * Added now rather than a full owner/layout.tsx: the repo has exactly one
 * layout today, and adding a section layout is a bigger structural change
 * than this pass needs — a shared nav component rendered per page achieves
 * the same visible result without touching that convention.
 */
export function OwnerNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Owner sections"
      className="my-5 flex gap-1 overflow-x-auto border-b border-border"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/owner"
            ? pathname === "/owner"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
