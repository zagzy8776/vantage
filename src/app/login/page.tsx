"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  fetchCurrentUser,
  login,
  resendVerification,
  resolveSafeRedirect,
} from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = resolveSafeRedirect(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled && user) router.replace(nextPath);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setFormError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(trimmedEmail, password);
      if (!result.ok) {
        if (result.needsVerification && result.email) {
          setUnverifiedEmail(result.email);
          setFormError(null);
          return;
        }
        setFormError(result.error ?? "Invalid email or password.");
        return;
      }
      window.location.assign(nextPath);
    } catch {
      setFormError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCurrentEmail = async () => {
    const targetEmail = (unverifiedEmail ?? email).trim().toLowerCase();
    if (!targetEmail) {
      setFormError("Enter your email address first.");
      return;
    }

    setIsResending(true);
    setFormError(null);
    try {
      const result = await resendVerification(targetEmail);
      if (!result.ok) {
        setFormError(result.error ?? "Could not resend the verification code right now.");
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
    } catch {
      setFormError("Could not resend the verification code right now.");
    } finally {
      setIsResending(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (unverifiedEmail) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground mb-1">Verify your email</h2>
        <p className="text-xs text-subtle">
          Your account is not verified yet. Send a fresh 6-digit verification code to continue.
        </p>
        <p className="text-xs font-mono text-accent">{unverifiedEmail}</p>
        <Button size="lg" isLoading={isResending} onClick={() => void resendCurrentEmail()} className="w-full">
          Send verification code
        </Button>
        <button
          type="button"
          onClick={() => {
            setUnverifiedEmail(null);
            setFormError(null);
          }}
          className="w-full text-[11px] text-subtle hover:text-foreground transition-colors"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        disabled={isSubmitting || isResending}
      />
      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        disabled={isSubmitting || isResending}
      />
      {formError && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2">
            {formError}
          </p>
          {email.trim() && (
            <button
              type="button"
              onClick={() => void resendCurrentEmail()}
              disabled={isResending}
              className="w-full text-xs text-accent hover:underline disabled:opacity-50"
            >
              Didn&apos;t receive a verification code? Send one
            </button>
          )}
        </div>
      )}
      <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
        Sign In
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center">
            <span className="font-mono font-extrabold text-accent text-base">VT</span>
          </div>
          <h1 className="font-extrabold tracking-widest text-foreground font-mono text-xl">VANTAGE</h1>
          <p className="text-[11px] uppercase font-mono tracking-[0.25em] text-accent">Lead Intelligence</p>
        </div>

        <div className="border border-border rounded-lg bg-surface p-6 shadow-sm">
          <div className="grid grid-cols-2 mb-5 border border-border rounded-md overflow-hidden text-xs font-mono uppercase tracking-wide">
            <span className="py-2 text-center bg-accent/10 text-accent font-semibold">Sign In</span>
            <Link
              href="/signup"
              className="py-2 text-center text-subtle hover:text-foreground hover:bg-surface-2/60 transition-colors"
            >
              Sign Up
            </Link>
          </div>

          <h2 className="text-sm font-bold text-foreground mb-1">Sign in to your workspace</h2>
          <p className="text-xs text-subtle mb-5">
            Access is restricted to authorized VANTAGE accounts.
          </p>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 5.373 0 0 12 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[10px] font-mono text-subtle mt-6">
          VANTAGE · Secure session · HttpOnly cookie
        </p>
      </div>
    </main>
  );
}
