import { createClient } from "@supabase/supabase-js";

// Service key = server-only. It never reaches the browser because this file
// runs on the server (an API route). Do NOT prefix it with NEXT_PUBLIC_.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(req) {
  try {
    const { interview_id, kind } = await req.json();

    if (!interview_id || (kind !== "camera" && kind !== "screen")) {
      return Response.json({ error: "Missing interview_id or kind." }, { status: 400 });
    }

    // Same deterministic path the HR page already builds its public URL from.
    const path = `${interview_id}/${kind}.webm`;

    const { data, error } = await supabase.storage
      .from("recordings")
      .createSignedUploadUrl(path, { upsert: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ path: data.path, token: data.token });
  } catch (e) {
    return Response.json({ error: "Could not sign upload." }, { status: 500 });
  }
}