import type { TokenUsage } from "@/types";

// Prices in USD per million tokens
const MODEL_PRICING: Record<string, {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}> = {
  // Anthropic
  "claude-opus-4-6":            { input: 5.00,  output: 25.00, cacheRead: 0.50,  cacheWrite: 6.25 },
  "claude-sonnet-4-6":          { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001":  { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25 },
  // OpenAI
  "gpt-4o":                     { input: 2.50,  output: 10.00, cacheRead: 1.25  },
  "gpt-4o-mini":                { input: 0.15,  output: 0.60,  cacheRead: 0.075 },
  "o3":                         { input: 10.00, output: 40.00, cacheRead: 2.50  },
  "o4-mini":                    { input: 1.10,  output: 4.40,  cacheRead: 0.275 },
  // Groq
  "llama-3.3-70b-versatile":                          { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant":                             { input: 0.05, output: 0.08 },
  "meta-llama/llama-4-scout-17b-16e-instruct":        { input: 0.11, output: 0.34 },
  "qwen/qwen3-32b":                                   { input: 0.29, output: 0.59 },
  "moonshotai/kimi-k2-instruct":                      { input: 1.00, output: 3.00 },
};

const USD_TO_EUR = 0.92;

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0
): TokenUsage {
  const pricing = MODEL_PRICING[model];
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;

  let costEur = 0;
  if (pricing) {
    const usd =
      (inputTokens      * pricing.input +
       outputTokens     * pricing.output +
       cacheReadTokens  * (pricing.cacheRead  ?? 0) +
       cacheWriteTokens * (pricing.cacheWrite ?? 0)) / 1_000_000;
    costEur = usd * USD_TO_EUR;
  }

  return {
    inputTokens,
    outputTokens,
    ...(cacheReadTokens  > 0 ? { cacheReadTokens }  : {}),
    ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
    totalTokens,
    costEur,
  };
}
