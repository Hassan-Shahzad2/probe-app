"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

// Change this to whatever contact address you want shown for off-topic questions.
const CONTACT_EMAIL = "muhammadhassanshahzad22@gmail.com";

// Rule-based knowledge. Each rule: keywords to match, and the answer to give.
// First matching rule wins. No AI/model is called — these are fixed answers.
const RULES = [
  {
    k: ["what is probe", "about probe", "what does probe", "whats probe", "what's probe", "explain probe"],
    a: "Probe is an AI interview screener. It runs a short voice interview grounded in your CV, scores each answer against the role, and gives recruiters a ranked shortlist.",
  },
  {
    k: ["how do i", "how to", "take", "start", "begin", "give interview", "attempt"],
    a: "To take an interview: click “Start an interview” (or open the Candidate page), upload your CV as a PDF, pick the role, and allow camera, microphone and screen sharing. Probe then asks questions by voice — just speak your answers.",
  },
  {
    k: ["recruiter", "hr", "employer", "dashboard", "review candidate", "results"],
    a: "Recruiters sign in from the top-right. After signing in you can review scored candidates, read full transcripts, see the sub-scores, and play back the interview recordings on your dashboard.",
  },
  {
    k: ["admin", "create job", "add role", "question", "time limit"],
    a: "Admins sign in and open the Admin panel to create, edit or delete roles, set how many questions each interview has, and set a per-role time limit.",
  },
  {
    k: ["proctor", "record", "camera", "screen", "privacy", "watched"],
    a: "Yes — interviews are proctored. Your camera, microphone and screen are recorded during the interview so recruiters can review the session. You are asked to allow these before you begin.",
  },
  {
    k: ["mobile", "phone", "laptop", "device", "what do i need", "requirement", "requirements"],
    a: "You need a laptop or desktop with a camera and microphone, plus your CV as a PDF. The interview is not supported on phones, because it records your screen.",
  },
  {
    k: ["language", "urdu", "english", "speak"],
    a: "You can answer in English or Urdu — Probe transcribes both automatically and judges your answer on its meaning, not on accent or grammar.",
  },
  {
    k: ["score", "scoring", "scored", "judge", "evaluate", "fair"],
    a: "Each answer is scored on technical accuracy, depth and communication — independently, so one strong trait doesn't inflate the others. The overall score is a transparent weighted blend of those.",
  },
  {
    k: ["cost", "price", "free", "pay", "pricing"],
    a: "This is a university project demo, so there is nothing to pay. For anything else, feel free to get in touch by email.",
  },
];

const GREETING =
  "Hi, I'm the Probe guide. Ask me anything about how Probe works — taking an interview, recruiter access, proctoring, and more.";

const SUGGESTIONS = [
  "What is Probe?",
  "How do I take an interview?",
  "I'm a recruiter",
  "Is it proctored?",
];

function matchReply(input) {
  const q = (input || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.k.some((kw) => q.includes(kw))) return { text: rule.a };
  }
  return {
    text: "I can only help with questions about Probe. For anything else, please email us.",
    email: true,
  };
}

function TalkingBars() {
  // A clean robot mark (not an emoji). Uses currentColor so it stays on-brand.
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="8" width="15" height="11" rx="3" />
      <path d="M12 4.2V8" />
      <circle cx="12" cy="3.3" r="1.1" fill="currentColor" stroke="none" />
      <path d="M2.6 12.5v2.5M21.4 12.5v2.5" />
      <circle cx="9.2" cy="13" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="13" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.5 16.3h5" />
    </svg>
  );
}

function Typing() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export default function SiteGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([{ role: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function ask(text) {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setTyping(true);
    timerRef.current = setTimeout(() => {
      const reply = matchReply(q);
      setTyping(false);
      setMessages((m) => [...m, { role: "bot", ...reply }]);
    }, 650);
  }

  // Only show the guide on the main (landing) page.
  if (pathname !== "/") return null;

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Probe guide" : "Open Probe guide"}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink shadow-xl shadow-accent/30 transition hover:scale-105 sm:bottom-6 sm:right-6"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <TalkingBars />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-5 z-50 flex h-[480px] max-h-[72vh] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:right-6"
          >
            {/* header */}
            <div className="flex items-center gap-3 bg-accent px-4 py-3.5 text-accent-ink">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                <TalkingBars />
              </span>
              <div className="leading-tight">
                <div className="font-serif text-lg font-semibold">Probe guide</div>
                <div className="text-xs opacity-80">Answers about how Probe works</div>
              </div>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[82%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-sm text-accent-ink"
                        : "max-w-[85%] rounded-2xl rounded-bl-sm bg-card2 px-3.5 py-2.5 text-sm text-ink"
                    }
                  >
                    {m.text}
                    {m.email && (
                      <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="mt-2 block break-all font-medium text-accent underline underline-offset-2"
                      >
                        {CONTACT_EMAIL}
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-card2 px-3.5 py-2">
                    <Typing />
                  </div>
                </div>
              )}
            </div>

            {/* suggestions */}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* input */}
            <form
              onSubmit={(e) => { e.preventDefault(); ask(); }}
              className="flex items-center gap-2 border-t border-line px-3 py-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Probe…"
                className="flex-1 rounded-full border border-line bg-card2 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
              />
              <button
                type="submit"
                aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:brightness-110 disabled:opacity-50"
                disabled={!input.trim() || typing}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}