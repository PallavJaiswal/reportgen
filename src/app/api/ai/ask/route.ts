import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/get-ai-provider";
import type { ReportContext } from "@/lib/ai/types";
import { getRateLimitStatus, applyRateLimitCookie } from "@/lib/rate-limit/check-rate-limit";
import { DEMO_LIMIT_MESSAGE, findCannedAnswer } from "@/lib/demo/canned-report";

export async function POST(req: NextRequest) {
  let body: { question?: string; context?: Partial<ReportContext> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.question !== "string" || !body.question.trim() || !body.context) {
    return NextResponse.json({ error: "Missing question or report context." }, { status: 400 });
  }

  const rateLimit = getRateLimitStatus(req);
  if (rateLimit.limited) {
    return NextResponse.json({
      answer: findCannedAnswer(body.question),
      limited: true,
      limitMessage: DEMO_LIMIT_MESSAGE,
    });
  }

  try {
    const provider = getAIProvider();
    const answer = await provider.answerQuestion(body.question, body.context as ReportContext);
    const response = NextResponse.json({ answer });
    applyRateLimitCookie(response, rateLimit);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
