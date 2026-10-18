import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Redis-backed rate limiting (shared across all server instances) when Upstash
// env vars are set; otherwise falls back to a per-instance in-memory limiter.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const upstashLimiters = new Map();
function getUpstashLimiter(name, limit, windowStr) {
  if (!redis) return null;
  if (!upstashLimiters.has(name)) {
    upstashLimiters.set(
      name,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, windowStr),
        prefix: "probe:rl:" + name,
      })
    );
  }
  return upstashLimiters.get(name);
}

// ---- in-memory fallback (used if Upstash isn't configured / is unreachable) ----
const memHits = new Map();
function memAllow(key, limit, windowMs) {
  const now = Date.now();
  const rec = memHits.get(key);
  if (!rec || now > rec.resetAt) { memHits.set(key, { count: 1, resetAt: now + windowMs }); return { ok: true }; }
  if (rec.count >= limit) return { ok: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  rec.count += 1;
  return { ok: true };
}

// endpoint -> limits
function limitsFor(pathname) {
  if (pathname.startsWith("/api/upload-cv"))        return { name: "upload-cv",        limit: 10, window: "10 m", windowMs: 10 * 60 * 1000 };
  if (pathname.startsWith("/api/upload-recording")) return { name: "upload-recording", limit: 20, window: "1 m",  windowMs: 60 * 1000 };
  if (pathname.startsWith("/api/transcribe"))       return { name: "transcribe",       limit: 60, window: "1 m",  windowMs: 60 * 1000 };
  if (pathname.startsWith("/api/tts"))              return { name: "tts",              limit: 90, window: "1 m",  windowMs: 60 * 1000 };
  if (pathname.startsWith("/api/interview-turn"))   return { name: "interview-turn",   limit: 90, window: "1 m",  windowMs: 60 * 1000 };
  return { name: "default", limit: 100, window: "1 m", windowMs: 60 * 1000 };
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";

  const cfg = limitsFor(pathname);
  const key = ip + ":" + cfg.name;

  let blocked = false;
  let retryAfter = 60;

  const limiter = getUpstashLimiter(cfg.name, cfg.limit, cfg.window);
  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(key);
      if (!success) { blocked = true; retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000)); }
    } catch {
      const r = memAllow(key, cfg.limit, cfg.windowMs); // Redis hiccup -> still protect
      if (!r.ok) { blocked = true; retryAfter = r.retryAfter || 60; }
    }
  } else {
    if (memHits.size > 5000) { const now = Date.now(); for (const [k, v] of memHits) if (now > v.resetAt) memHits.delete(k); }
    const r = memAllow(key, cfg.limit, cfg.windowMs);
    if (!r.ok) { blocked = true; retryAfter = r.retryAfter || 60; }
  }

  if (blocked) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };