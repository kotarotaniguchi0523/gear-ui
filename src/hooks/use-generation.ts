"use client";

import { useCallback, useRef, useState } from "react";
import { consumeSse } from "@/lib/sse-client";
import {
  LIVE_PREVIEW_INTERVAL_MS,
  isAbort,
  stripCodeFence,
} from "@/lib/preview";
import type { Project } from "@/hooks/use-projects";
import type {
  ChatTarget,
  ChatTurn,
  DesignRules,
  MockStaleMap,
  ScreenDefinition,
  ScreenDefinitionSet,
} from "@/lib/schemas";

// page から渡す、ジェネレーションが必要とする外部依存。プロジェクト/要件/キーなどの
// 「いま現在の値」と、UI 側（パネル開閉）へ作用するためのコールバックをまとめる。
export interface GenerationDeps {
  activeProjectId: string | null;
  requirement: string;
  designRules: DesignRules | null;
  apiKey: string;
  /** 未作成なら新規プロジェクトを作って id を返す。 */
  ensureProject: () => Promise<string>;
  /** プロジェクト一覧（サイドバー）の再取得。 */
  reloadProjects: () => void;
  /** 定義の生成/作り直し開始時に、畳んだパネルを開く。 */
  onResetPanels: () => void;
  /** 最初のモックが出来たらプレビューに集中するため定義パネルを畳む。 */
  onEnterFocusMode: () => void;
}

/**
 * 「定義 → モック → チャット修正」のドキュメント状態と生成アクションを一手に持つフック。
 * page.tsx からこの塊を切り出し、UI レイアウト（page）と生成ロジック（ここ）を分離する。
 */
