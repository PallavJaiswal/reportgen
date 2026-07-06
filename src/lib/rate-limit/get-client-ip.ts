import type { NextRequest } from "next/server";

/** Best-effort IP extraction — acceptable for a demo boundary, not meant to
 * be bulletproof (see project-brief.md §4). Vercel sets x-forwarded-for. */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
