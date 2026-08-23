"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signUp } from "@/lib/auth-client";

function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setFormError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      if (!result.ok) {
        setFormError(result.error ?? "Please check your details and try again.");
        return;
      }
      const params = new URLSearchParams({ email: email.trim() });
      if (result.devOnlyCode) params.set("dev", result.devOnlyCode);
      router.push(`/verify-email?${params.toString()}`);

    } catch {
      setFormError("Sign up is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Link href="/login" className="py-2 text-center text-subtle hover:text-foreground hover:bg-surface-2/60 transition-colors">
              Sign In
            </Link>
            <span className="py-2 text-center bg-accent/10 text-accent font-semibold border-l border-border">
              Sign Up
            </span>
          </div>

          <h2 className="text-sm font-bold text-foreground mb-1">Create your workspace</h2>
          <p className="text-xs text-subtle mb-5">
            We&apos;ll email you a verification code to activate your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input label="Full name" type="text" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Founder" maxLength={100} disabled={isSubmitting} />
            <Input label="Email" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" disabled={isSubmitting} />
            <Input label="Password" type="password" name="new-password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" hint="At least 8 characters with upper, lower and a number." disabled={isSubmitting} />
            <Input label="Confirm password" type="password" name="confirm-password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" error={confirmPassword.length > 0 && password !== confirmPassword ? "Passwords do not match." : undefined} disabled={isSubmitting} />
            {formError && (
              <p role="alert" className="text-xs text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
            <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
              Create Account
            </Button>
          </form>

          <p className="text-[11px] text-subtle mt-4 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[10px] font-mono text-subtle mt-6">
          VANTAGE · Secure session · HttpOnly cookie
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
