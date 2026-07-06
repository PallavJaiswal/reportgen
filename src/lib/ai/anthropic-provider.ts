import "server-only";
import Anthropic from "@anthropic-ai/sdk";
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
  EXECUTIVE_SUMMARY_TOOL,
} from "./prompts";
import { coerceExecutiveSummary } from "./coerce-executive-summary";

const MODEL = "claude-sonnet-5";

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text.trim() ?? "";
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async explainAnomaly(context: AnomalyExplanationContext): Promise<string> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: buildAnomalyExplanationPrompt(context) }],
    });
    return extractText(message);
  }

  async summarizeExecutive(context: ReportContext): Promise<ExecutiveSummaryResult> {
    const attempt = async (attemptNumber: number): Promise<ExecutiveSummaryResult | null> => {
      const message = await this.client.messages.create({
        model: MODEL,
        max_tokens: 3500,
        messages: [{ role: "user", content: buildExecutiveSummaryPrompt(context) }],
        tools: [EXECUTIVE_SUMMARY_TOOL],
        tool_choice: { type: "tool", name: EXECUTIVE_SUMMARY_TOOL.name },
      });

      if (message.stop_reason === "max_tokens") {
        console.error(
          `[AnthropicProvider.summarizeExecutive] attempt ${attemptNumber}: hit max_tokens (output_tokens=${message.usage.output_tokens})`
        );
        return null;
      }

      const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolUse) {
        console.error(
          `[AnthropicProvider.summarizeExecutive] attempt ${attemptNumber}: no tool_use block (stop_reason=${message.stop_reason}, content types=${message.content.map((b) => b.type).join(",")})`
        );
        return null;
      }

      const result = coerceExecutiveSummary(toolUse.input);
      if (!result.headline || result.sections.length === 0 || result.recommendations.length === 0) {
        console.error(
          `[AnthropicProvider.summarizeExecutive] attempt ${attemptNumber}: coerced result was empty (headline length=${result.headline.length}, sections=${result.sections.length}, recommendations=${result.recommendations.length})`
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
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: buildQuestionPrompt(question, context) }],
    });
    return extractText(message);
  }
}
