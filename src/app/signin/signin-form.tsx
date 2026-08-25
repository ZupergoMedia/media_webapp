"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Credentials sign-in.
 *
 * Failures are reported with one generic message regardless of cause. Saying
 * "no account with that email" would let anyone enumerate registered addresses,
 * so the wording never distinguishes an unknown user from a wrong password —
 * matching the server, which returns null for both.
 */
export function SignInForm({ demoHint }: { demoHint?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /**
   * Where to land after signing in.
   *
   * Only same-origin relative paths are accepted. Echoing an arbitrary
   * `callbackUrl` back into a redirect is a classic open-redirect: an attacker
   * sends /signin?callbackUrl=https://evil.example and the victim is bounced
   * off-site immediately after authenticating.
   */
  const rawCallback = params.get("callbackUrl");
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("That email and password combination is not recognised.");
        return;
      }

      router.push(callbackUrl);
      // Refresh so server components pick up the new session immediately.
      router.refresh();
    } catch {
      setError("Could not sign in right now. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-subtle p-3"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-danger"
            aria-hidden="true"
          />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          aria-invalid={Boolean(error)}
          className={cn(error && "border-danger")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-danger")}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      {demoHint && (
        <div className="rounded-card border border-border bg-surface-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo accounts</p>
          <p className="mt-1">
            advertiser@demo.zupergo.test · owner.skyline@demo.zupergo.test ·
            admin@demo.zupergo.test
          </p>
          <p className="mt-1">
            Password: <code className="font-mono">{demoHint}</code>
          </p>
        </div>
      )}
    </form>
  );
}
