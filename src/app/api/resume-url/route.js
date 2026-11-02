import { createClient } from "@supabase/supabase-js";

// Server-only: uses the service key so the resumes bucket can stay private.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Returns a short-lived signed download link for a candidate's stored CV.
// The link expires in 60 seconds and forces a file download (not inline view).
export async function POST(req) {
  try {
    const { candidate_id, filename } = await req.json();
    if (!candidate_id) {
      return Response.json({ error: "Missing candidate." }, { status: 400 });
    }

    const safe = String(filename || "candidate-cv").replace(/[^a-z0-9._-]+/gi, "_");
    const { data, error } = await admin.storage
      .from("resumes")
      .createSignedUrl(`${candidate_id}.pdf`, 60, { download: `${safe}.pdf` });

    if (error || !data || !data.signedUrl) {
      return Response.json({ error: "No CV file found for this candidate." }, { status: 404 });
    }
    return Response.json({ url: data.signedUrl });
  } catch {
    return Response.json({ error: "Could not get the CV." }, { status: 500 });
  }
}