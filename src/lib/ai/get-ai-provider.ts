import "server-only";
import { AnthropicProvider } from "./anthropic-provider";
import { GroqProvider } from "./groq-provider";
import type { AIProvider } from "./types";

let cachedProvider: AIProvider | null = null;

/** Reads AI_PROVIDER and returns the matching implementation — the only
 * place business logic ever needs to know which provider is active. */
export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER;

  if (providerName === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
    cachedProvider = new GroqProvider(apiKey);
  } else if (providerName === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    cachedProvider = new AnthropicProvider(apiKey);
  } else {
    throw new Error(`Unknown AI_PROVIDER "${providerName}". Expected "anthropic" or "groq".`);
  }

  return cachedProvider;
}
