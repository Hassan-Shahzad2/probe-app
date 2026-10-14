"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";

const ANSWER_WINDOW = 7;   // seconds to BEGIN answering before the question repeats
const SILENCE_MS = 4000;   // auto-finish an answer after this much silence

/* ---------- small pieces ---------- */
function Bars({ n = 5 }) {
  const hs = [10, 16, 22, 14, 18];
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          style={{ height: hs[i % hs.length], originY: 1 }}
          animate={{ scaleY: [0.4, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const UploadIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" {...svg}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>);
const MicIcon = () => (<svg width="30" height="30" viewBox="0 0 24 24" {...svg}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>);
const StopIcon = () => (<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>);
const CheckIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" {...svg}><path d="M20 6L9 17l-5-5" /></svg>);
const ClockIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);

function fmt(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function PermRow({ label, desc, ok, onGrant }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-card2 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${ok ? "bg-pass/15 text-pass" : "bg-accent-soft text-accent"}`}>
        {ok ? <CheckIcon /> : <span className="h-2.5 w-2.5 rounded-full bg-current opacity-60" />}
      </span>
      <div className="flex-1">
        <div className="font-medium text-ink">{label}</div>
        <div className="text-sm text-muted">{desc}</div>
      </div>
      {ok ? (
        <span className="text-sm font-medium text-pass">Granted</span>
      ) : (
        <button onClick={onGrant} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110">Allow</button>
      )}
    </div>
  );
}

/* ---------- page ---------- */
export default function CandidatePage() {
  const [phase, setPhase] = useState("form"); // form | permissions | interview | done
  const [jobs, setJobs] = useState([]);
  const [jobsErr, setJobsErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobId, setJobId] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [formErr, setFormErr] = useState("");

  // proctoring / permissions
  const camStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const videoRef = useRef(null);
  const [camOk, setCamOk] = useState(false);
  const [screenOk, setScreenOk] = useState(false);
  const [permErr, setPermErr] = useState("");

  const interviewIdRef = useRef(null);
  const [question, setQuestion] = useState("");
  const [qNum, setQNum] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const totalQRef = useRef(0);
  const askedRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [mic, setMic] = useState("idle"); // idle|disabled|ready|listening|processing
  const micRef = useRef("idle");
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");

  // timers
  const [answerLeft, setAnswerLeft] = useState(null);
  const [overallLeft, setOverallLeft] = useState(null);
  const answerTickRef = useRef(null);
  const overallTickRef = useRef(null);
  const silenceRef = useRef(null);
  const repeatedRef = useRef(false);
  const endedRef = useRef(false);

  const lastQuestionRef = useRef("");
  const recRef = useRef(null);
  const isRecordingRef = useRef(false);
  const finalRef = useRef("");
  const submittingRef = useRef(false);

  function setMicState(v) { micRef.current = v; setMic(v); }

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/jobs");
        const data = await r.json();
        if (Array.isArray(data)) {
          setJobs(data);
          if (data[0]) setJobId(data[0].id);
        } else setJobsErr("Could not load roles.");
      } catch {
        setJobsErr("Could not load roles.");
      }
    })();
  }, []);

  // keep the live camera preview wired up across phases
  useEffect(() => {
    if ((phase === "permissions" || phase === "interview") && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase, camOk]);

  useEffect(() => () => {
    try { window.speechSynthesis.cancel(); } catch {}
    isRecordingRef.current = false;
    try { recRef.current && recRef.current.stop(); } catch {}
    if (answerTickRef.current) clearInterval(answerTickRef.current);
    if (overallTickRef.current) clearInterval(overallTickRef.current);
    if (silenceRef.current) clearTimeout(silenceRef.current);
    try { camStreamRef.current && camStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    try { screenStreamRef.current && screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- permissions ----- */
  async function requestCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // release the mic track so the speech recogniser can own the microphone;
      // the permission stays granted and we keep the video for preview + recording.
      s.getAudioTracks().forEach((t) => t.stop());
      camStreamRef.current = s;
      setCamOk(true);
      setPermErr("");
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
    } catch {
      setCamOk(false);
      setPermErr("Camera and microphone access is required. Please allow it to continue.");
    }
  }

  async function requestScreen() {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = s;
      setScreenOk(true);
      setPermErr("");
      const track = s.getVideoTracks()[0];
      if (track) track.onended = () => setScreenOk(false);
    } catch {
      setScreenOk(false);
      setPermErr("Screen sharing is required. Please share your entire screen.");
    }
  }

  function proceedToInterview() {
    if (!(camOk && screenOk)) return;
    setPhase("interview");
    startOverallTimer(totalQRef.current);
    startInterview();
  }

  function speak(text) {
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-IN";
        u.rate = 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  }

  async function callEngine(answer) {
    const body = { interview_id: interviewIdRef.current };
    if (answer) {
      body.last_question = lastQuestionRef.current;
      body.candidate_answer = answer;
    }
    const r = await fetch("/api/interview-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  function finalizeInterview() {
    fetch("/api/finalize-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interview_id: interviewIdRef.current }),
    }).catch(() => {});
  }

  /* ----- silence auto-finish ----- */
  function clearSilence() { if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null; } }
  function armSilence() {
    clearSilence();
    silenceRef.current = setTimeout(() => { if (isRecordingRef.current) stopRecording(); }, SILENCE_MS);
  }

  /* ----- begin window ----- */
  function clearAnswerWindow() { if (answerTickRef.current) { clearInterval(answerTickRef.current); answerTickRef.current = null; } setAnswerLeft(null); }
  function startAnswerWindow() {
    clearAnswerWindow();
    let left = ANSWER_WINDOW;
    setAnswerLeft(left);
    answerTickRef.current = setInterval(() => {
      if (endedRef.current || micRef.current !== "ready") { clearAnswerWindow(); return; }
      left -= 1;
      if (left <= 0) { clearAnswerWindow(); onWindowExpire(); } else { setAnswerLeft(left); }
    }, 1000);
  }
  async function onWindowExpire() {
    if (endedRef.current || micRef.current !== "ready") return;
    if (!repeatedRef.current) {
      repeatedRef.current = true;
      setMicState("disabled");
      setStatus("No response yet — repeating the question.");
      setSpeaking(true);
      await speak("Let me repeat the question. " + lastQuestionRef.current);
      setSpeaking(false);
      if (endedRef.current) return;
      setMicState("ready");
      setStatus("Tap the mic and answer. Just stop speaking when you're done.");
      startAnswerWindow();
    } else {
      setStatus("No response recorded — moving on.");
      await submitNoAnswer();
    }
  }
  async function submitNoAnswer() {
    if (submittingRef.current || endedRef.current) return;
    submittingRef.current = true;
    setMicState("processing");
    try {
      const result = await callEngine("(The candidate did not respond within the time limit.)");
      await afterTurn(result);
    } catch {
      setStatus("Something went wrong. Tap the mic to retry.");
      setMicState("ready");
      startAnswerWindow();
    }
    submittingRef.current = false;
  }

  /* ----- overall timer ----- */
  function startOverallTimer(numQ) {
    const total = Math.max(60, numQ * 120);
    setOverallLeft(total);
    let left = total;
    overallTickRef.current = setInterval(() => {
      if (endedRef.current) { clearInterval(overallTickRef.current); overallTickRef.current = null; return; }
      left -= 1;
      if (left <= 0) { clearInterval(overallTickRef.current); overallTickRef.current = null; setOverallLeft(0); timeUp(); }
      else setOverallLeft(left);
    }, 1000);
  }
  function stopAllTimers() {
    clearAnswerWindow();
    clearSilence();
    if (overallTickRef.current) { clearInterval(overallTickRef.current); overallTickRef.current = null; }
  }

  async function endInterview(message) {
    endedRef.current = true;
    isRecordingRef.current = false;
    try { recRef.current && recRef.current.stop(); } catch {}
    stopAllTimers();
    finalizeInterview();
    setMicState("disabled");
    setQuestion(message.q);
    setStatus("");
    setSpeaking(true);
    await speak(message.spoken);
    setSpeaking(false);
    setPhase("done");
    try { camStreamRef.current && camStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    try { screenStreamRef.current && screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
  }
  async function timeUp() {
    if (endedRef.current) return;
    await endInterview({ q: "That's all the time we have.", spoken: "That's all the time we have. Thank you for your responses." });
  }

  /* ----- interview flow ----- */
  async function afterTurn(result) {
    if (endedRef.current) return;
    const done = (result && result.is_complete) || askedRef.current >= totalQRef.current;
    if (done) {
      await endInterview({ q: "That concludes our interview.", spoken: "Thank you, that concludes our interview. Best of luck!" });
      return;
    }
    await presentQuestion(result.next_question);
  }

  async function presentQuestion(text) {
    if (endedRef.current) return;
    repeatedRef.current = false;
    lastQuestionRef.current = text;
    askedRef.current += 1;
    setQNum((n) => n + 1);
    setQuestion(text);
    setTranscript("");
    clearAnswerWindow();
    setMicState("disabled");
    setSpeaking(true);
    setStatus("Listen to the question…");
    await speak(text);
    if (endedRef.current) return;
    setSpeaking(false);
    setStatus("Tap the mic and answer. Just stop speaking when you're done.");
    setMicState("ready");
    startAnswerWindow();
  }

  async function startInterview() {
    setStatus("Preparing your first question…");
    try {
      const result = await callEngine(null);
      await presentQuestion(result.next_question);
    } catch {
      setStatus("Could not reach the server. Please refresh and try again.");
    }
  }

  async function submitCV(e) {
    e.preventDefault();
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!name.trim() || !email.trim() || !file) {
      setFormErr("Please add your name, email, and attach a PDF.");
      return;
    }
    const job = jobs.find((j) => j.id === jobId);
    const numQ = job ? (job.num_questions ?? 3) : 3;
    setTotalQ(numQ);
    totalQRef.current = numQ;
    askedRef.current = 0;
    setUploading(true);
    setFormErr("");

    const fd = new FormData();
    fd.append("data", file);
    fd.append("candidate_name", name.trim());
    fd.append("candidate_email", email.trim());
    fd.append("job_id", jobId);
    fd.append("num_questions", numQ);
    fd.append("job_title", job ? job.title : "");
    fd.append("job_description", job ? job.description : "");

    try {
      const r = await fetch("/api/upload-cv", { method: "POST", body: fd });
      const result = await r.json();
      if (!result.interview_id) throw new Error("no interview id");
      interviewIdRef.current = result.interview_id;
      endedRef.current = false;
      setUploading(false);
      setPhase("permissions");
    } catch {
      setFormErr("Something went wrong uploading your CV. Please try again.");
      setUploading(false);
    }
  }

  /* ----- voice ----- */
  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus("Voice input needs Chrome. Please open this in Chrome."); return; }
    clearAnswerWindow();
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    isRecordingRef.current = true;
    recRef.current = rec;
    setMicState("listening");
    setTranscript("");
    setStatus("Listening… just stop speaking when you're done.");

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      setTranscript((finalRef.current + interim).trim() || "…");
      if (isRecordingRef.current) armSilence();
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      isRecordingRef.current = false;
      clearSilence();
      setStatus("Mic error (" + event.error + "). Tap the mic to try again.");
      setMicState("ready");
    };
    rec.onend = () => {
      if (isRecordingRef.current) { try { rec.start(); } catch {} }
      else finishAnswer();
    };

    try { rec.start(); armSilence(); }
    catch {
      isRecordingRef.current = false;
      setStatus("Couldn't start the mic. Tap to try again.");
      setMicState("ready");
    }
  }

  function stopRecording() {
    isRecordingRef.current = false;
    clearSilence();
    try { recRef.current && recRef.current.stop(); } catch {}
  }

  function tapMic() {
    if (micRef.current === "listening") { stopRecording(); return; }
    if (micRef.current === "ready") startRecording();
  }

  async function finishAnswer() {
    if (submittingRef.current || endedRef.current) return;
    submittingRef.current = true;
    clearSilence();
    const spoken = (finalRef.current || "").trim();
    if (!spoken) {
      setStatus("I didn't catch that — tap the mic and try again.");
      setMicState("ready");
      submittingRef.current = false;
      startAnswerWindow();
      return;
    }
    setTranscript(spoken);
    setStatus("Evaluating your answer…");
    setMicState("processing");
    try {
      const result = await callEngine(spoken);
      await afterTurn(result);
    } catch {
      setStatus("Something went wrong. Tap the mic to retry.");
      setMicState("ready");
      startAnswerWindow();
    }
    submittingRef.current = false;
  }

  const pct = totalQ ? Math.min(100, Math.round((qNum / totalQ) * 100)) : 0;

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Bars n={4} />
          <b className="font-serif text-[22px] font-semibold tracking-tight text-ink">Probe</b>
        </Link>
        <Link href="/" className="text-sm text-muted transition hover:text-ink">Exit</Link>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 pb-16">
        {phase === "form" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
            <h1 className="font-serif text-3xl font-semibold text-ink">Start your interview</h1>
            <p className="mt-2 text-muted">A short voice interview, scored against the role. Have your CV ready as a PDF.</p>

            <form onSubmit={submitCV} className="mt-7 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent" placeholder="you@email.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Role</label>
                <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded-lg border border-line bg-card2 px-3 py-2.5 text-ink outline-none transition focus:border-accent">
                  {jobs.map((j) => (<option key={j.id} value={j.id}>{j.title}</option>))}
                </select>
                {jobsErr && <p className="mt-1 text-sm text-fail">{jobsErr}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Your CV (PDF)</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-line-strong px-4 py-4 text-sm text-muted transition hover:border-accent">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><UploadIcon /></span>
                  <span className="truncate">{fileName || "Click to attach your CV (PDF)"}</span>
                  <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setFileName((e.target.files && e.target.files[0] && e.target.files[0].name) || "")} />
                </label>
              </div>
              {formErr && <p className="text-sm text-fail">{formErr}</p>}
              <button type="submit" disabled={uploading} className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
                {uploading ? "Uploading and processing…" : "Continue"}
              </button>
              <p className="text-center text-xs text-faint">This interview is proctored — camera, microphone, and screen are recorded for review.</p>
            </form>
          </motion.div>
        )}

        {phase === "permissions" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-8">
            <h1 className="font-serif text-3xl font-semibold text-ink">Before we begin</h1>
            <p className="mt-2 text-muted">This interview is proctored. Please allow all of the following to continue — they stay on for the whole interview.</p>

            <div className="mt-6 space-y-3">
              <PermRow label="Camera & microphone" desc="To verify it's you and record your responses." ok={camOk} onGrant={requestCam} />
              <PermRow label="Screen recording" desc="Share your entire screen for the duration of the interview." ok={screenOk} onGrant={requestScreen} />
            </div>

            {camOk && (
              <div className="mt-5">
                <div className="mb-1.5 text-xs font-medium text-faint">Camera preview</div>
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full max-w-xs rounded-xl border border-line bg-black object-cover" />
              </div>
            )}

            {permErr && <p className="mt-4 text-sm text-fail">{permErr}</p>}

            <button onClick={proceedToInterview} disabled={!(camOk && screenOk)} className="mt-6 w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50">
              {camOk && screenOk ? "Continue to interview" : "Grant all permissions to continue"}
            </button>
          </motion.div>
        )}

        {phase === "interview" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full">
            <div className="mb-8">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">{qNum ? `Question ${qNum} of ${totalQ}` : "Preparing…"}</span>
                {overallLeft !== null && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${overallLeft <= 60 ? "bg-fail/15 text-fail" : "bg-card2 text-muted"}`}>
                    <ClockIcon /> {fmt(overallLeft)} left
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-line">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="glass rounded-3xl p-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
                {speaking ? <Bars n={5} /> : <span className="h-2 w-2 rounded-full bg-accent" />}
                {speaking ? "Interviewer speaking…" : "Interviewer"}
              </div>
              <p className="font-serif text-2xl leading-relaxed text-ink">{question || "…"}</p>

              <div className="mt-10 flex flex-col items-center">
                <button onClick={tapMic} disabled={mic === "disabled" || mic === "processing"} aria-label="Microphone"
                  className={`relative grid h-24 w-24 place-items-center rounded-full text-accent-ink shadow-lg shadow-accent/30 transition disabled:opacity-50 ${mic === "listening" ? "bg-accent-bright" : "bg-accent"}`}>
                  {mic === "listening" && (
                    <motion.span className="absolute inset-0 rounded-full border-2 border-accent/50"
                      animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }} />
                  )}
                  {mic === "listening" ? <StopIcon /> : <MicIcon />}
                </button>
                <p className="mt-5 min-h-[20px] max-w-sm text-sm text-muted">{status}</p>
                {mic === "ready" && answerLeft !== null && (
                  <p className="mt-1 text-xs font-medium text-pend">Begin answering within {answerLeft}s</p>
                )}
              </div>

              {(transcript || mic === "listening") && (
                <div className="mt-6 rounded-xl border border-line bg-card2 p-4 text-left">
                  <div className="mb-1 text-xs font-medium text-faint">Your answer</div>
                  <p className="text-sm leading-relaxed text-ink">{transcript || "…"}</p>
                </div>
              )}
            </div>

            {/* live proctoring preview */}
            <div className="fixed bottom-4 right-4 z-30">
              <video ref={videoRef} autoPlay muted playsInline className="h-28 w-40 rounded-lg border border-line bg-black object-cover shadow-lg" />
              <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] font-medium text-fail">
                <span className="h-1.5 w-1.5 rounded-full bg-fail" /> Recording
              </div>
            </div>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-3xl p-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><CheckIcon /></div>
            <h1 className="mt-6 font-serif text-3xl font-semibold text-ink">Interview complete</h1>
            <p className="mt-3 text-muted">Thank you. Your responses have been scored and a summary has been emailed to you. The hiring team will review your results.</p>
            <Link href="/" className="mt-8 inline-block rounded-xl bg-accent px-7 py-3 font-semibold text-accent-ink transition hover:brightness-110">Back to home</Link>
          </motion.div>
        )}
      </div>
    </main>
  );
}