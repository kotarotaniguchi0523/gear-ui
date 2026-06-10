import {
  useDeferredValue,
  useEffect,
  useReducer,
  useRef,
  useTransition,
} from "hono/jsx";
import { createActor } from "xstate";
import { consumeSse } from "@/lib/sse-client";
import {
  LIVE_PREVIEW_INTERVAL_MS,
  looksLikeHtmlStart,
  stripCodeFence,
} from "@/lib/preview";
import type { Project } from "@/hooks/use-projects";
import {
  generationMachine,
  selectGenerationUx,
} from "@/hooks/generation-machine";
import type {
  BulkMockRequest,
  ChatRequest,
  GenerationSnapshot,
  GenerationServices,
  MockRequest,
} from "@/hooks/generation-machine";
import type {
  ChatTarget,
  ChatTurn,
  DesignRules,
  ScreenDefinition,
  ScreenDefinitionSet,
} from "@/lib/schemas";
import type { GenerationAction } from "@/hooks/generation-machine";

export interface GenerationDeps {
  activeProjectId: string | null;
  requirement: string;
  designRules: DesignRules | null;
  ensureProject: () => Promise<string>;
  reloadProjects: () => void;
  onResetPanels: () => void;
  onEnterFocusMode: () => void;
}

const streamHeaders: Record<string, string> = {
  "content-type": "application/json",
  accept: "text/event-stream",
};

function isDeferredGenerationEvent(event: GenerationAction): boolean {
  return (
    event.type === "definitionProgress" ||
    event.type === "mockStream" ||
    event.type === "mockBulkProgress" ||
    event.type === "mockDone" ||
    event.type === "chatProjectDone" ||
    event.type === "definitionDone"
  );
}

