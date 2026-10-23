"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRequireRole } from "@/lib/useAuth";

export default function AdminPage() {
  const router = useRouter();
  const auth = useRequireRole("admin");

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [numQ, setNumQ] = useState(3);
  const [mins, setMins] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setLoading(true);
    setListErr("");
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      const d = await r.json();
      setJobs(Array.isArray(d) ? d : []);
      if (!Array.isArray(d)) setListErr("Could not load roles.");
    } catch {
      setListErr("Could not load roles.");
    }
    setLoading(false);
  }

  useEffect(() => { if (auth.status === "ready") load(); }, [auth.status]);

  function resetForm() {
    setEditingId(null); setTitle(""); setDescription(""); setNumQ(3); setMins(""); setFormErr("");
  }

  function editJob(j) {
    setEditingId(j.id);
    setTitle(j.title || "");
    setDescription(j.description || "");
    setNumQ(j.num_questions ?? 3);
    setMins(j.time_limit_minutes ?? "");
    setFormErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveJob(e) {
    e.preventDefault();
    setFormErr("");
    if (!title.trim()) { setFormErr("Title is required."); return; }
    setBusy(true);
    const t = await token();
    const payload = { title, description, num_questions: numQ, time_limit_minutes: mins };
    const r = await fetch("/api/admin-jobs", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setFormErr(d.error || "Could not save. Please try again.");
      return;
    }
    const wasEdit = !!editingId;
    resetForm();
    load();
    setOkMsg(wasEdit ? "Role updated." : "Role added.");
    setTimeout(() => setOkMsg(""), 3000);
  }

  async function deleteJob(j) {
    if (!window.confirm(`Delete "${j.title}"? This cannot be undone.`)) return;
    const t = await token();
    const r = await fetch(`/api/admin-jobs?id=${encodeURIComponent(j.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Could not delete this role (it may have interviews linked to it).");
      return;
    }
    if (editingId === j.id) resetForm();
    load();
    setOkMsg("Role deleted.");
    setTimeout(() => setOkMsg(""), 3000);
  }

  if (auth.status === "denied") {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-ink">Access denied</h1>
          <p className="mt-2 text-muted">This is the admin area. Your account doesn't have admin access.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => router.replace(auth.role === "hr" ? "/hr" : "/login")} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110">Go to your area</button>
            <button onClick={logout} className="rounded-xl border border-line px-5 py-2.5 font-medium text-ink transition hover:border-accent">Log out</button>
          </div>
        </div>
      </main>
    );
  }

  if (auth.status !== "ready") {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Checking access…</p>
      </main>
    );
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
          <span className="ml-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Admin</span>
        </Link>
        <button onClick={logout} className="text-sm text-muted transition hover:text-ink">Log out</button>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-6 pb-16">
        <h1 className="font-serif text-3xl font-semibold text-ink">Roles</h1>
        <p className="mt-1 text-muted">Create and manage the roles candidates can interview for.</p>

        {okMsg && (
          <div className="mt-4 rounded-xl border border-pass/30 bg-pass/10 px-4 py-2.5 text-sm font-medium text-pass">{okMsg}</div>
        )}

        <form onSubmit={saveJob} className="glass mt-6 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-ink">{editingId ? "Edit role" : "Add a role"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="text-sm text-muted transition hover:text-ink">Cancel edit</button>}
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Role title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="e.g. Frontend Engineer" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="What the role involves — this guides the interview questions." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Number of questions</label>
                <input type="number" min={1} max={15} value={numQ} onChange={(e) => setNumQ(e.target.value)} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Time limit (minutes)</label>
                <input type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="Leave blank for auto" />
                <p className="mt-1 text-xs text-faint">Blank = auto (about 2 min per question).</p>
              </div>
            </div>
            {formErr && <p className="text-sm text-fail">{formErr}</p>}
            <div>
              <button type="submit" disabled={busy} className="rounded-xl bg-accent px-6 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
                {busy ? "Saving…" : editingId ? "Save changes" : "Add role"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-8">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Existing roles</h2>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : listErr ? (
            <p className="text-fail">{listErr}</p>
          ) : jobs.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-muted">No roles yet. Add your first one above.</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={j.id} className="glass flex items-start gap-4 rounded-2xl p-5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{j.title}</div>
                    {j.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{j.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
                      <span>{j.num_questions ?? 3} questions</span>
                      <span>{j.time_limit_minutes ? `${j.time_limit_minutes} min limit` : "Auto time limit"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => editJob(j)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent">Edit</button>
                    <button onClick={() => deleteJob(j)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fail transition hover:border-fail">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}