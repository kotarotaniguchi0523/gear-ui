import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  callLlm,
  streamLlm,
  extractHtml,
  extractJson,
  MissingApiKeyError,
  type CallOptions,
} from "@/lib/llm";
import {
  chatEditRequestSchema,
  screenDefinitionSetSchema,
  type ChatTurn,
  type ScreenDefinitionSet,
} from "@/lib/schemas";
import {
  SCREEN_DEFINITION_SYSTEM_PROMPT,
} from "@/lib/prompts/screen-definition";
import { SCREEN_MOCK_SYSTEM_PROMPT } from "@/lib/prompts/screen-mock";
import {
  buildDefinitionEditUserPrompt,
  buildMockEditUserPrompt,
} from "@/lib/prompts/chat-edit";
import {
  computeDefinitionUpdate,
  getProject,
  updateProject,
  type Project,
} from "@/lib/repo/projects";
import { createSseResponse, wantsEventStream } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 120;

function turn(
  role: ChatTurn["role"],
  target: ChatTurn["target"],
  text: string,
  extra?: { screenId?: string; error?: boolean }
): ChatTurn {
  return {
    id: randomUUID(),
    role,
    target,
    text,
    ts: Date.now(),
    ...(extra?.screenId ? { screenId: extra.screenId } : {}),
    ...(extra?.error ? { error: true } : {}),
  };
}

/** 定義編集の前後を比較し、何が変わったかを日本語で要約する。 */
function summarizeDefinitionEdit(
  oldSet: ScreenDefinitionSet | null,
  newSet: ScreenDefinitionSet
): string {
  const oldById = new Map((oldSet?.screens ?? []).map((s) => [s.screenId, s]));
  const newById = new Map(newSet.screens.map((s) => [s.screenId, s]));

  const added = newSet.screens.filter((s) => !oldById.has(s.screenId));
  const removed = (oldSet?.screens ?? []).filter((s) => !newById.has(s.screenId));
  const changed = newSet.screens.filter((s) => {
    const old = oldById.get(s.screenId);
    return old && JSON.stringify(old) !== JSON.stringify(s);
  });

  const parts: string[] = [];
  if (added.length) parts.push(`追加: ${added.map((s) => s.screenName).join("、")}`);
  if (removed.length)
    parts.push(`削除: ${removed.map((s) => s.screenName).join("、")}`);
  if (changed.length)
    parts.push(`修正: ${changed.map((s) => s.screenName).join("、")}`);

  if (parts.length === 0) return "画面定義に変更はありませんでした。";
  return `画面定義を更新しました（${parts.join(" / ")}）。`;
}

// LLM 生出力を確定状態へ変換した結果。失敗時は HTTP/SSE 双方で使える形で返す。
type Finalized =
  | { ok: true; project: Project | null }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = chatEditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, target, instruction, screenId } = parsed.data;
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.definitions) {
    return NextResponse.json(
      { error: "先に画面定義を生成してください。" },
      { status: 409 }
    );
  }

  const apiKey = request.headers.get("x-llm-api-key") ?? undefined;
  const userTurn = turn("user", target, instruction, { screenId });

  // ターゲットごとに「呼び出し設定・確定処理・進捗deltaの種類」を組み立てる。
  // definition は完成して初めて使えるので受信文字数を、mock はHTML本文を逐次流す。
  let callOptions: CallOptions;
  let finalize: (raw: string) => Finalized;
  let deltaKind: "length" | "text";

  if (target === "definition") {
    const definitions = project.definitions;
    callOptions = {
      apiKey,
      system: SCREEN_DEFINITION_SYSTEM_PROMPT,
      user: buildDefinitionEditUserPrompt(definitions, instruction),
      maxTokens: 16000,
      temperature: 0.3,
    };
    deltaKind = "length";
    finalize = (raw) => {
      const json = extractJson(raw);
      const validated = screenDefinitionSetSchema.safeParse(json);
      if (!validated.success) {
        return {
          ok: false,
          status: 502,
          body: {
            error: "LLM output failed schema validation",
            details: validated.error.flatten(),
            raw,
          },
        };
      }
      const summary = summarizeDefinitionEdit(definitions, validated.data);
      const { mocks, mockStale } = computeDefinitionUpdate(project, validated.data);
      const assistantTurn = turn("assistant", "definition", summary);
      const updated = updateProject(projectId, {
        definitions: validated.data,
        mocks,
        mockStale,
        chat: [...project.chat, userTurn, assistantTurn],
      });
      return { ok: true, project: updated };
    };
  } else {
    // target === "mock": LLM 呼び出し前に対象の妥当性を確かめる。
    if (!screenId) {
      return NextResponse.json(
        { error: "モック編集には対象画面が必要です。" },
        { status: 400 }
      );
    }
    const screen = project.definitions.screens.find((s) => s.screenId === screenId);
    if (!screen) {
      return NextResponse.json(
        { error: "対象画面が定義に見つかりません。" },
        { status: 404 }
      );
    }
    const currentHtml = project.mocks[screenId];
    if (!currentHtml) {
      return NextResponse.json(
        { error: "この画面のモックはまだ生成されていません。先にモックを生成してください。" },
        { status: 409 }
      );
    }

    callOptions = {
      apiKey,
      system: SCREEN_MOCK_SYSTEM_PROMPT,
      user: buildMockEditUserPrompt(
        currentHtml,
        screen,
        instruction,
        project.designRules
      ),
      maxTokens: 16000,
      temperature: 0.4,
    };
    deltaKind = "text";
    finalize = (raw) => {
      const html = extractHtml(raw);
      const mocks = { ...project.mocks, [screenId]: html };
      const mockStale = { ...project.mockStale };
      delete mockStale[screenId];
      const assistantTurn = turn(
        "assistant",
        "mock",
        `「${screen.screenName}」のモックを更新しました。`,
        { screenId }
      );
      const updated = updateProject(projectId, {
        mocks,
        mockStale,
        chat: [...project.chat, userTurn, assistantTurn],
      });
      return { ok: true, project: updated };
    };
  }

  // Streaming path: forward progress (definition=文字数 / mock=HTML本文) and emit
  // the updated project in the final `done` event.
  if (wantsEventStream(request)) {
    return createSseResponse(async (emit) => {
      let raw = "";
      for await (const delta of streamLlm({ ...callOptions, signal: request.signal })) {
        raw += delta;
        emit("delta", deltaKind === "length" ? { length: raw.length } : { text: delta });
      }
      const result = finalize(raw);
      if (!result.ok) {
        emit("error", result.body);
        return;
      }
      emit("done", result.project);
    });
  }

  // Non-streaming JSON path (kept for direct API consumers).
  try {
    const raw = await callLlm(callOptions);
    const result = finalize(raw);
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
    return NextResponse.json(result.project);
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
