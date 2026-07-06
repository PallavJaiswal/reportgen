import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/get-ai-provider";
import type { ReportContext } from "@/lib/ai/types";
import { getRateLimitStatus, applyRateLimitCookie } from "@/lib/rate-limit/check-rate-limit";
import { DEMO_LIMIT_MESSAGE, getCannedExecutiveSummary } from "@/lib/demo/canned-report";

export async function POST(req: NextRequest) {
  let body: Partial<ReportContext>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.kpis)) {
    return NextResponse.json({ error: "Missing required report context fields." }, { status: 400 });
  }

  const rateLimit = getRateLimitStatus(req);
  if (rateLimit.limited) {
    return NextResponse.json({
      ...getCannedExecutiveSummary(),
      limited: true,
      limitMessage: DEMO_LIMIT_MESSAGE,
    });
  }

  try {
    const provider = getAIProvider();
    const result = await provider.summarizeExecutive(body as ReportContext);
    const response = NextResponse.json(result);
    applyRateLimitCookie(response, rateLimit);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
