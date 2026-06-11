import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  callCodex,
  streamCodex,
  extractHtml,
  extractJson,
  looksLikeHtmlDocument,
} from "@/lib/codex";
import {
  chatEditRequestSchema,
  generateDefinitionRequestSchema,
  generateMockRequestSchema,
  projectCreateSchema,
  projectPatchSchema,
  screenDefinitionSetSchema,
  type ChatTurn,
  type ScreenDefinitionSet,
} from "@/lib/schemas";
import {
  SCREEN_DEFINITION_SYSTEM_PROMPT,
  buildScreenDefinitionUserPrompt,
} from "@/lib/prompts/screen-definition";
import {
  SCREEN_MOCK_EDIT_SYSTEM_PROMPT,
  SCREEN_MOCK_SYSTEM_PROMPT,
  buildScreenMockUserPrompt,
} from "@/lib/prompts/screen-mock";
import {
  buildDefinitionEditUserPrompt,
  buildDefinitionSyncUserPrompt,
  buildMockEditUserPrompt,
} from "@/lib/prompts/chat-edit";
import {
  computeDefinitionUpdate,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  setMockForScreen,
  updateProject,
  type Project,
} from "@/lib/repo/projects";

function wantsEventStream(request: Request): boolean {
  return request.headers.get("accept")?.includes("text/event-stream") ?? false;
}

export function codexAuthStatus(home = join(homedir(), ".codex")) {
  const authFiles = ["auth.json", ".credentials.json"].map((name) =>
    join(home, name)
  );
  const available = authFiles.some((path) => existsSync(path));
  return {
    available,
    auth: "codex-login",
    message: available
      ? "Codex SDK can use the server user's existing Codex login session."
      : "Run `codex login` as the server process user before using generation features.",
  };
}

type Emit = (event: string, data: unknown) => Promise<void>;

function sse(c: any, producer: (emit: Emit) => Promise<void>) {
  return streamSSE(c, async (stream) => {
    const emit: Emit = async (event, data) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) });
    };
    try {
      await producer(emit);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await emit("error", { error: message });
    }
  });
}

async function readJson(c: { req: { json: () => Promise<unknown> } }) {
  return c.req.json().catch(() => null);
}

type DefinitionResult =
  | { ok: true; data: ScreenDefinitionSet }
  | { ok: false; details: unknown; raw: string };

function buildDefinitionResult(raw: string): DefinitionResult {
  const json = extractJson(raw);
  const validated = screenDefinitionSetSchema.safeParse(json);
  if (!validated.success) {
    return { ok: false, details: validated.error.flatten(), raw };
  }
  return { ok: true, data: validated.data };
}

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
  return parts.length === 0
    ? "画面定義に変更はありませんでした。"
    : `画面定義を更新しました（${parts.join(" / ")}）。`;
}

type Finalized =
  | { ok: true; project: Project | null }
  | { ok: false; status: number; body: Record<string, unknown> };

