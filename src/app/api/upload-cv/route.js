const BASE = process.env.N8N_WEBHOOK_BASE;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

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

    const r = await fetch(`${BASE}/upload-cv`, {
      method: "POST",
      headers: { "ngrok-skip-browser-warning": "true" },
      body: form,
    });
    let raw = await r.text();
    if (raw.startsWith("=")) raw = raw.slice(1);
    return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return Response.json({ error: "Upload failed." }, { status: 502 });
  }
}