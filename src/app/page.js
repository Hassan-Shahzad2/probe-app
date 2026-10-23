"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, animate } from "motion/react";

// Lottie player — loaded client-side only (it touches the DOM).
const Lottie = dynamic(() => import("lottie-react").then((m) => m.default), { ssr: false });

const ease = [0.22, 1, 0.36, 1];

/* ---------------- small building blocks ---------------- */

function Waveform({ bars = 5 }) {
  const reduce = useReducedMotion();
  const heights = [10, 18, 24, 16, 12, 20, 14];
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          style={{ height: heights[i % heights.length], originY: 1 }}
          animate={reduce ? {} : { scaleY: [0.35, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

/* The hero signal — a tall live waveform that reads as "listening". */
function LiveWaveform({ bars = 40 }) {
  const reduce = useReducedMotion();
  const base = useRef(
    Array.from({ length: bars }, (_, i) =>
      0.22 + 0.72 * Math.abs(Math.sin(i * 0.55) * 0.7 + Math.sin(i * 0.17) * 0.5)
    )
  );
  return (
    <div className="flex h-24 items-center justify-center gap-[3px] sm:gap-1" aria-hidden>
      {base.current.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-accent to-accent-bright sm:w-1"
          style={{ height: `${Math.max(8, h * 100)}%`, originY: 1 }}
          animate={reduce ? {} : { scaleY: [0.3, 1, 0.45, 0.8, 0.35] }}
          transition={{
            duration: 1.7 + (i % 6) * 0.18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.028,
          }}
        />
      ))}
    </div>
  );
}

function MicMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent">
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      <path d="M12 16.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <MicMark />
      <b className="font-serif text-[26px] font-semibold tracking-tight text-ink">Probe</b>
    </span>
  );
}

function Icon({ name }) {
  const p = {
    width: 20, height: 20, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (name === "mic")
    return (<svg {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>);
  if (name === "chart")
    return (<svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M2 20h20" /></svg>);
  return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>);
}

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    setMounted(true);
  }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("probe_theme", next); } catch (e) {}
    setDark(!dark);
  };
  return (
    <button
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      className="glass grid h-10 w-10 place-items-center rounded-full text-ink transition hover:scale-105"
    >
      {mounted && (dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ))}
    </button>
  );
}

function ScoreRing({ value = 75 }) {
  const reduce = useReducedMotion();
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    if (reduce) { count.set(value); return; }
    const controls = animate(count, [0, value, value, 0], {
      duration: 4.2,
      times: [0, 0.38, 0.72, 1],
      repeat: Infinity,
      ease: "easeInOut",
    });
    return () => controls.stop();
  }, [reduce, value, count]);

  return (
    <div className="relative grid place-items-center">
      <svg width="86" height="86" viewBox="0 0 88 88" className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-bright)" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <motion.circle
          cx="44" cy="44" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c}
          style={{ filter: "drop-shadow(0 0 7px rgba(30,203,195,0.5))" }}
          animate={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: [c, offset, offset, c] }}
          transition={reduce ? {} : { duration: 4.2, times: [0, 0.38, 0.72, 1], repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      <motion.span className="tnum absolute font-serif text-[26px] font-normal text-ink">{rounded}</motion.span>
    </div>
  );
}

/* ---------------- step screen demos ---------------- */

const easeCursor = [0.5, 0, 0.2, 1];
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
function centerIn(bodyEl, el) {
  const c = bodyEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
}

function Cursor({ cx, cy }) {
  return (
    <motion.div style={{ x: cx, y: cy }} className="pointer-events-none absolute left-0 top-0 z-20">
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]" fill="#0C1A1C" stroke="#ffffff" strokeWidth="1.4">
        <path d="M5 3l14 7-6 2-2 6z" />
      </svg>
    </motion.div>
  );
}

function Device({ children, innerRef }) {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-[1.8rem] bg-gradient-to-b from-slate-700 to-slate-950 p-3 shadow-2xl shadow-slate-950/50 ring-1 ring-white/10">
      <div className="mx-auto mb-2.5 flex items-center justify-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        <span className="h-1 w-8 rounded-full bg-white/20" />
      </div>
      <div
        data-theme="light"
        ref={innerRef}
        className="relative overflow-hidden rounded-[1.1rem] bg-white p-5 text-ink"
      >
        {children}
      </div>
    </div>
  );
}

