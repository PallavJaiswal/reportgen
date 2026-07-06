import type { ExecutiveSummaryResult, ExecutiveSummarySection } from "./types";

type RawRecommendation = { title?: unknown; detail?: unknown; relatedKpi?: unknown };
type RawSection = { heading?: unknown; bullets?: unknown };

function parseIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

/** Both providers occasionally return array fields as malformed or
 * double-encoded JSON strings instead of native arrays. Recover what we can
 * rather than failing the whole summary over one bad field. */
export function coerceExecutiveSummary(input: unknown): ExecutiveSummaryResult {
  const obj = (input ?? {}) as { headline?: unknown; sections?: unknown; recommendations?: unknown };
  const headline = typeof obj.headline === "string" ? obj.headline : "";

  const sectionsRaw = parseIfString(obj.sections);
  const sections: ExecutiveSummarySection[] = (Array.isArray(sectionsRaw) ? sectionsRaw : [])
    .map((s: RawSection) => {
      if (!s || typeof s.heading !== "string") return null;
      const bulletsRaw = parseIfString(s.bullets);
      const bullets = (Array.isArray(bulletsRaw) ? bulletsRaw : []).filter(
        (b): b is string => typeof b === "string" && b.trim().length > 0
      );
      if (bullets.length === 0) return null;
      return { heading: s.heading, bullets };
    })
    .filter((s): s is ExecutiveSummarySection => s !== null);

  const recommendationsRaw = parseIfString(obj.recommendations);
  const recommendations = (Array.isArray(recommendationsRaw) ? recommendationsRaw : [])
    .filter((r: RawRecommendation) => r && typeof r.title === "string" && typeof r.detail === "string")
    .map((r: RawRecommendation) => ({
      title: r.title as string,
      detail: r.detail as string,
      relatedKpi: typeof r.relatedKpi === "string" ? r.relatedKpi : "",
    }));

  return { headline, sections, recommendations };
}
