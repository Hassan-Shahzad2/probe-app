import { createClient } from "@supabase/supabase-js";

const BASE = process.env.N8N_WEBHOOK_BASE;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

// Server-only admin client (service key). Used to store the CV file privately.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Verifies the CAPTCHA token with Cloudflare. Returns true if the submitter
// is a verified human (or if Turnstile isn't configured, e.g. in local dev).
async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return true; // not set up -> skip (keeps dev working)
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.append("secret", TURNSTILE_SECRET);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    return !!data.success;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();

    // --- CAPTCHA: prove a real human, not a bot/script ---
    const token = form.get("captcha_token");
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const human = await verifyTurnstile(token, ip);
    if (!human) {
      return Response.json(
        { error: "Verification failed. Please complete the check and try again." },
        { status: 403 }
      );
    }
    form.delete("captcha_token"); // don't forward the token to n8n

    // Grab the uploaded PDF now (keep our own copy of the bytes) so we can
    // store it after n8n gives us the candidate id. This does not stop the
    // same file from also being forwarded to n8n below.
    let pdfBytes = null;
    for (const [, v] of form.entries()) {
      if (v && typeof v === "object" && typeof v.arrayBuffer === "function" && v.name) {
        pdfBytes = new Uint8Array(await v.arrayBuffer());
        break;
      }
    }

    // Forward to n8n (extracts text, embeds, creates candidate + interview).
    const r = await fetch(`${BASE}/upload-cv`, {
      method: "POST",
      headers: { "ngrok-skip-browser-warning": "true" },
      body: form,
    });
    let raw = await r.text();
    if (raw.startsWith("=")) raw = raw.slice(1);

    // Save the actual PDF to private Storage, keyed by candidate id, and record
    // the path on the candidate row. This is best-effort: never fail a genuine
    // interview just because the file store had a hiccup.
    try {
      const parsed = JSON.parse(raw);
      const candidateId = parsed && parsed.candidate_id;
      if (candidateId && pdfBytes) {
        const path = `${candidateId}.pdf`;
        await admin.storage.from("resumes").upload(path, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
        await admin.from("candidates").update({ resume_url: path }).eq("id", candidateId);
      }
    } catch {
      // ignore — the interview still proceeds without a stored file
    }

    return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return Response.json({ error: "Upload failed." }, { status: 502 });
  }
}