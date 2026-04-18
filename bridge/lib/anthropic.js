import Anthropic from "@anthropic-ai/sdk";
import db from "./db.js";

const PRICING = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

export function createClient(apiKey) {
  return new Anthropic({ apiKey });
}

export function priceOf(model, inputTokens, outputTokens) {
  const p = PRICING[model] ?? PRICING["claude-haiku-4-5"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function logUsage(number, model, usage) {
  const input = usage?.input_tokens ?? 0;
  const output = usage?.output_tokens ?? 0;
  const cost = priceOf(model, input, output);
  db.prepare(
    "INSERT INTO usage (number, model, input_tokens, output_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(number, model, input, output, cost, Date.now());
}
