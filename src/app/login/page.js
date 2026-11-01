"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";
import PasswordInput from "@/components/PasswordInput";

// Sends a signed-in user to the right place based on their role.
function destFor(role) {
  if (role === "admin") return "/admin";
  if (role === "hr") return "/hr";
  return "/candidate"; // candidates have no special role
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // If already signed in (e.g. just after confirming an email), go straight to the right area.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace(destFor(session.user?.app_metadata?.role));
    })();
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      if (/confirm/i.test(error.message || "")) {
        setErr("Please verify your email first — check your inbox (and spam) for the confirmation link.");
      } else {
        setErr("Invalid email or password.");
      }
      return;
    }
    // One login for everyone — route by the account's role.
    router.replace(destFor(data.user?.app_metadata?.role));
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
        <Link href="/" className="text-sm text-muted transition hover:text-ink">Home</Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
          <h1 className="font-serif text-3xl font-semibold text-ink">Sign in</h1>
          <p className="mt-2 text-muted">Candidates, recruiters, and admins sign in here.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
                className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="you@email.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
            </div>
            {err && <p className="text-sm text-fail">{err}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-accent transition hover:brightness-110">Forgot your password?</Link>
            </div>
          </form>

          <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
            New candidate?{" "}
            <Link href="/signup" className="font-medium text-accent transition hover:brightness-110">Create an account</Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}