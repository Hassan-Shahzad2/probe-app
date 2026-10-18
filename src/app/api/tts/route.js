// Generates the interviewer's voice with OpenAI TTS. Key stays server-side.
export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text || !text.trim()) return Response.json({ error: "No text." }, { status: 400 });

    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",          // fast + cheap; "tts-1-hd" is higher quality at ~2x cost
        voice: "nova",           // warm, clear. others: alloy, echo, fable, onyx, shimmer
        input: text,
        response_format: "mp3",
      }),
    });

    if (!r.ok) return Response.json({ error: "TTS failed." }, { status: 500 });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: "TTS failed." }, { status: 500 });
  }
}