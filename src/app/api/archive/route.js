import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Service-key admin client — performs the actual update, bypassing RLS.
const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_KEY);

// Archives (soft-removes) or restores interview rows.
// Body: { access_token, password, interview_ids: [...], action: "archive" | "restore" }
// - Caller must be a signed-in HR or admin (verified via their access token).
// - Archiving (destructive-feeling) also requires re-entering the password.
// - Restoring is non-destructive, so no password is needed.
export async function POST(req) {
  try {
    const { access_token, password, interview_ids, action } = await req.json();
    const ids = Array.isArray(interview_ids) ? interview_ids.filter(Boolean) : [];
    if (!access_token || !ids.length) {
      return Response.json({ error: "Missing data." }, { status: 400 });
    }

    // Who is calling? Validate the session token server-side.
    const { data: ures, error: uerr } = await admin.auth.getUser(access_token);
    const user = ures && ures.user;
    if (uerr || !user) {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }
    const role = user.app_metadata && user.app_metadata.role;
    if (role !== "hr" && role !== "admin") {
      return Response.json({ error: "Not allowed." }, { status: 403 });
    }

    const restoring = action === "restore";

    // Removing requires the HR to confirm their own password.
    if (!restoring) {
      if (!password) {
        return Response.json({ error: "Password required." }, { status: 400 });
      }
      const tmp = createClient(SUPA_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { error: perr } = await tmp.auth.signInWithPassword({ email: user.email, password });
      if (perr) {
        return Response.json({ error: "Incorrect password." }, { status: 401 });
      }
    }

    const value = restoring ? null : new Date().toISOString();
    const { error: werr } = await admin
      .from("interviews")
      .update({ archived_at: value })
      .in("id", ids);
    if (werr) {
      return Response.json({ error: "Could not update records." }, { status: 500 });
    }

    return Response.json({ ok: true, count: ids.length });
  } catch {
    return Response.json({ error: "Request failed." }, { status: 500 });
  }
}