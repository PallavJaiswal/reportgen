import "server-only";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "rg_usage";
const WINDOW_SECONDS = 60 * 60 * 24; // 24h — generous enough that a demo visitor won't come back same-day and get a free reset

function getLimit(): number {
  const raw = process.env.RATE_LIMIT_PER_USER;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export type RateLimitStatus = {
  limited: boolean;
  /** Pass to applyRateLimitCookie after a successful (non-canned) AI call to
   * record this use. Not incremented for requests that were already over
   * the limit, since those never call the real provider. */
  nextCount: number;
};

/** Tracks visitor usage with a cookie instead of a shared server-side store
 * (Redis/KV) — no external service to provision. This is a demo-cost
 * boundary, not a security control: clearing cookies or an incognito window
 * resets it, which is an accepted trade-off for a portfolio project. Only
 * ever applies to the Groq/production path — local Anthropic dev is always
 * unlimited. */
export function getRateLimitStatus(req: NextRequest): RateLimitStatus {
  if (process.env.AI_PROVIDER !== "groq") return { limited: false, nextCount: 0 };

  const raw = req.cookies.get(COOKIE_NAME)?.value;
  const parsed = raw ? Number(raw) : 0;
  const current = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

  return { limited: current >= getLimit(), nextCount: current + 1 };
}

/** Records a use on the outgoing response. Only call this after a
 * successful real AI call — never for a canned/already-limited response. */
export function applyRateLimitCookie(response: NextResponse, status: RateLimitStatus): void {
  if (process.env.AI_PROVIDER !== "groq") return;
  response.cookies.set(COOKIE_NAME, String(status.nextCount), {
    maxAge: WINDOW_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
