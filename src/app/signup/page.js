"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";
import PasswordInput from "@/components/PasswordInput";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr("Please enter your full name."); return; }
    if (!email.trim()) { setErr("Please enter your email."); return; }
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    setBusy(false);
    if (error) {
      setErr(error.message || "Could not create your account. Please try again.");
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
        <Link href="/login" className="text-sm text-muted transition hover:text-ink">Sign in</Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
          {sent ? (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Check your email</h1>
              <p className="mt-3 text-muted">We've sent a confirmation link to <b className="text-ink">{email}</b>. Click it to verify your account, then sign in to start your interview. It can take a minute to arrive — check spam too.</p>
              <Link href="/login" className="mt-8 inline-block rounded-xl bg-accent px-7 py-3 font-semibold text-accent-ink transition hover:brightness-110">Go to sign in</Link>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Create your account</h1>
              <p className="mt-2 text-muted">Sign up to take your interview. You'll verify your email, then sign in.</p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                    className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="Your name" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                    className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="you@email.com" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Password</label>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Confirm password</label>
                  <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
                </div>
                {err && <p className="text-sm text-fail">{err}</p>}
                <button type="submit" disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
                  {busy ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-accent transition hover:brightness-110">Sign in</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}