"use client";

import { useEffect, useRef, useState } from "react";

const PEEK_MS = 1500; // how long a quick click reveals the password before auto-hiding

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// A password field with a peek toggle:
//  • quick click  -> reveal for ~1.5s, then auto-hide
//  • press & hold  -> revealed while held, hides on release
export default function PasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "current-password",
  className = "",
}) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const downAt = useRef(0);
  const active = useRef(false);        // true while a pointer is held down on the eye
  const pointerHandled = useRef(false); // so a pointer tap doesn't also fire the keyboard onClick path

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  function clearHideTimer() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }
  function peek() {
    clearHideTimer();
    setVisible(true);
    hideTimer.current = setTimeout(() => { setVisible(false); hideTimer.current = null; }, PEEK_MS);
  }

  function onPointerDown(e) {
    e.preventDefault();           // keep focus on the input (don't blur to the button)
    pointerHandled.current = true;
    active.current = true;
    downAt.current = Date.now();
    clearHideTimer();
    setVisible(true);             // reveal immediately (covers the "hold" case)
  }
  function finishPointer() {
    if (!active.current) return;
    active.current = false;
    const held = Date.now() - downAt.current;
    if (held < 250) peek();       // treated as a quick click -> peek for ~1.5s
    else { clearHideTimer(); setVisible(false); } // was a hold -> hide on release
  }
  function onClick() {
    // keyboard (Enter/Space) path only — pointer taps are handled above
    if (pointerHandled.current) { pointerHandled.current = false; return; }
    peek();
  }

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-line bg-card2 px-3 py-2.5 pr-11 text-ink outline-none transition focus:border-accent ${className}`}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onPointerDown={onPointerDown}
        onPointerUp={finishPointer}
        onPointerLeave={finishPointer}
        onPointerCancel={finishPointer}
        onClick={onClick}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-faint transition hover:text-ink"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}