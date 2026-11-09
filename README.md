# Probe — AI Interview Screener with Interactive Voice Probe

**Probe is an AI that conducts a voice interview on its own.** A candidate uploads their CV and picks a role; Probe asks spoken questions grounded in *their* CV, listens to the answers, transcribes and scores them fairly, produces a final report, emails the candidate, and gives recruiters a ranked, proctored shortlist.

**Live:** [probe-app-pi.vercel.app](https://probe-app-pi.vercel.app)

> Built during a 4-week AI Engineering & Automation internship at **The Techzeen**, by **Muhammad Hassan Shahzad**.

---

## What it does

- **Voice interview, grounded in the CV** — questions are drawn from the candidate's own resume using Retrieval-Augmented Generation (RAG), not generic templates.
- **Fair, explainable scoring** — each answer is scored on independent dimensions (technical accuracy, depth, communication) and the overall score is a transparent weighted formula, so a fluent-but-wrong answer can't inflate the result (the "halo effect").
- **Proctoring** — camera and full-screen recording during the interview, replayable by recruiters.
- **Recruiter dashboard** — scored candidates ranked against each role, with the full transcript, sub-scores, and recordings.
- **Admin panel** — create and manage roles, set the number of questions and a time limit per role.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, JavaScript, Tailwind CSS |
| Orchestration | n8n (9 webhook-triggered workflows) |
| Database / Auth / Storage | Supabase (Postgres, Auth, Storage) |
| Vector store (RAG) | Pinecone |
| AI | OpenAI — gpt-4o-mini, Whisper (speech-to-text), TTS (interviewer voice), embeddings |
| Rate limiting | Upstash Redis |
| Bot protection | Cloudflare Turnstile |
| Hosting | Vercel |

---

## Architecture

```
          Browser (candidate / recruiter / admin)
                        │  HTTPS — only ever talks to Probe's own API
                        ▼
      ┌─────────────────────────────────────────────┐
      │   Next.js on Vercel                          │
      │   • Pages (candidate, hr, admin, login …)    │
      │   • Server API routes (a secure proxy)       │
      │   • middleware (rate limiting)               │
      └───────┬─────────────────┬───────────────┬────┘
              │ proxy           │ direct        │ direct
              ▼                 ▼               ▼
        n8n engine        OpenAI API        Supabase
     (9 workflows)     (Whisper, TTS,   (Postgres, Auth,
                        gpt-4o-mini)      Storage)
              │
              ▼
          Pinecone (CV vectors for RAG)
```

The browser never talks to the backend directly — it only calls Probe's own server-side API routes, which hold the secrets and talk to n8n, OpenAI, and Supabase privately.

---

## How it works

1. **Apply** — the candidate submits their details and CV (behind a CAPTCHA). The CV is chunked, embedded, and stored in Pinecone under that candidate's own namespace.
2. **Consent** — the candidate grants camera, microphone, and screen access; recording begins.
3. **Interview** — for each question, Probe retrieves the most relevant CV chunks (RAG), the AI asks a grounded question (spoken via OpenAI TTS), and the candidate's spoken answer is transcribed with Whisper.
4. **Score** — each answer is scored on independent dimensions; the overall score is computed deterministically in code.
5. **Report** — a final report (overall + sub-scores + recommendation + summary) is generated, saved, and emailed to the candidate.
6. **Review** — recruiters open the dashboard to see the ranked candidate, transcript, and recordings.

---

## Security

Layered defenses, each for a different threat:

- **Server-side proxy architecture** — API keys and backend URLs never reach the browser.
- **Real authentication & authorization** — Supabase Auth with role-based access; admin actions verify the JWT server-side (not just hidden UI).
- **Role-scoped login** — wrong-role credentials are rejected, not forwarded.
- **Rate limiting** — per-endpoint limits in Upstash Redis (shared across serverless instances), with an in-memory fallback.
- **CAPTCHA** — Cloudflare Turnstile, verified server-side, protects the expensive interview pipeline from bots.
- **Prompt-injection defense** — the CV and every answer are treated strictly as data; instructions hidden inside them are ignored.
- **Secrets isolation** — all keys live in environment variables, never committed.

---

## Author

**Muhammad Hassan Shahzad** — built as the capstone project of a 4-week AI Engineering & Automation internship at The Techzeen.

*Probe screens candidates fairly and saves recruiters time — it produces the evidence; the hiring decision stays with people.*
