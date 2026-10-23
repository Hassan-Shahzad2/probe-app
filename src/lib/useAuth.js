"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Guards a page: requires a logged-in user, optionally with a specific role.
// Returns { status: "loading" | "ready", user, role }.
export function useRequireRole(requiredRole) {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading", user: null, role: null });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) { router.replace("/login" + (requiredRole ? "?role=" + requiredRole : "")); return; }
      const role = session.user?.app_metadata?.role || null;
      if (requiredRole && role !== requiredRole) {
        // logged in but wrong area → show an access-denied screen (no silent redirect)
        setState({ status: "denied", user: session.user, role });
        return;
      }
      setState({ status: "ready", user: session.user, role });
    })();
    return () => { active = false; };
  }, [requiredRole, router]);

  return state;
}