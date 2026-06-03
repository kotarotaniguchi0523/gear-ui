import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type LlmProvider = "anthropic" | "openai";

const DEFAULT_MAX_TOKENS = 16000;

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
};

export class MissingApiKeyError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "API key is not set. Configure it from the settings dialog or the provider's env var."
    );
    this.name = "MissingApiKeyError";
  }
}

/**
 * Resolve the active provider from an env value (defaults to "anthropic").
 * `openai` covers OpenAI itself plus any OpenAI-compatible endpoint
 * (OpenRouter, Together, Groq, Ollama, Gemini's OpenAI-compatible API, ...)
 * via `OPENAI_BASE_URL`.
 */
export function parseProvider(value: string | undefined): LlmProvider {
  const provider = (value ?? "anthropic").trim().toLowerCase();
  if (provider === "anthropic" || provider === "openai") return provider;
  throw new Error(
    `Unsupported LLM_PROVIDER "${value}". Use "anthropic" or "openai".`
  );
}

/** Model precedence: explicit option > LLM_MODEL env > provider default. */
export function resolveModel(
  provider: LlmProvider,
  explicit?: string,
  envModel?: string
): string {
  return explicit ?? (envModel?.trim() || undefined) ?? DEFAULT_MODELS[provider];
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

/**
 * An explicit key (e.g. supplied per-request from the settings dialog) takes
 * precedence over the env var and is never cached. Falls back to the cached
 * env-based client otherwise.
 */
function getAnthropic(overrideKey?: string): Anthropic {
  const explicit = overrideKey?.trim();
  if (explicit) return new Anthropic({ apiKey: explicit });

  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError(
      "Anthropic API key is not set. Configure it from the settings dialog or ANTHROPIC_API_KEY env."
    );
  }
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

function getOpenAI(overrideKey?: string): OpenAI {
  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  const explicit = overrideKey?.trim();
  if (explicit) return new OpenAI({ apiKey: explicit, baseURL });

  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError(
      "OpenAI API key is not set. Configure it from the settings dialog or OPENAI_API_KEY env (and OPENAI_BASE_URL for OpenAI-compatible providers)."
    );
  }
  openaiClient = new OpenAI({ apiKey, baseURL });
  return openaiClient;
}

export interface CallOptions {
  system: string;
  user: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Abort the in-flight request (e.g. the client cancelled the stream). */
  signal?: AbortSignal;
}

/**
 * Stream an LLM completion, yielding text deltas as they arrive. Works for both
 * Anthropic and OpenAI-compatible providers. `callLlm` is built on top of this,
 * and the generation routes consume it directly to push SSE updates.
 */
export async function* streamLlm(opts: CallOptions): AsyncGenerator<string> {
  const provider = parseProvider(process.env.LLM_PROVIDER);
  const model = resolveModel(provider, opts.model, process.env.LLM_MODEL);
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? 0.3;

  if (provider === "anthropic") {
    const stream = await getAnthropic(opts.apiKey).messages.create(
      {
        model,
        max_tokens: maxTokens,
        temperature,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        stream: true,
      },
      { signal: opts.signal }
    );
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    return;
  }

  // OpenAI and any OpenAI-compatible endpoint.
  const stream = await getOpenAI(opts.apiKey).chat.completions.create(
    {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      stream: true,
    },
    { signal: opts.signal }
  );
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

export async function callLlm(opts: CallOptions): Promise<string> {
  let text = "";
  for await (const delta of streamLlm(opts)) text += delta;
  if (!text) {
    throw new Error("Empty response from the LLM");
  }
  return text;
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  // Try the fenced block first, then the full response. The non-greedy fence
  // match can stop early at a ``` that appears *inside* a JSON string value, so
  // falling back to `raw` recovers the complete object in that case.
  const candidates = fenced ? [fenced[1], raw] : [raw];

  for (const text of candidates) {
    const candidate = text.trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const firstBrace = candidate.search(/[{[]/);
      const lastBrace = Math.max(
        candidate.lastIndexOf("}"),
        candidate.lastIndexOf("]")
      );
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
        } catch {
          // Fall through to the next candidate.
        }
      }
    }
  }
  throw new Error("No JSON object/array found in response");
}

export function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return raw.trim();
}
