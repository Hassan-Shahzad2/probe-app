// Transcribes a candidate's answer audio with OpenAI Whisper.
// The OpenAI key stays server-side (never reaches the browser).

export async function POST(req) {
  try {
    const inForm = await req.formData();
    const file = inForm.get("file");
    if (!file) return Response.json({ error: "No audio provided." }, { status: 400 });

    const out = new FormData();
    out.append("file", file, "answer.webm");
    out.append("model", "whisper-1");
    // No "language" set on purpose -> Whisper auto-detects (handles English, Urdu,
    // and code-switching between them). Transcription keeps the original language.

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: out,
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return Response.json({ error: (data.error && data.error.message) || "Transcription failed." }, { status: 500 });
    }
    return Response.json({ text: (data.text || "").trim() });
  } catch (e) {
    return Response.json({ error: "Transcription failed." }, { status: 500 });
  }
}