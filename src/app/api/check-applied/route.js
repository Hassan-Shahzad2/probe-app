import { createClient } from "@supabase/supabase-js";

// Server-only: uses the service key so no candidate data is exposed to the browser.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Returns { applied: true } if this email already has an interview for this job.
export async function POST(req) {
  try {
    const { email, job_id } = await req.json();
    if (!email || !job_id) return Response.json({ applied: false });

    // A candidate may have several candidate rows (one per CV upload) under one email.
    const { data: cands } = await admin
      .from("candidates")
      .select("id")
      .eq("email", email);

    const ids = (cands || []).map((c) => c.id);
    if (!ids.length) return Response.json({ applied: false });

    const { data: ivs } = await admin
      .from("interviews")
      .select("id")
      .in("candidate_id", ids)
      .eq("job_id", job_id)
      .limit(1);

    return Response.json({ applied: !!(ivs && ivs.length) });
  } catch (e) {
    // Fail open — never block a genuine candidate because of a check error.
    return Response.json({ applied: false });
  }
}