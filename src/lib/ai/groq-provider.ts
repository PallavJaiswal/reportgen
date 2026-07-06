import "server-only";
import Groq from "groq-sdk";
import type {
  AIProvider,
  AnomalyExplanationContext,
  ExecutiveSummaryResult,
  ReportContext,
} from "./types";
import {
  buildAnomalyExplanationPrompt,
  buildExecutiveSummaryPrompt,
  buildQuestionPrompt,
  EXECUTIVE_SUMMARY_JSON_SCHEMA_DESCRIPTION,
} from "./prompts";
import { coerceExecutiveSummary } from "./coerce-executive-summary";

// Chosen for the public demo: production-stable, fast, and supports JSON
// mode + tool use. See project-brief.md §3 for the provider architecture.
const MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements AIProvider {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async explainAnomaly(context: AnomalyExplanationContext): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: buildAnomalyExplanationPrompt(context) }],
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  }

  async summarizeExecutive(context: ReportContext): Promise<ExecutiveSummaryResult> {
    const attempt = async (attemptNumber: number): Promise<ExecutiveSummaryResult | null> => {
      const completion = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 3500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXECUTIVE_SUMMARY_JSON_SCHEMA_DESCRIPTION },
          { role: "user", content: buildExecutiveSummaryPrompt(context) },
        ],
      });
      if (completion.choices[0]?.finish_reason === "length") {
        console.error(`[GroqProvider.summarizeExecutive] attempt ${attemptNumber}: hit finish_reason=length`);
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      } catch (err) {
        console.error(`[GroqProvider.summarizeExecutive] attempt ${attemptNumber}: JSON.parse failed:`, err);
        return null;
      }

      const result = coerceExecutiveSummary(parsed);
      if (!result.headline || result.sections.length === 0 || result.recommendations.length === 0) {
        console.error(
          `[GroqProvider.summarizeExecutive] attempt ${attemptNumber}: coerced result was empty (headline length=${result.headline.length}, sections=${result.sections.length}, recommendations=${result.recommendations.length})`
        );
        return null;
      }
      return result;
    };

    const result = (await attempt(1)) ?? (await attempt(2));
    if (!result) throw new Error("The model did not return a usable executive summary — try again.");
    return result;
  }

  async answerQuestion(question: string, context: ReportContext): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: buildQuestionPrompt(question, context) }],
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  }
}
