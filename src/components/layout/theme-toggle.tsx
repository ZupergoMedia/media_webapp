"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme, type ThemePreference } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Light / dark / system picker, matching UserMenu's Popover pattern so it
 * sits naturally beside it in the navbar.
 *
 * The trigger icon reflects the current PREFERENCE, not necessarily what is
 * currently painted — "system" shows the monitor icon regardless of whether
 * the OS happens to be in light or dark right now, since that is the choice
 * the user actually made.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[2];
  const CurrentIcon = current.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Theme: ${current.label}. Click to change.`}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <CurrentIcon className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-40 p-1">
        <div role="radiogroup" aria-label="Theme" className="py-1">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = option.value === preference;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference(option.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted",
                  selected && "font-medium text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {option.label}
                {selected && <Check className="ml-auto size-3.5 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline variant for the mobile drawer, where nesting a Popover inside an
 * already-open drawer would be awkward — three plain buttons in a row
 * instead, matching the drawer's other controls.
 */
export function ThemeToggleInline() {
  const { preference, setPreference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-1">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = option.value === preference;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            onClick={() => setPreference(option.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-control border px-2 py-2 text-xs transition-colors",
              selected
                ? "border-brand bg-brand-subtle font-medium text-brand"
                : "border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
