"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    // Always show success (don't reveal whether an email exists).
    if (error && error.message && /rate/i.test(error.message)) {
      setErr("Too many attempts — please wait a minute and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent">
            <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M6.5 11a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
            <path d="M12 16.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <b className="font-serif text-[22px] font-semibold tracking-tight text-ink">Probe</b>
        </Link>
        <Link href="/login" className="text-sm text-muted transition hover:text-ink">Back to sign in</Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
          {sent ? (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Check your email</h1>
              <p className="mt-3 text-muted">If an account exists for <b className="text-ink">{email}</b>, we've sent a link to reset your password. It can take a minute to arrive — check spam too.</p>
              <Link href="/login" className="mt-8 inline-block rounded-xl bg-accent px-7 py-3 font-semibold text-accent-ink transition hover:brightness-110">Back to sign in</Link>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Reset your password</h1>
              <p className="mt-2 text-muted">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="you@company.com" />
                </div>
                {err && <p className="text-sm text-fail">{err}</p>}
                <button type="submit" disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}