const BASE = process.env.N8N_WEBHOOK_BASE;

export async function GET() {
  try {
    const r = await fetch(`${BASE}/hr-data`, {
      headers: { "ngrok-skip-browser-warning": "true" },
      cache: "no-store",
    });
    let raw = await r.text();
    if (raw.startsWith("=")) raw = raw.slice(1);
    return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return Response.json({ error: "Could not reach the interview service." }, { status: 502 });
  }
}