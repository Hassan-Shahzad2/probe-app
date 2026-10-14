const BASE = process.env.N8N_WEBHOOK_BASE;

export async function POST(request) {
  try {
    const body = await request.json();
    const r = await fetch(`${BASE}/interview-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(body),
    });
    let raw = await r.text();
    if (raw.startsWith("=")) raw = raw.slice(1);
    return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return Response.json({ error: "Turn failed." }, { status: 502 });
  }
}