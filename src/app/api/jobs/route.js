import { createClient } from "@supabase/supabase-js";

// Jobs now come straight from Supabase (so the new time_limit_minutes field flows
// through to the candidate screen). n8n still handles the interview itself.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET() {
  try {
    const { data, error } = await admin
      .from("jobs")
      .select("id,title,description,num_questions,time_limit_minutes")
      .order("title", { ascending: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data || []);
  } catch (e) {
    return Response.json({ error: "Could not load roles." }, { status: 502 });
  }
}