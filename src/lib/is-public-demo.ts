import "server-only";

/** True on the deployed Groq-backed production build, where the public
 * one-analysis-per-visitor rate limit applies. False in local development
 * (Anthropic-backed, unlimited) — there, this is the full tool, not a
 * "demo", and copy should say so. */
export function isPublicDemo(): boolean {
  return process.env.AI_PROVIDER === "groq";
}