export function useGeneration(deps: GenerationDeps) {
  const [, startUiTransition] = useTransition();
  const servicesRef = useRef<GenerationServices | null>(null);
  servicesRef.current = {
    generateDefinition: async (request, signal, send) => {
      const projectId = await deps.ensureProject();
      const res = await fetch("/api/generate/definition", {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify({ requirement: request.requirement, projectId }),
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        send({
          type: "definitionError",
          error:
            (data as { error?: string }).error ??
            "Failed to generate definitions",
        });
        return;
      }
      await consumeSse(res, {
        delta: (d) =>
          send({
            type: "definitionProgress",
            length: (d as { length: number }).length,
          }),
        done: (d) =>
          send({ type: "definitionDone", defs: d as ScreenDefinitionSet }),
        error: (d) =>
          send({
            type: "definitionError",
            error:
              (d as { error?: string }).error ??
              "Failed to generate definitions",
        }),
      });
    },
    generateMock: async (request, signal, send) => {
      const html = await requestMock(request, signal, send);
      if (html == null) return;
      send({ type: "mockDone", screenId: request.screen.screenId, html });
      send({
        type: "mockSuccessSideEffects",
        enterFocus: request.enterFocusOnDone,
        reload: request.reloadOnDone,
      });
    },
    generateAllMocks: async (request, signal, send) => {
      let completed = true;
      for (let i = 0; i < request.targets.length; i++) {
        const screen = request.targets[i];
        const html = await requestMock(
          {
            screen,
            projectId: request.projectId,
            designRules: request.designRules,
            streamPreview: screen.screenId === request.selectedScreenId,
            enterFocusOnDone: false,
            reloadOnDone: false,
          },
          signal,
          send
        );
        if (html == null) {
          completed = false;
          break;
        }
        send({ type: "mockDone", screenId: screen.screenId, html });
        send({
          type: "mockBulkProgress",
          done: i + 1,
          total: request.targets.length,
        });
      }
      if (!completed) return;
      send({
        type: "mockSuccessSideEffects",
        enterFocus: request.enterFocusOnDone,
        reload: request.reloadOnDone,
      });
    },
    editChat: async (request, signal, send) => {
      let acc = "";
      let lastPaint = 0;
      const res = await fetch("/api/chat/edit", {
        method: "POST",
        headers: streamHeaders,
        body: JSON.stringify({
          projectId: request.projectId,
          target: request.target,
          instruction: request.instruction,
          ...(request.screenId ? { screenId: request.screenId } : {}),
          ...(request.syncFromMock ? { syncFromMock: true } : {}),
        }),
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        send({
          type: "chatError",
          error: (data as { error?: string }).error ?? request.errorMessage,
        });
        send({
          type: "chatRestore",
          optimisticId: request.optimistic.id,
          input: request.restoreInput,
        });
        return;
      }
      await consumeSse(res, {
        delta: (d) => {
          const td = d as { text?: string };
          if (request.target !== "mock" || td.text === undefined) return;
          acc += td.text;
          const stripped = stripCodeFence(acc);
          if (!looksLikeHtmlStart(stripped)) return;
          const now = Date.now();
          if (now - lastPaint < LIVE_PREVIEW_INTERVAL_MS) return;
          lastPaint = now;
          send({ type: "mockStream", html: stripped });
        },
        done: (d) => send({ type: "chatProjectDone", project: d as Project }),
        error: (d) => {
          send({
            type: "chatError",
            error: (d as { error?: string }).error ?? request.errorMessage,
          });
          send({
            type: "chatRestore",
            optimisticId: request.optimistic.id,
            input: request.restoreInput,
          });
        },
      });
    },
    reloadProjects: () => startUiTransition(() => deps.reloadProjects()),
    resetPanels: () => deps.onResetPanels(),
    enterFocusMode: () => deps.onEnterFocusMode(),
  };
  const actorRef = useRef<ReturnType<typeof createActor<typeof generationMachine>> | null>(null);
  if (!actorRef.current) {
    actorRef.current = createActor(generationMachine, {
      input: {
        services: {
          generateDefinition: (...args) =>
            servicesRef.current!.generateDefinition(...args),
          generateMock: (...args) => servicesRef.current!.generateMock(...args),
          generateAllMocks: (...args) =>
            servicesRef.current!.generateAllMocks(...args),
          editChat: (...args) => servicesRef.current!.editChat(...args),
          reloadProjects: () => servicesRef.current!.reloadProjects(),
          resetPanels: () => servicesRef.current!.resetPanels(),
          enterFocusMode: () => servicesRef.current!.enterFocusMode(),
        },
      },
    });
  }
  const actor = actorRef.current;
  const sendingRef = useRef(false);
  const [snapshot, commitSnapshot] = useReducer(
    (_current: GenerationSnapshot, next: GenerationSnapshot) => next,
    actor.getSnapshot()
  );
  useEffect(() => {
    const subscription = actor.subscribe((next) => {
      if (sendingRef.current) return;
      startUiTransition(() => commitSnapshot(next));
    });
    actor.start();
    return () => {
      subscription.unsubscribe();
      actor.stop();
    };
  }, []);
  const dispatch = (event: GenerationAction) => {
    sendingRef.current = true;
    try {
      actor.send(event);
      const next = actor.getSnapshot();
      if (isDeferredGenerationEvent(event)) {
        startUiTransition(() => commitSnapshot(next));
      } else {
        commitSnapshot(next);
      }
    } finally {
      sendingRef.current = false;
    }
  };
  const state = snapshot.context;

  const selectedScreen: ScreenDefinition | null =
    state.defs?.screens[state.selectedIndex] ?? null;
  const currentMockHtml = selectedScreen
    ? state.mocks[selectedScreen.screenId] ?? null
    : null;
  const currentMockStale = selectedScreen
    ? !!state.mockStale[selectedScreen.screenId]
    : false;
  const currentDefinitionStale = selectedScreen
    ? !!state.definitionStale[selectedScreen.screenId]
    : false;
  const effectiveTarget: ChatTarget =
    state.focusOverride ?? (currentMockHtml ? "mock" : "definition");
  const previewHtml = useDeferredValue(
    state.streamingMockHtml ?? currentMockHtml,
    currentMockHtml
  );
  const ux = selectGenerationUx(snapshot);

  function stopGeneration() {
    dispatch({ type: "stop" });
  }

  function selectScreen(index: number) {
    dispatch({ type: "selectScreen", index });
  }

  function changeChatInput(value: string) {
    dispatch({ type: "chatInputChanged", value });
  }

  function changeFocusTarget(target: ChatTarget | null) {
    dispatch({ type: "focusTargetChanged", target });
  }

  async function generateDefinitions() {
    dispatch({ type: "definitionRequested", requirement: deps.requirement });
  }

  async function requestMock(
    request: MockRequest,
    signal: AbortSignal,
    send: (event: GenerationAction) => void
  ): Promise<string | null> {
    const res = await fetch("/api/generate/mock", {
      method: "POST",
      headers: streamHeaders,
      body: JSON.stringify({
        screen: request.screen,
        ...(request.projectId ? { projectId: request.projectId } : {}),
        ...(request.designRules ? { designRules: request.designRules } : {}),
      }),
      signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      send({
        type: "mockError",
        error: (data as { error?: string }).error ?? "Failed to generate mock",
      });
      return null;
    }

    let acc = "";
    let finalHtml: string | null = null;
    let failed = false;
    let lastPaint = 0;
    await consumeSse(res, {
      delta: (d) => {
        acc += (d as { text: string }).text;
        if (!request.streamPreview) return;
        const stripped = stripCodeFence(acc);
        if (!looksLikeHtmlStart(stripped)) return;
        const now = Date.now();
        if (now - lastPaint < LIVE_PREVIEW_INTERVAL_MS) return;
        lastPaint = now;
        send({ type: "mockStream", html: stripped });
      },
      done: (d) => {
        finalHtml = (d as { html: string }).html;
      },
      error: (d) => {
        failed = true;
        send({
          type: "mockError",
          error: (d as { error?: string }).error ?? "Failed to generate mock",
        });
      },
    });
    return failed ? null : finalHtml;
  }

  async function generateMock() {
    if (!selectedScreen) return;
    const request: MockRequest = {
      screen: selectedScreen,
      projectId: deps.activeProjectId,
      designRules: deps.designRules,
      streamPreview: true,
      enterFocusOnDone: Object.keys(state.mocks).length === 0,
      reloadOnDone: deps.activeProjectId !== null,
    };
    dispatch({ type: "mockRequested", request });
  }

  async function generateAllMocks() {
    if (!state.defs || state.defs.screens.length === 0) return;
    const missing = state.defs.screens.filter((s) => !state.mocks[s.screenId]);
    const targets = missing.length > 0 ? missing : state.defs.screens;
    const request: BulkMockRequest = {
      targets,
      selectedScreenId: selectedScreen?.screenId,
      projectId: deps.activeProjectId,
      designRules: deps.designRules,
      enterFocusOnDone: Object.keys(state.mocks).length === 0,
      reloadOnDone: deps.activeProjectId !== null,
    };
    dispatch({ type: "bulkMocksRequested", request });
  }

  async function sendChat() {
    const text = state.chatInput.trim();
    if (!text || !deps.activeProjectId || snapshot.matches("chatting")) return;
    const target = effectiveTarget;
    if (target === "mock" && !currentMockHtml) {
      dispatch({
        type: "chatError",
        error: "先にこの画面のモックを生成してください。",
      });
      return;
    }
    const screenId =
      target === "mock" && selectedScreen ? selectedScreen.screenId : undefined;
    const optimistic: ChatTurn = {
      id: `tmp-${Date.now()}`,
      role: "user",
      target,
      text,
      ts: Date.now(),
      ...(screenId ? { screenId } : {}),
    };
    const request: ChatRequest = {
      projectId: deps.activeProjectId,
      target,
      instruction: text,
      optimistic,
      clearInput: true,
      restoreInput: text,
      ...(screenId ? { screenId } : {}),
      errorMessage: "修正に失敗しました",
    };
    dispatch({ type: "chatRequested", request });
  }

  async function syncDefinition() {
    if (!deps.activeProjectId || !selectedScreen || snapshot.matches("chatting")) {
      return;
    }
    if (!currentMockHtml) {
      dispatch({
        type: "chatError",
        error: "先にこの画面のモックを生成してください。",
      });
      return;
    }
    const screenId = selectedScreen.screenId;
    const instruction = `「${selectedScreen.screenName}」のモックの内容に合わせて定義を更新`;
    const optimistic: ChatTurn = {
      id: `tmp-${Date.now()}`,
      role: "user",
      target: "definition",
      text: instruction,
      ts: Date.now(),
      screenId,
    };
    const request: ChatRequest = {
      projectId: deps.activeProjectId,
      target: "definition",
      instruction,
      optimistic,
      clearInput: false,
      screenId,
      syncFromMock: true,
      errorMessage: "定義の同期に失敗しました",
    };
    dispatch({ type: "chatRequested", request });
  }

  function hydrate(project: Project) {
    dispatch({ type: "hydrate", project });
  }

  function reset() {
    dispatch({ type: "reset" });
  }

  return {
    defs: state.defs,
    selectedIndex: state.selectedIndex,
    selectScreen,
    selectedScreen,
    mockStale: state.mockStale,
    definitionStale: state.definitionStale,
    currentDefinitionStale,
    syncDefinition,
    defining: snapshot.matches("defining"),
    defProgress: state.defProgress,
    defError: state.defError,
    generateDefinitions,
    stopGeneration,
    mocking: snapshot.matches("mockingSingle"),
    mockError: state.mockError,
    bulkProgress: state.bulkProgress,
    mocks: state.mocks,
    currentMockHtml,
    currentMockStale,
    previewHtml,
    generateMock,
    generateAllMocks,
    chat: state.chat,
    chatInput: state.chatInput,
    changeChatInput,
    chatBusy: snapshot.matches("chatting"),
    chatError: state.chatError,
    effectiveTarget,
    changeFocusTarget,
    ux,
    sendChat,
    hydrate,
    reset,
  };
}
