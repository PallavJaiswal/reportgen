import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/get-ai-provider";
import type { AnomalyExplanationContext } from "@/lib/ai/types";
import { getRateLimitStatus, applyRateLimitCookie } from "@/lib/rate-limit/check-rate-limit";
import { DEMO_LIMIT_MESSAGE, findCannedAnomalyExplanation } from "@/lib/demo/canned-report";

export async function POST(req: NextRequest) {
  let body: Partial<AnomalyExplanationContext>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof body.metricLabel !== "string" ||
    typeof body.dimensionValue !== "string" ||
    typeof body.observed !== "number" ||
    typeof body.baseline !== "number"
  ) {
    return NextResponse.json({ error: "Missing required anomaly context fields." }, { status: 400 });
  }

  const rateLimit = getRateLimitStatus(req);
  if (rateLimit.limited) {
    return NextResponse.json({
      explanation: findCannedAnomalyExplanation(body.metricLabel, body.dimensionValue),
      limited: true,
      limitMessage: DEMO_LIMIT_MESSAGE,
    });
  }

  try {
    const provider = getAIProvider();
    const explanation = await provider.explainAnomaly(body as AnomalyExplanationContext);
    const response = NextResponse.json({ explanation });
    applyRateLimitCookie(response, rateLimit);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