function UploadDemo() {
  const reduce = useReducedMotion();
  const body = useRef(null);
  const browse = useRef(null);
  const roleRef = useRef(null);
  const startRef = useRef(null);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const [fileIn, setFileIn] = useState(false);
  const [browseHot, setBrowseHot] = useState(false);
  const [roleHot, setRoleHot] = useState(false);
  const [startHot, setStartHot] = useState(false);
  const [jobIdx, setJobIdx] = useState(0);
  const jobs = ["Frontend Engineer", "Backend Engineer", "Data Analyst", "Product Designer", "DevOps Engineer", "Mobile Developer"];

  useEffect(() => {
    if (reduce) { setFileIn(true); return; }
    let cancelled = false;
    const moveTo = (el, dur = 0.9) => {
      if (!el || !body.current) return Promise.resolve();
      const { x, y } = centerIn(body.current, el);
      return Promise.all([
        animate(cx, x, { duration: dur, ease: easeCursor }).finished,
        animate(cy, y, { duration: dur, ease: easeCursor }).finished,
      ]);
    };
    (async () => {
      await wait(900);
      if (cancelled || !body.current) return;
      const c = body.current.getBoundingClientRect();
      cx.set(c.width * 0.82); cy.set(c.height * 0.92);
      while (!cancelled) {
        setFileIn(false); setBrowseHot(false); setRoleHot(false); setStartHot(false);
        await wait(500); if (cancelled) break;
        await moveTo(browse.current); if (cancelled) break;
        setBrowseHot(true); await wait(220); setBrowseHot(false);
        setFileIn(true);
        await wait(650); if (cancelled) break;
        await moveTo(roleRef.current); if (cancelled) break;
        setRoleHot(true);
        for (let k = 0; k < 5; k++) { setJobIdx((j) => (j + 1) % jobs.length); await wait(170); if (cancelled) break; }
        await wait(450); if (cancelled) break; setRoleHot(false);
        await moveTo(startRef.current); if (cancelled) break;
        setStartHot(true); await wait(260); setStartHot(false);
        await wait(1100);
      }
    })();
    return () => { cancelled = true; };
  }, [reduce, cx, cy]);

  return (
    <Device innerRef={body}>
      <div ref={browse} className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${browseHot ? "border-accent bg-accent-soft" : "border-line-strong"}`}>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>
        </span>
        <p className="mt-3 text-sm text-muted">Drop your CV, or browse</p>
      </div>
      <div className="mt-4 h-[42px]">
        <AnimatePresence>
          {fileIn && (
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }} className="flex items-center gap-2 rounded-lg bg-card2 px-3 py-2 text-sm text-ink">
              <span className="grid h-6 w-7 place-items-center rounded bg-accent/15 text-[10px] font-bold text-accent">PDF</span>
              ayesha-khan-cv.pdf
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div ref={roleRef} className={`mt-1 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${roleHot ? "border-accent text-ink" : "border-line text-muted"}`}>
        {jobs[jobIdx]} <span className="text-faint">▾</span>
      </div>
      <motion.button ref={startRef} animate={{ scale: startHot ? 0.96 : 1 }} transition={{ duration: 0.15 }} className="mt-4 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink">
        Start interview
      </motion.button>
      {!reduce && <Cursor cx={cx} cy={cy} />}
    </Device>
  );
}

function InterviewDemo() {
  const reduce = useReducedMotion();
  const body = useRef(null);
  const micRef = useRef(null);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const [listening, setListening] = useState(false);
  const [press, setPress] = useState(false);

  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    const moveTo = (el, dur = 0.9) => {
      if (!el || !body.current) return Promise.resolve();
      const { x, y } = centerIn(body.current, el);
      return Promise.all([
        animate(cx, x, { duration: dur, ease: easeCursor }).finished,
        animate(cy, y, { duration: dur, ease: easeCursor }).finished,
      ]);
    };
    (async () => {
      await wait(900);
      if (cancelled || !body.current) return;
      const c = body.current.getBoundingClientRect();
      cx.set(c.width * 0.82); cy.set(c.height * 0.92);
      while (!cancelled) {
        setListening(false);
        await wait(600); if (cancelled) break;
        await moveTo(micRef.current); if (cancelled) break;
        setPress(true); await wait(220); setPress(false);
        setListening(true);
        await wait(2600); if (cancelled) break;
      }
    })();
    return () => { cancelled = true; };
  }, [reduce, cx, cy]);

  return (
    <Device innerRef={body}>
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-ink"><Waveform bars={5} /> In session</span>
        <span className="tnum text-xs text-faint">02:14</span>
      </div>
      <p className="mt-4 font-serif text-lg leading-relaxed text-ink">Tell me about a tradeoff you made in your last project.</p>
      <div className="mt-6 grid place-items-center">
        <div className="relative grid h-20 w-20 place-items-center">
          {listening && (
            <motion.span className="absolute inset-0 rounded-full border border-accent/40"
              animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }} />
          )}
          <motion.span ref={micRef} animate={{ scale: press ? 0.9 : 1 }} transition={{ duration: 0.15 }}
            className={`grid h-16 w-16 place-items-center rounded-full text-accent-ink shadow-lg shadow-accent/30 ${listening ? "bg-accent-bright" : "bg-accent"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
          </motion.span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">{listening ? "Listening…" : "Tap to answer"}</p>
      {!reduce && <Cursor cx={cx} cy={cy} />}
    </Device>
  );
}

function ScoringDemo() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(reduce ? 5 : 0);
  const bars = [["Technical", 82], ["Depth", 74], ["Communication", 71]];

  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        setStage(0); await wait(600); if (cancelled) break;
        setStage(1); await wait(550); if (cancelled) break;
        setStage(2); await wait(550); if (cancelled) break;
        setStage(3); await wait(650); if (cancelled) break;
        setStage(4); await wait(2000); if (cancelled) break;
      }
    })();
    return () => { cancelled = true; };
  }, [reduce]);

  return (
    <Device>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Evaluation</span>
        <span className="text-xs font-medium text-accent">{stage >= 4 ? "Complete" : "Scoring…"}</span>
      </div>
      <div className="mt-4 space-y-3">
        {bars.map(([k, v], i) => (
          <div key={k}>
            <div className="flex justify-between text-sm">
              <span className="text-muted">{k}</span>
              <span className="tnum font-serif font-normal text-ink">{stage > i ? v : 0}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-line">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright transition-all duration-700 ease-out" style={{ width: stage > i ? `${v}%` : "0%" }} />
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-5 flex items-center justify-between rounded-lg bg-accent-soft px-4 py-3 transition-opacity duration-500 ${stage >= 4 ? "opacity-100" : "opacity-0"}`}>
        <span className="font-serif text-lg font-normal text-ink">Overall 76</span>
        <span className="text-sm font-semibold text-accent">Qualified</span>
      </div>
    </Device>
  );
}

function DashboardDemo() {
  const reduce = useReducedMotion();
  const body = useRef(null);
  const rowRefs = useRef([]);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const [hover, setHover] = useState(-1);
  const rows = [["Ayesha Khan", 81, "Qualified", 5], ["Bilal Ahmed", 66, "Review", 12], ["Sana Iqbal", 74, "Qualified", 32]];

  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    const moveTo = (el, dur = 0.8) => {
      if (!el || !body.current) return Promise.resolve();
      const { x, y } = centerIn(body.current, el);
      return Promise.all([
        animate(cx, x, { duration: dur, ease: easeCursor }).finished,
        animate(cy, y, { duration: dur, ease: easeCursor }).finished,
      ]);
    };
    (async () => {
      await wait(900);
      if (cancelled || !body.current) return;
      const c = body.current.getBoundingClientRect();
      cx.set(c.width * 0.85); cy.set(c.height * 0.25);
      while (!cancelled) {
        for (let i = 0; i < rows.length; i++) {
          await moveTo(rowRefs.current[i]); if (cancelled) break;
          setHover(i); await wait(650);
        }
        if (cancelled) break;
        setHover(-1); await wait(700);
      }
    })();
    return () => { cancelled = true; };
  }, [reduce, cx, cy]);

  return (
    <Device innerRef={body}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Candidates</span>
        <span className="text-xs text-faint">Frontend Engineer</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map(([name, score, tag, av], i) => (
          <div key={name} ref={(el) => (rowRefs.current[i] = el)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${hover === i ? "bg-accent-soft ring-1 ring-accent/40" : "bg-card2"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.pravatar.cc/64?img=${av}`} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            <span className="flex-1 text-sm text-ink">{name}</span>
            <span className="tnum font-serif text-base font-normal text-ink">{score}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag === "Qualified" ? "bg-accent/15 text-accent" : "bg-pend/15 text-pend"}`}>{tag}</span>
          </div>
        ))}
      </div>
      {!reduce && <Cursor cx={cx} cy={cy} />}
    </Device>
  );
}

/* ---------------- hero scene: a candidate interviewing with Probe ---------------- */

function InterviewScene() {
  const reduce = useReducedMotion();
  const miniBars = [0.45, 0.8, 0.55, 1, 0.5, 0.78, 0.42];
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-[var(--readout)] px-5 py-7 sm:px-7">
      <svg viewBox="0 0 440 300" className="mx-auto w-full max-w-[420px]" role="img" aria-label="A candidate taking a voice interview with Probe on a laptop">
        {/* soft ground */}
        <ellipse cx="220" cy="268" rx="150" ry="13" fill="var(--accent)" opacity="0.08" />

        {/* desk */}
        <rect x="66" y="222" width="308" height="18" rx="7" fill="var(--surface)" stroke="var(--line)" />
        <rect x="66" y="222" width="308" height="7" rx="3.5" fill="var(--line-strong)" opacity="0.35" />

        {/* person — gentle breathing bob */}
        <motion.g
          animate={reduce ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* chair back */}
          <rect x="70" y="138" width="24" height="96" rx="11" fill="var(--line-strong)" opacity="0.5" />
          {/* torso */}
          <path d="M98 234 q0 -66 42 -66 q42 0 42 66 Z" fill="var(--accent)" />
          {/* neck */}
          <rect x="128" y="150" width="22" height="22" rx="7" fill="var(--ink)" opacity="0.92" />
          {/* head */}
          <circle cx="139" cy="134" r="25" fill="var(--ink)" />
          {/* arm resting toward the desk */}
          <path d="M174 198 q28 4 44 26" stroke="var(--accent)" strokeWidth="13" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* speaking arcs — the candidate's voice toward the laptop */}
        {!reduce && [12, 21, 30].map((R, i) => (
          <motion.path
            key={R}
            d={`M168 ${134 - R} A ${R} ${R} 0 0 1 168 ${134 + R}`}
            fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round"
            animate={{ opacity: [0.08, 0.75, 0.08] }}
            transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}

        {/* laptop */}
        <g>
          <path d="M248 236 l96 0 l20 -14 l-136 0 Z" fill="var(--line-strong)" />
          <path d="M228 222 l136 0 l-20 14 l-96 0 Z" fill="var(--surface)" stroke="var(--line)" />
          {/* screen */}
          <rect x="260" y="138" width="104" height="80" rx="8" fill="var(--ink)" />
          <rect x="266" y="144" width="92" height="68" rx="5" fill="var(--card)" />
          {/* on-screen: listening dot + label */}
          <motion.circle cx="278" cy="158" r="3.4" fill="var(--accent)"
            animate={reduce ? {} : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
          <rect x="287" y="155.5" width="30" height="5" rx="2.5" fill="var(--line-strong)" />
          {/* on-screen mini waveform */}
          {miniBars.map((h, i) => (
            <motion.rect
              key={i}
              x={276 + i * 10} width="4" rx="2" fill="var(--accent)"
              y={196 - h * 26} height={h * 26}
              style={{ transformOrigin: `${278 + i * 10}px 196px` }}
              animate={reduce ? {} : { scaleY: [0.4, 1, 0.5] }}
              transition={{ duration: 1.2 + i * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
            />
          ))}
        </g>
      </svg>
      <p className="mt-1 text-center text-sm text-muted">A candidate interviewing with Probe, live.</p>
    </div>
  );
}

/* Loads /public/hero-lottie.json and plays it. Falls back gracefully if missing. */
function HeroLottie() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let on = true;
    fetch("/hero-lottie.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => on && setData(d))
      .catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  if (failed) {
    // graceful fallback until the animation file is added
    return <InterviewScene />;
  }
  if (!data) {
    return <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-[var(--readout)] text-sm text-faint">Loading…</div>;
  }
  return (
    <div className="rounded-2xl bg-[var(--readout)] p-2">
      <Lottie animationData={data} loop autoplay className="mx-auto w-full max-w-[480px]" />
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Home() {
  const reduce = useReducedMotion();
  const fadeUp = {
    hidden: { opacity: 0, y: 22 },
    show: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, ease, delay: d } }),
  };

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-4 text-sm text-muted sm:gap-6">
          <a href="#how" className="hidden transition hover:text-ink sm:inline">How it works</a>
          <Link href="/hr" className="hidden transition hover:text-ink sm:inline">For recruiters</Link>
          <ThemeToggle />
          <Link href="/candidate" className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-lg shadow-accent/25 transition hover:brightness-110">
            Start
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:pb-28 lg:pt-12">
        <div>
          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={0.04}
            className="font-serif text-[clamp(40px,5.4vw,70px)] font-medium leading-[1.05] tracking-tight text-ink">
            From a CV to a scored shortlist, in one conversation.
          </motion.h1>

          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={0.16}
            className="mt-6 max-w-[48ch] text-lg leading-relaxed text-muted">
            Probe interviews each candidate by voice, grounded in their own CV, scores every answer against the role, and hands you a ranked result you can trust.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.24}
            className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/candidate" className="rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-ink shadow-xl shadow-accent/30 transition hover:-translate-y-0.5 hover:brightness-110">
              Start an interview
            </Link>
            <Link href="/hr" className="glass rounded-full px-7 py-3.5 font-semibold text-ink transition hover:-translate-y-0.5">
              Recruiter console
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.32}
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> CV-grounded questions</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Scored in real time</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Proctored &amp; recorded</span>
          </motion.div>
        </div>

        {/* the one bold element: the live instrument readout */}
        <motion.div
          initial={{ opacity: 0, y: 34, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-3xl border border-line-strong bg-card p-5 shadow-xl shadow-[rgba(26,54,120,0.12)] sm:p-6">
            <HeroLottie />
          </div>
        </motion.div>
      </section>

      {/* how it works — a playing demo screen per step */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold tracking-tight text-accent">How a screening runs</span>
          <h2 className="mt-3 font-serif text-[clamp(34px,4.6vw,56px)] font-medium leading-tight text-ink">
            Four steps, from resume to a ranked verdict.
          </h2>
        </div>

        <div className="mt-14 space-y-20 lg:mt-20 lg:space-y-28">
          {[
            { n: 1, t: "Upload a CV", d: "The candidate uploads their resume and picks the role they are applying for.", Mock: UploadDemo },
            { n: 2, t: "Voice interview", d: "Probe asks questions drawn from their own CV and listens to spoken answers.", Mock: InterviewDemo },
            { n: 3, t: "Scored as it goes", d: "Every answer is judged on correctness, depth, and clarity — in real time.", Mock: ScoringDemo },
            { n: 4, t: "Ranked result", d: "You get a scored verdict and the full transcript for every candidate.", Mock: DashboardDemo },
          ].map((s, i) => {
            const flip = i % 2 === 1;
            return (
              <div key={s.n} className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
                <motion.div
                  className={flip ? "lg:order-2" : ""}
                  initial={{ opacity: 0, x: flip ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6, ease }}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="tnum font-serif text-2xl font-medium text-accent">{String(s.n).padStart(2, "0")}</span>
                    <span className="h-px flex-1 bg-line-strong" />
                  </div>
                  <h3 className="mt-4 font-serif text-[clamp(30px,3.2vw,46px)] font-medium leading-tight text-ink">{s.t}</h3>
                  <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{s.d}</p>
                </motion.div>
                <motion.div
                  className={flip ? "lg:order-1" : ""}
                  initial={{ opacity: 0, x: flip ? -40 : 40, scale: 0.97 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, ease }}
                >
                  <s.Mock />
                </motion.div>
              </div>
            );
          })}
        </div>
      </section>

      {/* access */}
      <section className="mx-auto max-w-6xl px-5 pb-24 pt-6 sm:px-6">
        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {[
            { t: "Candidate", d: "Take your interview.", href: "/candidate", icon: "mic" },
            { t: "Recruiter", d: "Review scored candidates.", href: "/hr", icon: "chart" },
            { t: "Admin", d: "Manage roles and questions.", href: "/admin", icon: "cog" },
          ].map((d) => (
            <motion.div key={d.t} whileHover={reduce ? {} : { y: -4 }} transition={{ duration: 0.2 }}>
              <Link href={d.href} className="glass flex items-center gap-4 rounded-2xl p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon name={d.icon} />
                </span>
                <span>
                  <span className="block font-serif text-xl font-medium text-ink">{d.t}</span>
                  <span className="block text-sm text-muted">{d.d}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-faint sm:px-6">
        <Logo />
        <span>AI interview screener</span>
      </footer>
    </main>
  );
}