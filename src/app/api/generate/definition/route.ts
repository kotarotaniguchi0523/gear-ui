import { NextRequest, NextResponse } from "next/server";
import { callLlm, streamLlm, extractJson, MissingApiKeyError } from "@/lib/llm";
import {
  generateDefinitionRequestSchema,
  screenDefinitionSetSchema,
  type ScreenDefinitionSet,
} from "@/lib/schemas";
import {
  SCREEN_DEFINITION_SYSTEM_PROMPT,
  buildScreenDefinitionUserPrompt,
} from "@/lib/prompts/screen-definition";
import { updateProject } from "@/lib/repo/projects";
import { createSseResponse, wantsEventStream } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 120;

type DefinitionResult =
  | { ok: true; data: ScreenDefinitionSet }
  | { ok: false; details: unknown; raw: string };

/** Parse + validate the LLM output into a screen-definition set. */
function buildResult(raw: string): DefinitionResult {
  const json = extractJson(raw);
  const validated = screenDefinitionSetSchema.safeParse(json);
  if (!validated.success) {
    return { ok: false, details: validated.error.flatten(), raw };
  }
  return { ok: true, data: validated.data };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = generateDefinitionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const apiKey = request.headers.get("x-llm-api-key") ?? undefined;
  const callOptions = {
    apiKey,
    system: SCREEN_DEFINITION_SYSTEM_PROMPT,
    user: buildScreenDefinitionUserPrompt(parsed.data.requirement),
    maxTokens: 16000,
    temperature: 0.4,
  };

  // 作り直しなので、従来のモック・チャット履歴・古いモック判定はすべて破棄する。
  const persist = (data: ScreenDefinitionSet) => {
    if (!parsed.data.projectId) return;
    updateProject(parsed.data.projectId, {
      definitions: data,
      mocks: {},
      requirement: parsed.data.requirement,
      chat: [],
      mockStale: {},
    });
  };

  // Streaming path: the definition JSON is only useful once complete, so we
  // stream the received character count as progress and send the parsed set
  // in the final `done` event.
  if (wantsEventStream(request)) {
    return createSseResponse(async (emit) => {
      let raw = "";
      for await (const delta of streamLlm({
        ...callOptions,
        signal: request.signal,
      })) {
        raw += delta;
        emit("delta", { length: raw.length });
      }
      const result = buildResult(raw);
      if (!result.ok) {
        emit("error", {
          error: "LLM output failed schema validation",
          details: result.details,
          raw: result.raw,
        });
        return;
      }
      persist(result.data);
      emit("done", result.data);
    });
  }

  // Non-streaming JSON path (kept for direct API consumers).
  try {
    const raw = await callLlm(callOptions);
    const result = buildResult(raw);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "LLM output failed schema validation",
          details: result.details,
          raw: result.raw,
        },
        { status: 502 }
      );
    }
    persist(result.data);
    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
