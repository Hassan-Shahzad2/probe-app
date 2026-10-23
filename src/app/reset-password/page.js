"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // supabase-js auto-processes the recovery link in the URL (detectSessionInUrl).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") { setReady(true); setChecked(true); }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message || "Could not update password."); return; }
    setDone(true);
    setTimeout(() => router.replace("/login"), 1800);
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
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
          {done ? (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Password updated</h1>
              <p className="mt-3 text-muted">Taking you back to sign in…</p>
            </>
          ) : !checked ? (
            <p className="text-muted">Checking your reset link…</p>
          ) : !ready ? (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Link invalid or expired</h1>
              <p className="mt-3 text-muted">This reset link isn't valid anymore. Please request a new one.</p>
              <Link href="/forgot-password" className="mt-8 inline-block rounded-xl bg-accent px-7 py-3 font-semibold text-accent-ink transition hover:brightness-110">Request new link</Link>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Set a new password</h1>
              <p className="mt-2 text-muted">Choose a strong password you'll remember.</p>
              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">New password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                    className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="••••••••" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink">Confirm password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
                    className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="••••••••" />
                </div>
                {err && <p className="text-sm text-fail">{err}</p>}
                <button type="submit" disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
                  {busy ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}