import { NextRequest, NextResponse } from "next/server";
import { callLlm, streamLlm, extractHtml, MissingApiKeyError } from "@/lib/llm";
import { generateMockRequestSchema } from "@/lib/schemas";
import {
  SCREEN_MOCK_SYSTEM_PROMPT,
  buildScreenMockUserPrompt,
} from "@/lib/prompts/screen-mock";
import { setMockForScreen } from "@/lib/repo/projects";
import { createSseResponse, wantsEventStream } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = generateMockRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const apiKey = request.headers.get("x-llm-api-key") ?? undefined;
  const callOptions = {
    apiKey,
    system: SCREEN_MOCK_SYSTEM_PROMPT,
    user: buildScreenMockUserPrompt(parsed.data.screen, parsed.data.designRules),
    maxTokens: 16000,
    temperature: 0.5,
  };

  const persist = (html: string) => {
    if (parsed.data.projectId) {
      setMockForScreen(parsed.data.projectId, parsed.data.screen.screenId, html);
    }
  };

  // Streaming path: forward HTML text deltas so the client can render the mock
  // into the preview iframe as it is generated, then emit the cleaned final
  // HTML in the `done` event.
  if (wantsEventStream(request)) {
    return createSseResponse(async (emit) => {
      let raw = "";
      for await (const delta of streamLlm({
        ...callOptions,
        signal: request.signal,
      })) {
        raw += delta;
        emit("delta", { text: delta });
      }
      const html = extractHtml(raw);
      persist(html);
      emit("done", { html });
    });
  }

  // Non-streaming JSON path (kept for direct API consumers).
  try {
    const raw = await callLlm(callOptions);
    const html = extractHtml(raw);
    persist(html);
    return NextResponse.json({ html });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
