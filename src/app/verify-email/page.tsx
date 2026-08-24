"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { verifyEmail, resendVerification } from "@/lib/auth-client";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

const CODE_LENGTH = 6;
const INITIAL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const initialTestCode = searchParams.get("test") ?? "";

  const [testCode, setTestCode] = useState(initialTestCode);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const submitCode = useCallback(async (code: string) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const result = await verifyEmail(email, code);
      if (!result.ok) {
        setFormError(result.error ?? "Invalid or expired code.");
        setDigits(Array(CODE_LENGTH).fill(""));
        inputsRef.current[0]?.focus();
        return;
      }
      router.push("/investigations");
    } catch {
      setFormError("Verification is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [email, router]);

  const setDigitAt = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      for (let offset = 0; offset < clean.length && index + offset < CODE_LENGTH; offset += 1) next[index + offset] = clean[offset];
      const filled = next.join("");
      const focusTarget = Math.min(index + clean.length, CODE_LENGTH - 1);
      requestAnimationFrame(() => inputsRef.current[focusTarget]?.focus());
      if (filled.length === CODE_LENGTH && !filled.includes("")) void submitCode(filled);
      return next;
    });
  };

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    if (pasted.length === CODE_LENGTH) void submitCode(pasted);
    else inputsRef.current[pasted.length]?.focus();
  };

  const handleResend = async () => {
    setResending(true);
    setFormError(null);
    try {
      const result = await resendVerification(email);
      if (!result.ok) {
        setFormError(result.error ?? "Could not resend the code right now.");
        return;
      }
      setTestCode(result.testOnlyCode ?? "");
      setSecondsLeft(INITIAL_SECONDS);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(""));
    } catch {
      setFormError("Could not resend the code right now.");
    } finally {
      setResending(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center"><span className="font-mono font-extrabold text-accent text-base">VT</span></div>
          <h1 className="font-extrabold tracking-widest text-foreground font-mono text-xl">VANTAGE</h1>
          <p className="text-[11px] uppercase font-mono tracking-[0.25em] text-accent">Lead Intelligence</p>
        </div>

        <div className="border border-border rounded-lg bg-surface p-6 shadow-sm">
          <h2 className="text-base font-bold text-foreground mb-1">Check your email</h2>
          <p className="text-xs text-subtle mb-1">We sent a 6-digit verification code to:</p>
          <p className="text-xs font-mono font-semibold text-accent mb-5">{maskEmail(email)}</p>

          {testCode && (
            <p className="text-xs text-warning border border-warning/30 bg-warning/5 rounded-md px-3 py-2 mb-4">
              VANTAGE test mode: code <span className="font-mono font-bold">{testCode}</span>
            </p>
          )}

          <div className="flex gap-2 justify-center mb-4" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input key={index} ref={(el) => { inputsRef.current[index] = el; }} type="text" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={CODE_LENGTH} value={digit} onChange={(e) => setDigitAt(index, e.target.value)} onKeyDown={(e) => handleKeyDown(index)(e)} disabled={isSubmitting || secondsLeft <= 0} aria-label={`Digit ${index + 1}`} className="w-10 h-12 sm:w-11 sm:h-13 text-center text-lg font-mono font-bold text-foreground bg-surface-2 border border-border rounded-md focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 disabled:opacity-50" />
            ))}
          </div>

          {secondsLeft > 0 ? (
            <p className="text-[11px] text-subtle text-center mb-4 font-mono">Code expires in <span className="text-accent font-bold tabular-nums">{mm}:{ss}</span></p>
          ) : (
            <p className="text-xs text-danger text-center mb-4" role="alert">This code has expired. Request a new one below.</p>
          )}

          {formError && <p role="alert" className="text-xs text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2 mb-4">{formError}</p>}

          <Button size="lg" isLoading={isSubmitting} disabled={digits.some((d) => !d)} onClick={() => void submitCode(digits.join(""))} className="w-full mb-3">Verify Email</Button>
          <Button variant="ghost" size="sm" isLoading={resending} disabled={resendIn > 0} onClick={() => void handleResend()} className="w-full">{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</Button>
        </div>

        <p className="text-center text-[11px] text-subtle mt-4">Wrong email? <Link href="/signup" className="text-accent hover:underline">Sign up again</Link></p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6"><svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div>}>
      <VerifyForm />
    </Suspense>
  );
}
