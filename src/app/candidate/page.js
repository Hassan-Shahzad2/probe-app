"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";

const ANSWER_WINDOW = 7;      // seconds to BEGIN answering before the question repeats
const SILENCE_MS = 2500;      // stop the answer after this much silence once they've spoken
const VOICE_THRESHOLD = 0.02; // mic loudness (0..1) above which counts as speaking
const MAX_ANSWER_MS = 90000;  // hard cap on a single answer

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
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
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
  const timeLimitRef = useRef(null); // admin-set minutes for the selected role (null = auto)
  const [speaking, setSpeaking] = useState(false);
  const [mic, setMic] = useState("idle"); // idle|disabled|ready|listening|processing
  const micRef = useRef("idle");
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");
  const voicesRef = useRef([]);
  const ttsAudioRef = useRef(null);

  // timers
  const [answerLeft, setAnswerLeft] = useState(null);
  const [overallLeft, setOverallLeft] = useState(null);
  const answerTickRef = useRef(null);
  const overallTickRef = useRef(null);
  const repeatedRef = useRef(false);
  const endedRef = useRef(false);

  const lastQuestionRef = useRef("");
  const isRecordingRef = useRef(false);
  const submittingRef = useRef(false);

  // Whisper answer capture
  const answerRecRef = useRef(null);
  const answerChunksRef = useRef([]);
  const vadCtxRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const lastLoudRef = useRef(0);

  // proctoring recorders (camera records video+audio; screen records video + mixed audio)
  const camRecRef = useRef(null);
  const screenRecRef = useRef(null);
  const camChunksRef = useRef([]);
  const screenChunksRef = useRef([]);
  const screenAudioCtxRef = useRef(null);

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

  // load the list of TTS voices (populates asynchronously in the browser)
  useEffect(() => {
    function load() { try { voicesRef.current = window.speechSynthesis.getVoices() || []; } catch {} }
    load();
    try { window.speechSynthesis.onvoiceschanged = load; } catch {}
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {} };
  }, []);

  // keep the live camera preview wired up across phases
  useEffect(() => {
    if ((phase === "permissions" || phase === "interview") && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase, camOk]);

  useEffect(() => () => {
    endedRef.current = true; // stop the interview loop if the candidate leaves mid-way
    try { window.speechSynthesis.cancel(); } catch {}
    stopTts();
    isRecordingRef.current = false;
    try { answerRecRef.current && answerRecRef.current.state !== "inactive" && answerRecRef.current.stop(); } catch {}
    stopSilenceWatch();
    if (answerTickRef.current) clearInterval(answerTickRef.current);
    if (overallTickRef.current) clearInterval(overallTickRef.current);
    try { camStreamRef.current && camStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    try { screenStreamRef.current && screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    try { const a = screenAudioCtxRef.current; screenAudioCtxRef.current = null; if (a && a.state !== "closed") a.close().catch(() => {}); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- permissions ----- */
  async function requestCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // keep BOTH video and audio: the mic audio is used for proctoring AND for the
      // per-answer recording that gets transcribed by Whisper.
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
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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

  /* ----- proctoring recording ----- */
  function recorderMime() {
    const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const t of types) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t; } catch {}
    }
    return "";
  }
  function startOneRecorder(stream, ref, chunksRef) {
    if (!stream) return;
    chunksRef.current = [];
    let rec;
    const mime = recorderMime();
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1000000 }) : new MediaRecorder(stream); }
    catch { try { rec = new MediaRecorder(stream); } catch { return; } }
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    ref.current = rec;
    try { rec.start(1000); } catch {} // flush a chunk every second
  }
  // screen recording = screen video + (system audio AI voice + candidate mic), mixed.
  function buildScreenRecordStream() {
    const screen = screenStreamRef.current;
    if (!screen) return null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const sysAudio = screen.getAudioTracks();
      const micAudio = camStreamRef.current ? camStreamRef.current.getAudioTracks() : [];
      if (!AC || (!sysAudio.length && !micAudio.length)) return screen; // nothing to mix
      const ac = new AC();
      screenAudioCtxRef.current = ac;
      const dest = ac.createMediaStreamDestination();
      if (sysAudio.length) { try { ac.createMediaStreamSource(new MediaStream([sysAudio[0]])).connect(dest); } catch {} }
      if (micAudio.length) { try { ac.createMediaStreamSource(new MediaStream([micAudio[0]])).connect(dest); } catch {} }
      const out = new MediaStream();
      screen.getVideoTracks().forEach((t) => out.addTrack(t));
      dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));
      return out;
    } catch {
      return screen;
    }
  }
  function startRecorders() {
    startOneRecorder(camStreamRef.current, camRecRef, camChunksRef);
    startOneRecorder(buildScreenRecordStream(), screenRecRef, screenChunksRef);
  }
  function stopOneRecorder(rec) {
    return new Promise((resolve) => {
      if (!rec || rec.state === "inactive") return resolve();
      rec.onstop = () => resolve();
      try { rec.stop(); } catch { resolve(); }
    });
  }
  async function uploadOne(kind, chunksRef) {
    const chunks = chunksRef.current || [];
    if (!chunks.length || !interviewIdRef.current) return;
    const blob = new Blob(chunks, { type: "video/webm" });
    const fd = new FormData();
    fd.append("file", blob, kind + ".webm");
    fd.append("interview_id", interviewIdRef.current);
    fd.append("kind", kind);
    try { await fetch("/api/upload-recording", { method: "POST", body: fd }); } catch {}
  }
  async function stopRecordersAndUpload() {
    try { await Promise.all([stopOneRecorder(camRecRef.current), stopOneRecorder(screenRecRef.current)]); } catch {}
    try { await Promise.all([uploadOne("camera", camChunksRef), uploadOne("screen", screenChunksRef)]); } catch {}
  }

  function proceedToInterview() {
    if (!(camOk && screenOk)) return;
    setPhase("interview");
    startRecorders();
    startOverallTimer(totalQRef.current);
    startInterview();
  }

  function pickVoice() {
    const voices = voicesRef.current || [];
    const prefer = [
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Jenny Online (Natural) - English (United States)",
      "Google US English",
      "Google UK English Female",
      "Samantha",
    ];
    for (const name of prefer) { const v = voices.find((x) => x.name === name); if (v) return v; }
    return voices.find((x) => /en[-_]?US/i.test(x.lang) && /google|natural/i.test(x.name))
        || voices.find((x) => /en[-_]?(US|GB)/i.test(x.lang))
        || null;
  }
  function browserSpeak(text) {
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice();
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
        u.rate = 1;
        u.pitch = 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  }
  function stopTts() {
    try { const a = ttsAudioRef.current; if (a) { a.pause(); a.src = ""; } } catch {}
    ttsAudioRef.current = null;
  }
  async function speak(text, onStart) {
    stopTts();
    try { window.speechSynthesis.cancel(); } catch {}
    let started = false;
    const fireStart = () => { if (!started) { started = true; try { onStart && onStart(); } catch {} } };
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error("tts");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      await new Promise((resolve) => {
        const audio = new Audio(url);
        ttsAudioRef.current = audio;
        const done = () => { try { URL.revokeObjectURL(url); } catch {} resolve(); };
        audio.onended = done;
        audio.onerror = done;
        audio.onplaying = fireStart;
        audio.play().then(fireStart).catch(done);
      });
    } catch {
      fireStart();
      await browserSpeak(text); // fallback if OpenAI TTS is unavailable
    }
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

  /* ----- silence detection (Web Audio VAD) ----- */
  function stopSilenceWatch() {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    const ac = vadCtxRef.current;
    vadCtxRef.current = null;
    if (ac && ac.state !== "closed") { try { ac.close().catch(() => {}); } catch {} }
  }
  function startSilenceWatch(stream) {
    stopSilenceWatch();
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      vadCtxRef.current = ac;
      try { ac.resume(); } catch {}
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let spoke = false;
      const startT = Date.now();
      lastLoudRef.current = startT;
      vadIntervalRef.current = setInterval(() => {
        if (!isRecordingRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; sum += x * x; }
        const rms = Math.sqrt(sum / data.length);
        const now = Date.now();
        if (rms > VOICE_THRESHOLD) { spoke = true; lastLoudRef.current = now; }
        if (now - startT > MAX_ANSWER_MS) { stopRecording(); return; }
        if (spoke && now - lastLoudRef.current > SILENCE_MS) { stopRecording(); }
      }, 150);
    } catch {}
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
    const total = timeLimitRef.current ? Math.max(60, timeLimitRef.current * 60) : Math.max(60, numQ * 120);
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
    stopSilenceWatch();
    if (overallTickRef.current) { clearInterval(overallTickRef.current); overallTickRef.current = null; }
  }

  async function endInterview(message) {
    endedRef.current = true;
    isRecordingRef.current = false;
    try { answerRecRef.current && answerRecRef.current.state !== "inactive" && answerRecRef.current.stop(); } catch {}
    stopAllTimers();
    finalizeInterview();
    setMicState("disabled");
    setQuestion("");                 // hidden until the voice is ready, so text + voice land together
    setStatus("Preparing…");
    setSpeaking(true);
    await speak(message.spoken, () => { setQuestion(message.q); setStatus(""); });
    setSpeaking(false);
    setPhase("done");
    await stopRecordersAndUpload();
    try { camStreamRef.current && camStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    try { screenStreamRef.current && screenStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
    try { const a = screenAudioCtxRef.current; screenAudioCtxRef.current = null; if (a && a.state !== "closed") a.close().catch(() => {}); } catch {}
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
    setQuestion(""); // keep it hidden until the voice is ready, so they land together
    setTranscript("");
    clearAnswerWindow();
    setMicState("disabled");
    setSpeaking(true);
    setStatus("Preparing the question…");
    await speak(text, () => { setQuestion(text); setStatus(""); });
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

  // Cloudflare Turnstile: load the script once, render the widget while on the form.
  useEffect(() => {
    if (phase !== "form") return;
    const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!SITE_KEY) return;

    function renderWidget() {
      if (!turnstileRef.current || !window.turnstile) return;
      if (widgetIdRef.current !== null) return; // already rendered
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById("cf-turnstile-script");
      if (!existing) {
        const s = document.createElement("script");
        s.id = "cf-turnstile-script";
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        s.async = true;
        s.defer = true;
        s.onload = renderWidget;
        document.head.appendChild(s);
      } else {
        existing.addEventListener("load", renderWidget);
      }
    }

    return () => {
      try {
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {}
      widgetIdRef.current = null;
    };
  }, [phase]);

  async function submitCV(e) {
    e.preventDefault();
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!name.trim() || !email.trim() || !file) {
      setFormErr("Please add your name, email, and attach a PDF.");
      return;
    }
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setFormErr("Please complete the verification check below the form.");
      return;
    }
    const job = jobs.find((j) => j.id === jobId);
    const numQ = job ? (job.num_questions ?? 3) : 3;
    setTotalQ(numQ);
    totalQRef.current = numQ;
    askedRef.current = 0;
    timeLimitRef.current = job && job.time_limit_minutes ? Number(job.time_limit_minutes) : null;
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
    fd.append("captcha_token", captchaToken);

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
      try { if (widgetIdRef.current !== null && window.turnstile) window.turnstile.reset(widgetIdRef.current); } catch {}
      setCaptchaToken("");
    }
  }

  /* ----- voice (record -> Whisper) ----- */
  function answerMime() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (const t of types) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t; } catch {} }
    return "";
  }
  function startRecording() {
    const cam = camStreamRef.current;
    const audioTracks = cam ? cam.getAudioTracks() : [];
    if (!window.MediaRecorder || !audioTracks.length) { setStatus("Microphone isn't available. Please refresh and allow the mic."); return; }
    clearAnswerWindow();
    const audioStream = new MediaStream(audioTracks);
    answerChunksRef.current = [];
    let rec;
    const mime = answerMime();
    try { rec = mime ? new MediaRecorder(audioStream, { mimeType: mime }) : new MediaRecorder(audioStream); }
    catch { try { rec = new MediaRecorder(audioStream); } catch { setStatus("Couldn't start the mic. Tap to try again."); return; } }
    answerRecRef.current = rec;
    isRecordingRef.current = true;
    setMicState("listening");
    setTranscript("");
    setStatus("Listening… just stop speaking when you're done.");
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) answerChunksRef.current.push(e.data); };
    rec.onstop = () => { transcribeAndFinish(); };
    try { rec.start(); }
    catch {
      isRecordingRef.current = false;
      setStatus("Couldn't start the mic. Tap to try again.");
      setMicState("ready");
      return;
    }
    startSilenceWatch(audioStream);
  }

  function stopRecording() {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    stopSilenceWatch();
    try {
      if (answerRecRef.current && answerRecRef.current.state !== "inactive") answerRecRef.current.stop();
      else transcribeAndFinish();
    } catch { transcribeAndFinish(); }
  }

  function tapMic() {
    if (micRef.current === "listening") { stopRecording(); return; }
    if (micRef.current === "ready") startRecording();
  }

  async function transcribeAndFinish() {
    if (submittingRef.current || endedRef.current) return;
    submittingRef.current = true;
    stopSilenceWatch();
    const chunks = answerChunksRef.current || [];
    if (!chunks.length) {
      setStatus("I didn't catch that — tap the mic and try again.");
      setMicState("ready");
      submittingRef.current = false;
      startAnswerWindow();
      return;
    }
    setMicState("processing");
    setStatus("Transcribing your answer…");
    const blob = new Blob(chunks, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("file", blob, "answer.webm");
    let text = "";
    try {
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await r.json();
      text = (data && data.text ? data.text : "").trim();
    } catch {}
    if (endedRef.current) { submittingRef.current = false; return; }
    if (!text) {
      setStatus("I didn't catch that — tap the mic and try again.");
      setMicState("ready");
      submittingRef.current = false;
      startAnswerWindow();
      return;
    }
    setTranscript(text);
    setStatus("Evaluating your answer…");
    try {
      const result = await callEngine(text);
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
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <div ref={turnstileRef} className="flex justify-center"></div>
              )}
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