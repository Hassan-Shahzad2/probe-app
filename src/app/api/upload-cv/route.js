const BASE = process.env.N8N_WEBHOOK_BASE;

export async function POST(request) {
  try {
    const form = await request.formData();
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