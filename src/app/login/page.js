"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";

function Bars({ n = 4 }) {
  const hs = [10, 16, 22, 14, 18];
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ height: hs[i % hs.length] }} className="w-[3px] rounded-full bg-accent" />
      ))}
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setErr("Invalid email or password."); setBusy(false); return; }
    const role = data.user?.app_metadata?.role;
    router.replace(role === "admin" ? "/admin" : "/hr");
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Bars />
          <b className="font-serif text-[22px] font-semibold tracking-tight text-ink">Probe</b>
        </Link>
        <Link href="/" className="text-sm text-muted transition hover:text-ink">Home</Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
          <h1 className="font-serif text-3xl font-semibold text-ink">Sign in</h1>
          <p className="mt-2 text-muted">For recruiters and administrators.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
                className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="you@company.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="••••••••" />
            </div>
            {err && <p className="text-sm text-fail">{err}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-accent transition hover:brightness-110">Forgot your password?</Link>
            </div>
          </form>
        </motion.div>
      </div>
    </main>
  );
}