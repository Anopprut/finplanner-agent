import OpenAI from "openai";

// Multiple accounts and/or models can be configured so concurrent chat
// sessions spread across them instead of hammering a single key/model.
// OPENROUTER_API_KEYS: comma-separated list of OpenRouter API keys (one per account).
// OPENROUTER_MODELS: comma-separated list of OpenRouter model slugs to rotate across.
//   Find exact slugs at https://openrouter.ai/models — defaults to a single
//   well-known slug if unset.

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const apiKeys = parseList(process.env.OPENROUTER_API_KEYS);
const models = parseList(process.env.OPENROUTER_MODELS);
if (models.length === 0) models.push(DEFAULT_MODEL);

let keyCursor = 0;
let modelCursor = 0;

const clientCache = new Map<string, OpenAI>();

function clientForKey(apiKey: string): OpenAI {
  let client = clientCache.get(apiKey);
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Financial Planner Agent",
      },
    });
    clientCache.set(apiKey, client);
  }
  return client;
}

export function isConfigured(): boolean {
  return apiKeys.length > 0;
}

// Round-robins across configured keys/models so concurrent requests spread
// load across multiple OpenRouter accounts and/or models.
export function pickProvider(): { client: OpenAI; model: string } {
  if (apiKeys.length === 0) {
    throw new Error(
      "No OpenRouter API key configured. Set OPENROUTER_API_KEYS in .env.local."
    );
  }

  const key = apiKeys[keyCursor % apiKeys.length];
  keyCursor++;
  const model = models[modelCursor % models.length];
  modelCursor++;

  return { client: clientForKey(key), model };
}
