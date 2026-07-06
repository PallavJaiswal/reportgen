import "server-only";
import { kv } from "@vercel/kv";

const WINDOW_SECONDS = 60 * 60 * 24; // 24h — generous enough that a demo visitor won't come back same-day and get a free reset

function getLimit(): number {
  const raw = process.env.RATE_LIMIT_PER_USER;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Whether this request should be served the canned demo instead of calling
 * the real AI provider. Only ever applies to the Groq/production path —
 * local Anthropic dev is always unlimited (see project-brief.md §3-4). */
export async function isRateLimited(ip: string): Promise<boolean> {
  if (process.env.AI_PROVIDER !== "groq") return false;

  if (!kvConfigured()) {
    // Not deployed/configured yet — fail open rather than break the demo.
    console.warn("Rate limiting is enabled (AI_PROVIDER=groq) but KV is not configured; allowing request.");
    return false;
  }

  const key = `ratelimit:${ip}`;
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, WINDOW_SECONDS);
  }

  return count > getLimit();
}
