import { extractHtml, extractJson, looksLikeHtmlDocument } from "@/lib/llm";

const DEFAULT_MAX_TOKENS = 16000;

export interface CodexCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

function buildPrompt(opts: CodexCallOptions): string {
  return [
    opts.system.trim(),
    "",
    "User request:",
    opts.user.trim(),
    "",
    "Return only the requested artifact. Do not modify repository files.",
  ].join("\n");
}

function finalText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return String(result ?? "");
  const record = result as Record<string, unknown>;
  for (const key of ["finalResponse", "final_response", "response", "text"]) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return String(result);
}

export async function callCodex(opts: CodexCallOptions): Promise<string> {
  if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const { Codex } = await import("@openai/codex-sdk");
  const codex = new Codex();
  const thread = codex.startThread();
  const result = await thread.run(buildPrompt(opts), {
    maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature,
    sandbox: "read-only",
  } as never);
  const text = finalText(result).trim();
  if (!text) throw new Error("Empty response from Codex");
  return text;
}

export async function* streamCodex(
  opts: CodexCallOptions
): AsyncGenerator<string> {
  yield await callCodex(opts);
}

export { extractHtml, extractJson, looksLikeHtmlDocument };