export function useGeneration(deps: GenerationDeps) {
  const [defs, setDefs] = useState<ScreenDefinitionSet | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [defining, setDefining] = useState(false);
  const [defProgress, setDefProgress] = useState(0);
  const [defError, setDefError] = useState<string | null>(null);

  const [mocking, setMocking] = useState(false);
  const [mockError, setMockError] = useState<string | null>(null);
  const [mockCache, setMockCache] = useState<Record<string, string>>({});
  // 生成中のモックHTMLをプレビューにライブ描画するための一時バッファ（選択中画面のみ）。
  const [streamingMockHtml, setStreamingMockHtml] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // チャット修正窓: 履歴・古いモック・入力状態・フォーカス対象の手動上書き。
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [mockStale, setMockStale] = useState<MockStaleMap>({});
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [focusOverride, setFocusOverride] = useState<ChatTarget | null>(null);

  // 進行中の生成（定義・モック）を中止するための AbortController。
  const abortRef = useRef<AbortController | null>(null);

  const buildHeaders = useCallback(
    (opts?: { stream?: boolean }): Record<string, string> => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (deps.apiKey) headers["x-llm-api-key"] = deps.apiKey;
      if (opts?.stream) headers["accept"] = "text/event-stream";
      return headers;
    },
    [deps.apiKey]
  );

  const selectedScreen: ScreenDefinition | null = defs?.screens[selectedIndex] ?? null;
  const currentMockHtml = selectedScreen
    ? mockCache[selectedScreen.screenId] ?? null
    : null;
  const currentMockStale = selectedScreen
    ? !!mockStale[selectedScreen.screenId]
    : false;
  // フォーカス対象の自動振り分け: 選択画面にモックがあればモック、無ければ定義。
  // ユーザーが手動で切り替えた場合(focusOverride)はそれを優先する。
  const effectiveTarget: ChatTarget =
    focusOverride ?? (currentMockHtml ? "mock" : "definition");
  // 生成中は streamingMockHtml（選択中画面のライブHTML）を優先表示する。
  const previewHtml = streamingMockHtml ?? currentMockHtml;

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  function selectScreen(i: number) {
    setSelectedIndex(i);
    setFocusOverride(null); // 画面を切り替えたら自動振り分けに戻す
  }

  async function generateDefinitions() {
    setDefining(true);
    setDefProgress(0);
    setDefError(null);
    setDefs(null);
    setMockCache({});
    setSelectedIndex(0);
    // 作り直すと従来のチャット履歴・古いモック判定は無効になるのでリセット
    setChat([]);
    setMockStale({});
    setChatError(null);
    setFocusOverride(null);
    // 定義を作り直したら定義レビュー段階に戻るので、畳んでいたパネルを開く
    deps.onResetPanels();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const projectId = await deps.ensureProject();
      const res = await fetch("/api/generate/definition", {
        method: "POST",
        headers: buildHeaders({ stream: true }),
        body: JSON.stringify({ requirement: deps.requirement, projectId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDefError(data.error ?? "Failed to generate definitions");
        return;
      }
      // 定義JSONは完成して初めて使えるので、受信文字数を進捗として表示し、
      // 確定した定義は done イベントで受け取る。
      await consumeSse(res, {
        delta: (d) => setDefProgress((d as { length: number }).length),
        done: (d) => {
          setDefs(d as ScreenDefinitionSet);
          deps.reloadProjects();
        },
        error: (d) =>
          setDefError(
            (d as { error?: string }).error ?? "Failed to generate definitions"
          ),
      });
    } catch (err) {
      if (!isAbort(err)) {
        setDefError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      abortRef.current = null;
      setDefining(false);
    }
  }

  // 1画面分のモックを生成してHTMLを返す。失敗時は mockError をセットし null。
  // onDelta が渡されると、生成途中の（fenceを外した）HTMLを逐次コールバックする。
  async function requestMock(
    screen: ScreenDefinition,
    signal: AbortSignal,
    onDelta?: (html: string) => void
  ): Promise<string | null> {
    const res = await fetch("/api/generate/mock", {
      method: "POST",
      headers: buildHeaders({ stream: true }),
      body: JSON.stringify({
        screen,
        ...(deps.activeProjectId ? { projectId: deps.activeProjectId } : {}),
        ...(deps.designRules ? { designRules: deps.designRules } : {}),
      }),
      signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMockError(data.error ?? "Failed to generate mock");
      return null;
    }
    let acc = "";
    let finalHtml: string | null = null;
    let failed = false;
    // 1トークンごとに srcDoc を差し替えると iframe が毎回フルリロードして
    // カクつくため、ライブ描画は一定間隔に間引く（最終HTMLは done で確定）。
    let lastPaint = 0;
    await consumeSse(res, {
      delta: (d) => {
        acc += (d as { text: string }).text;
        if (!onDelta) return;
        const now = Date.now();
        if (now - lastPaint < LIVE_PREVIEW_INTERVAL_MS) return;
        lastPaint = now;
        onDelta(stripCodeFence(acc));
      },
      done: (d) => {
        finalHtml = (d as { html: string }).html;
      },
      error: (d) => {
        failed = true;
        setMockError((d as { error?: string }).error ?? "Failed to generate mock");
      },
    });
    return failed ? null : finalHtml;
  }

  async function generateMock() {
    if (!selectedScreen) return;
    setMocking(true);
    setMockError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const wasFirstMock = Object.keys(mockCache).length === 0;
      const html = await requestMock(
        selectedScreen,
        controller.signal,
        setStreamingMockHtml
      );
      if (html == null) return;
      setMockCache((prev) => ({ ...prev, [selectedScreen.screenId]: html }));
      if (wasFirstMock) deps.onEnterFocusMode();
      if (deps.activeProjectId) deps.reloadProjects();
    } catch (err) {
      if (!isAbort(err)) {
        setMockError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      abortRef.current = null;
      setMocking(false);
      setStreamingMockHtml(null);
    }
  }

  // 画面定義の数だけまとめてモックを生成する。未生成の画面を順番に処理し、
  // すべて生成済みなら全画面を再生成する。1件ずつ逐次実行してAPIへの集中を避ける。
  async function generateAllMocks() {
    if (!defs || defs.screens.length === 0) return;
    const missing = defs.screens.filter((s) => !mockCache[s.screenId]);
    const targets = missing.length > 0 ? missing : defs.screens;
    setMockError(null);
    setBulkProgress({ done: 0, total: targets.length });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const wasFirstMock = Object.keys(mockCache).length === 0;
      const selectedId = selectedScreen?.screenId;
      for (let i = 0; i < targets.length; i++) {
        const screen = targets[i];
        // 表示中の画面が対象のときだけプレビューへライブ描画する。
        const onDelta =
          screen.screenId === selectedId ? setStreamingMockHtml : undefined;
        const html = await requestMock(screen, controller.signal, onDelta);
        if (html == null) break; // requestMock 側で mockError をセット済み
        setMockCache((prev) => ({ ...prev, [screen.screenId]: html }));
        setBulkProgress({ done: i + 1, total: targets.length });
      }
      if (wasFirstMock) deps.onEnterFocusMode();
      if (deps.activeProjectId) deps.reloadProjects();
    } catch (err) {
      if (!isAbort(err)) {
        setMockError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      abortRef.current = null;
      setBulkProgress(null);
      setStreamingMockHtml(null);
    }
  }

  // チャット修正窓の送信。effectiveTarget に応じて定義 or モックを編集する。
  // モック編集はストリーミングHTMLをプレビューへライブ描画する。
  async function sendChat() {
    const text = chatInput.trim();
    if (!text || !deps.activeProjectId || chatBusy) return;
    const target = effectiveTarget;
    if (target === "mock" && !currentMockHtml) {
      setChatError("先にこの画面のモックを生成してください。");
      return;
    }
    const screenId =
      target === "mock" && selectedScreen ? selectedScreen.screenId : undefined;

    setChatBusy(true);
    setChatError(null);
    const optimistic: ChatTurn = {
      id: `tmp-${Date.now()}`,
      role: "user",
      target,
      text,
      ts: Date.now(),
      ...(screenId ? { screenId } : {}),
    };
    setChat((prev) => [...prev, optimistic]);
    setChatInput("");

    const restore = () => {
      setChat((prev) => prev.filter((t) => t.id !== optimistic.id));
      setChatInput(text);
    };

    let acc = "";
    let lastPaint = 0;
    try {
      const res = await fetch("/api/chat/edit", {
        method: "POST",
        headers: buildHeaders({ stream: true }),
        body: JSON.stringify({
          projectId: deps.activeProjectId,
          target,
          instruction: text,
          ...(screenId ? { screenId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChatError(data.error ?? "修正に失敗しました");
        restore();
        return;
      }
      await consumeSse(res, {
        delta: (d) => {
          // mock編集のみライブ描画。definition編集は文字数のみで描画対象外。
          const td = d as { text?: string };
          if (target !== "mock" || td.text === undefined) return;
          acc += td.text;
          const now = Date.now();
          if (now - lastPaint < LIVE_PREVIEW_INTERVAL_MS) return;
          lastPaint = now;
          setStreamingMockHtml(stripCodeFence(acc));
        },
        done: (d) => {
          const proj = d as Project;
          setChat(proj.chat ?? []);
          setMockStale(proj.mockStale ?? {});
          setDefs(proj.definitions);
          setMockCache(proj.mocks ?? {});
          // 画面が削除されて選択インデックスが範囲外になったら先頭へ戻す
          const count = proj.definitions?.screens.length ?? 0;
          setSelectedIndex((i) => (i >= count ? 0 : i));
          deps.reloadProjects();
        },
        error: (d) => {
          setChatError((d as { error?: string }).error ?? "修正に失敗しました");
          restore();
        },
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Unknown error");
      restore();
    } finally {
      setChatBusy(false);
      setStreamingMockHtml(null);
    }
  }

  // プロジェクトを開いたときに、そのドキュメント状態を流し込む。
  const hydrate = useCallback((proj: Project) => {
    setDefs(proj.definitions);
    setMockCache(proj.mocks);
    setChat(proj.chat ?? []);
    setMockStale(proj.mockStale ?? {});
    setSelectedIndex(0);
    setDefError(null);
    setMockError(null);
    setChatError(null);
    setChatInput("");
    setFocusOverride(null);
  }, []);

  // アクティブなプロジェクトを削除したときなど、空の初期状態へ戻す。
  const reset = useCallback(() => {
    setDefs(null);
    setMockCache({});
    setSelectedIndex(0);
    setChat([]);
    setMockStale({});
    setStreamingMockHtml(null);
    setDefError(null);
    setMockError(null);
    setChatError(null);
    setChatInput("");
    setFocusOverride(null);
    setDefProgress(0);
  }, []);

  return {
    // ドキュメント
    defs,
    selectedIndex,
    selectScreen,
    selectedScreen,
    mockStale,
    // 定義生成
    defining,
    defProgress,
    defError,
    generateDefinitions,
    stopGeneration,
    // モック生成
    mocking,
    mockError,
    bulkProgress,
    mocks: mockCache,
    currentMockHtml,
    currentMockStale,
    previewHtml,
    generateMock,
    generateAllMocks,
    // チャット修正
    chat,
    chatInput,
    setChatInput,
    chatBusy,
    chatError,
    effectiveTarget,
    setFocusOverride,
    sendChat,
    // ライフサイクル
    hydrate,
    reset,
  };
}