const api = new Hono()
  .get("/codex/status", (c) => c.json(codexAuthStatus()))
  .get("/projects", (c) => c.json({ projects: listProjects() }))
  .post("/projects", async (c) => {
    const parsed = projectCreateSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400
      );
    }
    return c.json(createProject(parsed.data), 201);
  })
  .get("/projects/:id", (c) => {
    const project = getProject(c.req.param("id"));
    if (!project) return c.json({ error: "Not found" }, 404);
    return c.json(project);
  })
  .patch("/projects/:id", async (c) => {
    const parsed = projectPatchSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400
      );
    }
    const updated = updateProject(c.req.param("id"), parsed.data);
    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json(updated);
  })
  .delete("/projects/:id", (c) => {
    const ok = deleteProject(c.req.param("id"));
    if (!ok) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  })
  .post("/generate/definition", async (c) => {
    const parsed = generateDefinitionRequestSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400
      );
    }
    const callOptions = {
      system: SCREEN_DEFINITION_SYSTEM_PROMPT,
      user: buildScreenDefinitionUserPrompt(parsed.data.requirement),
      maxTokens: 16000,
      temperature: 0.4,
      signal: c.req.raw.signal,
    };
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
    if (wantsEventStream(c.req.raw)) {
      return sse(c, async (emit) => {
        let raw = "";
        for await (const delta of streamCodex(callOptions)) {
          raw += delta;
          await emit("delta", { length: raw.length });
        }
        const result = buildDefinitionResult(raw);
        if (!result.ok) {
          await emit("error", {
            error: "Codex output failed schema validation",
            details: result.details,
            raw: result.raw,
          });
          return;
        }
        persist(result.data);
        await emit("done", result.data);
      });
    }
    const raw = await callCodex(callOptions);
    const result = buildDefinitionResult(raw);
    if (!result.ok) {
      return c.json(
        {
          error: "Codex output failed schema validation",
          details: result.details,
          raw: result.raw,
        },
        502
      );
    }
    persist(result.data);
    return c.json(result.data);
  })
  .post("/generate/mock", async (c) => {
    const parsed = generateMockRequestSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400
      );
    }
    const callOptions = {
      system: SCREEN_MOCK_SYSTEM_PROMPT,
      user: buildScreenMockUserPrompt(parsed.data.screen, parsed.data.designRules),
      maxTokens: 16000,
      temperature: 0.5,
      signal: c.req.raw.signal,
    };
    const persist = (html: string) => {
      if (parsed.data.projectId) {
        setMockForScreen(parsed.data.projectId, parsed.data.screen.screenId, html);
      }
    };
    if (wantsEventStream(c.req.raw)) {
      return sse(c, async (emit) => {
        let raw = "";
        for await (const delta of streamCodex(callOptions)) {
          raw += delta;
          await emit("delta", { text: delta });
        }
        const html = extractHtml(raw);
        persist(html);
        await emit("done", { html });
      });
    }
    const raw = await callCodex(callOptions);
    const html = extractHtml(raw);
    persist(html);
    return c.json({ html });
  })
  .post("/chat/edit", async (c) => {
    const parsed = chatEditRequestSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        400
      );
    }
    const { projectId, target, instruction, screenId, syncFromMock } = parsed.data;
    const project = getProject(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);
    if (!project.definitions) {
      return c.json({ error: "先に画面定義を生成してください。" }, 409);
    }

    const userTurn = turn("user", target, instruction, { screenId });
    let callOptions: {
      system: string;
      user: string;
      maxTokens: number;
      temperature: number;
      signal: AbortSignal;
    };
    let finalize: (raw: string) => Finalized;
    let deltaKind: "length" | "text";
    const isSync = target === "definition" && syncFromMock === true;

    if (target === "definition") {
      const definitions = project.definitions;
      let syncScreenName = "";
      if (isSync) {
        if (!screenId) {
          return c.json({ error: "定義の同期には対象画面が必要です。" }, 400);
        }
        const screen = definitions.screens.find((s) => s.screenId === screenId);
        if (!screen) return c.json({ error: "対象画面が定義に見つかりません。" }, 404);
        const currentHtml = project.mocks[screenId];
        if (!currentHtml) {
          return c.json(
            { error: "この画面のモックがまだありません。先にモックを生成してください。" },
            409
          );
        }
        syncScreenName = screen.screenName;
        callOptions = {
          system: SCREEN_DEFINITION_SYSTEM_PROMPT,
          user: buildDefinitionSyncUserPrompt(definitions, screen, currentHtml),
          maxTokens: 16000,
          temperature: 0.3,
          signal: c.req.raw.signal,
        };
      } else {
        callOptions = {
          system: SCREEN_DEFINITION_SYSTEM_PROMPT,
          user: buildDefinitionEditUserPrompt(definitions, instruction),
          maxTokens: 16000,
          temperature: 0.3,
          signal: c.req.raw.signal,
        };
      }
      deltaKind = "length";
      finalize = (raw) => {
        const json = extractJson(raw);
        const validated = screenDefinitionSetSchema.safeParse(json);
        if (!validated.success) {
          return {
            ok: false,
            status: 502,
            body: {
              error: "Codex output failed schema validation",
              details: validated.error.flatten(),
              raw,
            },
          };
        }
        const summary = isSync
          ? `「${syncScreenName}」の定義をモックの内容に合わせて更新しました。`
          : summarizeDefinitionEdit(definitions, validated.data);
        const { mocks, mockStale, definitionStale } = computeDefinitionUpdate(
          project,
          validated.data
        );
        if (isSync && screenId) {
          delete definitionStale[screenId];
          delete mockStale[screenId];
        }
        const assistantTurn = turn(
          "assistant",
          "definition",
          summary,
          isSync && screenId ? { screenId } : undefined
        );
        const updated = updateProject(projectId, {
          definitions: validated.data,
          mocks,
          mockStale,
          definitionStale,
          chat: [...project.chat, userTurn, assistantTurn],
        });
        return { ok: true, project: updated };
      };
    } else {
      if (!screenId) return c.json({ error: "モック編集には対象画面が必要です。" }, 400);
      const screen = project.definitions.screens.find((s) => s.screenId === screenId);
      if (!screen) return c.json({ error: "対象画面が定義に見つかりません。" }, 404);
      const currentHtml = project.mocks[screenId];
      if (!currentHtml) {
        return c.json(
          { error: "この画面のモックはまだ生成されていません。先にモックを生成してください。" },
          409
        );
      }
      callOptions = {
        system: SCREEN_MOCK_EDIT_SYSTEM_PROMPT,
        user: buildMockEditUserPrompt(
          currentHtml,
          screen,
          instruction,
          project.designRules
        ),
        maxTokens: 16000,
        temperature: 0.4,
        signal: c.req.raw.signal,
      };
      deltaKind = "text";
      finalize = (raw) => {
        const html = extractHtml(raw);
        if (!looksLikeHtmlDocument(html)) {
          const reply =
            html.trim() ||
            "うまく修正内容を読み取れませんでした。変更したい箇所を具体的にお知らせください。";
          const assistantTurn = turn("assistant", "mock", reply, { screenId });
          const updated = updateProject(projectId, {
            chat: [...project.chat, userTurn, assistantTurn],
          });
          return { ok: true, project: updated };
        }
        const mocks = { ...project.mocks, [screenId]: html };
        const mockStale = { ...project.mockStale };
        delete mockStale[screenId];
        const definitionStale =
          html !== project.mocks[screenId]
            ? { ...project.definitionStale, [screenId]: true }
            : project.definitionStale;
        const assistantTurn = turn(
          "assistant",
          "mock",
          `「${screen.screenName}」のモックを更新しました。`,
          { screenId }
        );
        const updated = updateProject(projectId, {
          mocks,
          mockStale,
          definitionStale,
          chat: [...project.chat, userTurn, assistantTurn],
        });
        return { ok: true, project: updated };
      };
    }

    if (wantsEventStream(c.req.raw)) {
      return sse(c, async (emit) => {
        let raw = "";
        for await (const delta of streamCodex(callOptions)) {
          raw += delta;
          await emit("delta", deltaKind === "length" ? { length: raw.length } : { text: delta });
        }
        const result = finalize(raw);
        if (!result.ok) {
          await emit("error", result.body);
          return;
        }
        await emit("done", result.project);
      });
    }

    const raw = await callCodex(callOptions);
    const result = finalize(raw);
    if (!result.ok) return c.json(result.body, result.status as 400 | 502);
    return c.json(result.project);
  });

export const app = new Hono()
  .route("/api", api)
  .use("/tokens/*", serveStatic({ root: "./public" }))
  .use("/assets/*", serveStatic({ root: "./dist/client" }))
  .get("*", serveStatic({ path: existsSync("./dist/client/index.html") ? "./dist/client/index.html" : "./index.html" }));

export type AppType = typeof app;
