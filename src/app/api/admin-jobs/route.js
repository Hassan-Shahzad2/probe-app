import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Verify the caller is a logged-in ADMIN by checking their Supabase JWT server-side.
// This is real protection — not just the client-side route guard.
async function requireAdmin(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user || data.user.app_metadata?.role !== "admin") return null;
  return data.user;
}

function clean(body) {
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  let num = parseInt(body.num_questions, 10);
  if (!Number.isFinite(num) || num < 1) num = 3;
  if (num > 15) num = 15;
  let mins = body.time_limit_minutes;
  mins = mins === "" || mins == null ? null : parseInt(mins, 10);
  if (mins != null && (!Number.isFinite(mins) || mins < 1)) mins = null;
  return { title, description, num_questions: num, time_limit_minutes: mins };
}

export async function POST(req) {
  if (!(await requireAdmin(req))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const row = clean(body);
  if (!row.title) return Response.json({ error: "Title is required." }, { status: 400 });
  const { data, error } = await admin.from("jobs").insert(row).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function PATCH(req) {
  if (!(await requireAdmin(req))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.id) return Response.json({ error: "Missing id." }, { status: 400 });
  const row = clean(body);
  if (!row.title) return Response.json({ error: "Title is required." }, { status: 400 });
  const { data, error } = await admin.from("jobs").update(row).eq("id", body.id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(req) {
  if (!(await requireAdmin(req))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  const { error } = await admin.from("jobs").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}