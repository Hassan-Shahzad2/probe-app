const BASE = process.env.N8N_WEBHOOK_BASE;

export async function POST(request) {
  try {
    const body = await request.json();
    await fetch(`${BASE}/finalize-interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(body),
    });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false }, { status: 502 });
  }
}