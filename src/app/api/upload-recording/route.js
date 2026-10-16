import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const interviewId = form.get("interview_id");
    const kind = form.get("kind");

    console.log("[upload-recording] got:", { kind, interviewId, hasFile: !!file, size: file && file.size });

    if (!file || !interviewId || (kind !== "camera" && kind !== "screen")) {
      console.log("[upload-recording] bad request");
      return Response.json({ error: "Missing file, interview_id, or kind." }, { status: 400 });
    }

    const path = `${interviewId}/${kind}.webm`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("recordings")
      .upload(path, buffer, { contentType: "video/webm", upsert: true });

    if (error) {
      console.error("[upload-recording] supabase error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    console.log("[upload-recording] uploaded OK:", path);
    return Response.json({ ok: true, path });
  } catch (e) {
    console.error("[upload-recording] threw:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}