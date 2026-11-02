"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabaseClient";
import { useRequireRole } from "@/lib/useAuth";
import PasswordInput from "@/components/PasswordInput";

const PASS_MARK = 70;

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

function getReport(iv) {
  let r = iv.interview_reports;
  if (Array.isArray(r)) r = r.length ? r[0] : null;
  return r || null;
}
function num(v) { return v == null || v === "" ? null : Number(v); }

function Chip({ ok }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail"}`}>
      {ok ? "Qualified" : "Not qualified"}
    </span>
  );
}

function StatTile({ label, value, foot, tone }) {
  const tones = {
    all: "text-accent",
    pass: "text-pass",
    fail: "text-fail",
    pend: "text-pend",
  };
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tnum ${tones[tone] || "text-ink"}`}>{value}</div>
      <div className="mt-1 text-xs text-faint">{foot}</div>
    </div>
  );
}

function Donut({ pass, fail, pend }) {
  const total = pass + fail + pend || 1;
  const pD = (pass / total) * 360;
  const fD = (fail / total) * 360;
  const bg = `conic-gradient(var(--pass) 0 ${pD}deg, var(--fail) ${pD}deg ${pD + fD}deg, var(--pend) ${pD + fD}deg 360deg)`;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <div className="h-full w-full rounded-full" style={{ background: bg }} />
      <div className="absolute inset-[18%] grid place-items-center rounded-full bg-card">
        <div className="text-center">
          <div className="text-2xl font-semibold tnum text-ink">{pass + fail + pend}</div>
          <div className="text-[10px] text-faint">candidates</div>
        </div>
      </div>
    </div>
  );
}

function Bars({ avg }) {
  const rows = [
    ["Technical", avg.tech],
    ["Communication", avg.comm],
    ["Problem solving", avg.ps],
  ];
  return (
    <div className="flex-1 space-y-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{k}</span>
            <span className="font-semibold tnum text-ink">{Math.round(v)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-line">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright"
              initial={{ width: 0 }} animate={{ width: `${Math.min(100, v)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Recording({ interviewId }) {
  const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [camErr, setCamErr] = useState(false);
  const [scrErr, setScrErr] = useState(false);
  if (!SB || !interviewId || (camErr && scrErr)) return null;
  const url = (kind) => `${SB}/storage/v1/object/public/recordings/${interviewId}/${kind}.webm`;
  return (
    <div className="mt-3">
      <div className="mb-2 text-xs font-medium text-faint">Proctoring recording</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!camErr && (
          <div className="rounded-xl border border-line bg-card2 p-2">
            <div className="mb-1.5 px-1 text-xs text-muted">Camera</div>
            <video src={url("camera")} controls playsInline onError={() => setCamErr(true)} className="w-full rounded-lg bg-black" />
          </div>
        )}
        {!scrErr && (
          <div className="rounded-xl border border-line bg-card2 p-2">
            <div className="mb-1.5 px-1 text-xs text-muted">Screen</div>
            <video src={url("screen")} controls playsInline onError={() => setScrErr(true)} className="w-full rounded-lg bg-black" />
          </div>
        )}
      </div>
    </div>
  );
}

// Modal: asks the HR to re-enter their password before a destructive action.
function PasswordConfirm({ label, note, busy, err, onCancel, onConfirm }) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div className="glass w-full max-w-sm rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl font-semibold text-ink">{label}</h3>
        {note && <p className="mt-2 text-sm text-muted">{note}</p>}
        <label className="mb-1 mt-4 block text-sm font-medium text-ink">Confirm your password</label>
        <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder="Your account password" />
        {err && <p className="mt-2 text-sm text-fail">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={busy} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-60">Cancel</button>
          <button onClick={() => onConfirm(pw)} disabled={busy || !pw} className="rounded-xl bg-fail px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateCard({ iv, archived, onRemove, onRestore }) {
  const [open, setOpen] = useState(false);
  const [dl, setDl] = useState(false);
  const [dlErr, setDlErr] = useState("");
  const [restoring, setRestoring] = useState(false);
  const report = getReport(iv);
  const turns = iv.interview_turns || [];
  const name = iv.candidates?.name || "Unknown candidate";
  const email = iv.candidates?.email || "";
  const job = iv.jobs?.title || "General position";
  const cv = iv.candidates?.resume_text || "";
  const candId = iv.candidates?.id || null;
  const resumeUrl = iv.candidates?.resume_url || "";
  // A real stored file exists only for uploads made after we started saving the
  // PDF. Older rows carry the placeholder "uploaded" (or nothing) — no file.
  const hasFile = !!candId && !!resumeUrl && resumeUrl !== "uploaded";
  const overall = report ? num(report.overall_score) : null;
  const good = overall != null && overall >= PASS_MARK;
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  async function downloadCV() {
    if (!candId) return;
    setDl(true);
    setDlErr("");
    try {
      const r = await fetch("/api/resume-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candId, filename: name }),
      });
      const d = await r.json();
      if (d && d.url) {
        const a = document.createElement("a");
        a.href = d.url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        setDlErr(d && d.error ? d.error : "Could not download the CV.");
      }
    } catch {
      setDlErr("Could not download the CV.");
    }
    setDl(false);
  }

  async function restore() {
    setRestoring(true);
    await onRestore(iv.id);
    setRestoring(false);
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 p-5 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{name}</span>
            {archived && <span className="shrink-0 rounded-md bg-line px-1.5 py-0.5 text-[10px] font-medium text-faint">Archived</span>}
          </div>
          <div className="truncate text-sm text-muted">{email} · {job}</div>
        </div>
        <div className="text-right">
          {overall != null ? (
            <div className="text-xl font-semibold tnum text-ink">{Math.round(overall)}<span className="text-sm text-faint">/100</span></div>
          ) : (
            <div className="text-sm text-pend">In progress</div>
          )}
          {report && <div className="mt-1">{<Chip ok={good} />}</div>}
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" {...svg} className={`shrink-0 text-faint transition ${open ? "rotate-90" : ""}`}><path d="M9 6l6 6-6 6" /></svg>
      </button>

      {open && (
        <div className="border-t border-line px-5 pb-5 pt-4">
          {report && (
            <div className="rounded-xl border border-line bg-card2 p-4">
              <div className="text-xs font-medium text-faint">AI assessment summary</div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{report.summary || "—"}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                <span>Recommendation: <b className="text-ink">{report.recommendation || "—"}</b></span>
                <span>Pass mark: <b className="text-ink">{PASS_MARK}/100</b></span>
                <span>Result: <b className={good ? "text-pass" : "text-fail"}>{good ? "Qualified" : "Not qualified"}</b></span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[["Technical", report.technical_score], ["Communication", report.communication_score], ["Problem solving", report.problem_solving_score]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-card p-3 text-center">
                    <div className="text-lg font-semibold tnum text-ink">{v ?? "—"}<span className="text-xs text-faint">/100</span></div>
                    <div className="text-xs text-muted">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {hasFile && (
              <button onClick={downloadCV} disabled={dl}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-card2 px-3 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-60">
                <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
                {dl ? "Preparing…" : "Download CV (PDF)"}
              </button>
            )}
            {archived ? (
              <button onClick={restore} disabled={restoring}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-card2 px-3 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-60">
                <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" /></svg>
                {restoring ? "Restoring…" : "Restore"}
              </button>
            ) : (
              <button onClick={() => onRemove(iv.id, name)}
                className="inline-flex items-center gap-2 rounded-lg border border-fail/40 px-3 py-2 text-sm font-medium text-fail transition hover:bg-fail/10">
                <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                Remove application
              </button>
            )}
            {dlErr && <span className="text-sm text-fail">{dlErr}</span>}
          </div>

          {cv && (
            <details className="mt-3 rounded-xl border border-line bg-card2 p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">View candidate resume</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">{cv}</pre>
            </details>
          )}

          <Recording interviewId={iv.id} />

          {turns.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-medium text-faint">Interview transcript</div>
              <div className="space-y-2.5">
                {turns.map((t, i) => (
                  <div key={i} className="rounded-xl border border-line bg-card2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-serif text-ink">{t.question || ""}</span>
                      {t.score != null && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${good ? "bg-pass/15 text-pass" : "bg-accent/15 text-accent"}`}>{t.score}/10</span>}
                    </div>
                    <p className="mt-2 text-sm text-muted"><b className="text-ink">Answer</b> &nbsp;{t.answer_text || "No answer recorded."}</p>
                    {t.ai_feedback && <p className="mt-1.5 text-sm text-faint"><b>Evaluation:</b> {t.ai_feedback}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HRPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState({ open: false, ids: [], label: "", note: "", busy: false, err: "" });
  const router = useRouter();
  const auth = useRequireRole("hr");

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/hr-data", { cache: "no-store" });
      let d = await r.json();
      if (!Array.isArray(d)) d = d && d.error ? [] : [d].filter(Boolean);
      // keep only interviews that have something to show
      d = d.filter((iv) => (iv.interview_turns && iv.interview_turns.length) || getReport(iv));
      setData(d);
      if (!d.length && r.status !== 200) setErr("Could not reach the server. Make sure n8n is running.");
    } catch {
      setErr("Could not reach the server. Make sure n8n is running.");
      setData([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const active = useMemo(() => (data || []).filter((iv) => !iv.archived_at), [data]);
  const archived = useMemo(() => (data || []).filter((iv) => iv.archived_at), [data]);

  const stats = useMemo(() => {
    const d = active;
    let pass = 0, fail = 0, pend = 0;
    let st = 0, sc = 0, sp = 0, rc = 0;
    for (const iv of d) {
      const rep = getReport(iv);
      const overall = rep ? num(rep.overall_score) : null;
      if (overall == null) { pend++; continue; }
      if (overall >= PASS_MARK) pass++; else fail++;
      if (rep.technical_score != null) {
        st += +rep.technical_score; sc += +rep.communication_score; sp += +rep.problem_solving_score; rc++;
      }
    }
    const rate = (pass + fail) ? Math.round((pass / (pass + fail)) * 100) : 0;
    const avg = rc ? { tech: st / rc, comm: sc / rc, ps: sp / rc } : { tech: 0, comm: 0, ps: 0 };
    return { total: d.length, pass, fail, pend, rate, avg, rc };
  }, [active]);

  // All active, not-qualified applications — the targets for "clear all".
  const notQualifiedIds = useMemo(() => active.filter((iv) => {
    const rep = getReport(iv);
    const o = rep ? num(rep.overall_score) : null;
    return o != null && o < PASS_MARK;
  }).map((iv) => iv.id), [active]);

  const shown = useMemo(() => {
    if (filter === "archived") return archived;
    const d = active;
    if (filter === "all") return d;
    return d.filter((iv) => {
      const rep = getReport(iv);
      const overall = rep ? num(rep.overall_score) : null;
      if (filter === "pending") return overall == null;
      if (filter === "qualified") return overall != null && overall >= PASS_MARK;
      if (filter === "failed") return overall != null && overall < PASS_MARK;
      return true;
    });
  }, [active, archived, filter]);

  const tabs = [
    ["all", "All", stats.total],
    ["qualified", "Qualified", stats.pass],
    ["failed", "Not qualified", stats.fail],
    ["pending", "In progress", stats.pend],
    ["archived", "Archived", archived.length],
  ];

  async function token() {
    const { data: { session } } = await supabase.auth.getSession();
    return session && session.access_token;
  }

  // Open the password modal for a single or bulk removal.
  function askRemove(ids, label, note) {
    setConfirm({ open: true, ids, label, note, busy: false, err: "" });
  }

  async function doArchive(pw) {
    setConfirm((c) => ({ ...c, busy: true, err: "" }));
    try {
      const r = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: await token(), password: pw, interview_ids: confirm.ids, action: "archive" }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setConfirm((c) => ({ ...c, busy: false, err: d.error || "Could not remove." }));
        return;
      }
      setConfirm({ open: false, ids: [], label: "", note: "", busy: false, err: "" });
      await load();
    } catch {
      setConfirm((c) => ({ ...c, busy: false, err: "Could not remove." }));
    }
  }

  async function restoreOne(id) {
    try {
      const r = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: await token(), interview_ids: [id], action: "restore" }),
      });
      if (r.ok) await load();
    } catch {}
  }

  if (auth.status === "denied") {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-ink">Access denied</h1>
          <p className="mt-2 text-muted">This is the recruiter area. Your account doesn't have recruiter access.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => router.replace(auth.role === "admin" ? "/admin" : "/login")} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110">Go to your area</button>
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
      {confirm.open && (
        <PasswordConfirm
          label={confirm.label}
          note={confirm.note}
          busy={confirm.busy}
          err={confirm.err}
          onCancel={() => setConfirm({ open: false, ids: [], label: "", note: "", busy: false, err: "" })}
          onConfirm={doArchive}
        />
      )}

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent">
            <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M6.5 11a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
            <path d="M12 16.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <b className="font-serif text-[22px] font-semibold tracking-tight text-ink">Probe</b>
          <span className="ml-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Recruiter</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={load} className="glass rounded-lg px-3 py-2 text-sm font-medium text-ink transition hover:brightness-105">Refresh</button>
          <button onClick={logout} className="text-sm text-muted transition hover:text-ink">Log out</button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
        <h1 className="font-serif text-3xl font-semibold text-ink">Candidates</h1>
        <p className="mt-1 text-muted">Scored interviews, ranked against each role.</p>

        {loading && <p className="mt-8 text-muted">Loading candidates…</p>}
        {err && <p className="mt-8 text-fail">{err}</p>}

        {!loading && !err && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatTile label="Total" value={stats.total} foot="All submissions" tone="all" />
              <StatTile label="Qualified" value={stats.pass} foot={`${stats.rate}% qualification rate`} tone="pass" />
              <StatTile label="Not qualified" value={stats.fail} foot="Below role benchmark" tone="fail" />
              <StatTile label="In progress" value={stats.pend} foot="Awaiting completion" tone="pend" />
            </div>

            {stats.total > 0 && (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="glass flex items-center gap-6 rounded-2xl p-6">
                  <Donut pass={stats.pass} fail={stats.fail} pend={stats.pend} />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-pass" /> Qualified <b className="ml-auto text-ink">{stats.pass}</b></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-fail" /> Not qualified <b className="ml-auto text-ink">{stats.fail}</b></div>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-pend" /> In progress <b className="ml-auto text-ink">{stats.pend}</b></div>
                  </div>
                </div>
                <div className="glass rounded-2xl p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">Average competencies</span>
                    <span className="text-xs text-faint">{stats.rc ? `Across ${stats.rc} interview${stats.rc === 1 ? "" : "s"}` : "No completed interviews"}</span>
                  </div>
                  <div className="flex items-center gap-6"><Bars avg={stats.avg} /></div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-2">
              {tabs.map(([key, label, count]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === key ? "bg-accent text-accent-ink" : "glass text-muted hover:text-ink"}`}>
                  {label} <span className="opacity-70">{count}</span>
                </button>
              ))}
              {filter !== "archived" && notQualifiedIds.length > 0 && (
                <button
                  onClick={() => askRemove(
                    notQualifiedIds,
                    `Remove ${notQualifiedIds.length} not-qualified application${notQualifiedIds.length === 1 ? "" : "s"}?`,
                    "They move to the Archived tab and can be restored. After 30 days they are permanently deleted.",
                  )}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-fail/40 px-4 py-2 text-sm font-medium text-fail transition hover:bg-fail/10">
                  <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  Clear all not-qualified ({notQualifiedIds.length})
                </button>
              )}
            </div>

            {filter === "archived" && (
              <p className="mt-4 text-sm text-muted">Archived applications are hidden from the main board and permanently deleted 30 days after removal. Restore any time before then.</p>
            )}

            <div className="mt-5 space-y-3">
              {shown.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center text-muted">
                  {filter === "archived" ? "Nothing archived." : "No candidates in this view yet."}
                </div>
              ) : (
                shown.map((iv, i) => (
                  <CandidateCard
                    key={iv.id || i}
                    iv={iv}
                    archived={filter === "archived"}
                    onRemove={(id, name) => askRemove([id], `Remove ${name}'s application?`, "It moves to the Archived tab and can be restored. After 30 days it is permanently deleted.")}
                    onRestore={restoreOne}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}