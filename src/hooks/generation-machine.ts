import {
  assign,
  fromCallback,
  getInitialSnapshot,
  getNextSnapshot,
  setup,
} from "xstate";
import type { Project } from "@/hooks/use-projects";
import type {
  ChatTarget,
  ChatTurn,
  DesignRules,
  DefinitionStaleMap,
  MockStaleMap,
  ScreenDefinition,
  ScreenDefinitionSet,
} from "@/lib/schemas";

export type BulkProgress = { done: number; total: number } | null;

export type GenerationContext = {
  services: GenerationServices;
  definitionRequest: DefinitionRequest | null;
  mockRequest: MockRequest | null;
  bulkMockRequest: BulkMockRequest | null;
  chatRequest: ChatRequest | null;
  defs: ScreenDefinitionSet | null;
  selectedIndex: number;
  defProgress: number;
  defError: string | null;
  mockError: string | null;
  mocks: Record<string, string>;
  streamingMockHtml: string | null;
  bulkProgress: BulkProgress;
  chat: ChatTurn[];
  mockStale: MockStaleMap;
  definitionStale: DefinitionStaleMap;
  chatInput: string;
  chatError: string | null;
  focusOverride: ChatTarget | null;
};

export type DefinitionRequest = {
  requirement: string;
};

export type MockRequest = {
  screen: ScreenDefinition;
  projectId: string | null;
  designRules: DesignRules | null;
  streamPreview: boolean;
  enterFocusOnDone: boolean;
  reloadOnDone: boolean;
};

export type BulkMockRequest = {
  targets: ScreenDefinition[];
  selectedScreenId?: string;
  projectId: string | null;
  designRules: DesignRules | null;
  enterFocusOnDone: boolean;
  reloadOnDone: boolean;
};

export type ChatRequest = {
  projectId: string;
  target: ChatTarget;
  instruction: string;
  optimistic: ChatTurn;
  clearInput: boolean;
  restoreInput?: string;
  screenId?: string;
  syncFromMock?: boolean;
  errorMessage: string;
};

export type GenerationServices = {
  generateDefinition: (
    request: DefinitionRequest,
    signal: AbortSignal,
    send: (event: GenerationAction) => void
  ) => Promise<void>;
  generateMock: (
    request: MockRequest,
    signal: AbortSignal,
    send: (event: GenerationAction) => void
  ) => Promise<void>;
  generateAllMocks: (
    request: BulkMockRequest,
    signal: AbortSignal,
    send: (event: GenerationAction) => void
  ) => Promise<void>;
  editChat: (
    request: ChatRequest,
    signal: AbortSignal,
    send: (event: GenerationAction) => void
  ) => Promise<void>;
  reloadProjects: () => void;
  resetPanels: () => void;
  enterFocusMode: () => void;
};

export type GenerationAction =
  | { type: "selectScreen"; index: number }
  | { type: "focusTargetChanged"; target: ChatTarget | null }
  | { type: "chatInputChanged"; value: string }
  | { type: "definitionRequested"; requirement: string }
  | { type: "definitionProgress"; length: number }
  | { type: "definitionDone"; defs: ScreenDefinitionSet }
  | { type: "definitionError"; error: string }
  | { type: "definitionFinish" }
  | { type: "mockRequested"; request: MockRequest }
  | { type: "bulkMocksRequested"; request: BulkMockRequest }
  | { type: "mockBulkProgress"; done: number; total: number }
  | { type: "mockStream"; html: string }
  | { type: "mockDone"; screenId: string; html: string }
  | { type: "mockError"; error: string }
  | { type: "mockSuccessSideEffects"; enterFocus: boolean; reload: boolean }
  | { type: "mockFinish" }
  | { type: "chatRequested"; request: ChatRequest }
  | { type: "chatRestore"; optimisticId: string; input?: string }
  | { type: "chatProjectDone"; project: Project }
  | { type: "chatError"; error: string }
  | { type: "chatFinish" }
  | { type: "hydrate"; project: Project }
  | { type: "stop" }
  | { type: "reset" };

const noopServices: GenerationServices = {
  generateDefinition: async () => {},
  generateMock: async () => {},
  generateAllMocks: async () => {},
  editChat: async () => {},
  reloadProjects: () => {},
  resetPanels: () => {},
  enterFocusMode: () => {},
};

export const initialGenerationContext: GenerationContext = {
  services: noopServices,
  definitionRequest: null,
  mockRequest: null,
  bulkMockRequest: null,
  chatRequest: null,
  defs: null,
  selectedIndex: 0,
  defProgress: 0,
  defError: null,
  mockError: null,
  mocks: {},
  streamingMockHtml: null,
  bulkProgress: null,
  chat: [],
  mockStale: {},
  definitionStale: {},
  chatInput: "",
  chatError: null,
  focusOverride: null,
};

function projectDocument(project: Project) {
  return {
    defs: project.definitions,
    mocks: project.mocks ?? {},
    chat: project.chat ?? [],
    mockStale: project.mockStale ?? {},
    definitionStale: project.definitionStale ?? {},
  };
}

function clampSelectedIndex(index: number, defs: ScreenDefinitionSet | null): number {
  const count = defs?.screens.length ?? 0;
  return count > 0 && index >= count ? 0 : index;
}

function requiredRequest<T>(request: T | null, message: string): T {
  if (request === null) throw new Error(message);
  return request;
}

export const generationMachine = setup({
  types: {} as {
    context: GenerationContext;
    events: GenerationAction;
    input: {
      services: GenerationServices;
    };
  },
  actors: {
    generateDefinition: fromCallback<
      GenerationAction,
      { request: DefinitionRequest; services: GenerationServices }
    >(({ input, sendBack }) => {
      const controller = new AbortController();
      input.services
        .generateDefinition(input.request, controller.signal, (event) =>
          sendBack(event)
        )
        .catch((error) => {
          if (!controller.signal.aborted) {
            sendBack({
              type: "definitionError",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            sendBack({ type: "definitionFinish" });
          }
        });
      return () => controller.abort();
    }),
    generateMock: fromCallback<
      GenerationAction,
      { request: MockRequest; services: GenerationServices }
    >(({ input, sendBack }) => {
      const controller = new AbortController();
      input.services
        .generateMock(input.request, controller.signal, (event) =>
          sendBack(event)
        )
        .catch((error) => {
          if (!controller.signal.aborted) {
            sendBack({
              type: "mockError",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            sendBack({ type: "mockFinish" });
          }
        });
      return () => controller.abort();
    }),
    generateAllMocks: fromCallback<
      GenerationAction,
      { request: BulkMockRequest; services: GenerationServices }
    >(({ input, sendBack }) => {
      const controller = new AbortController();
      input.services
        .generateAllMocks(input.request, controller.signal, (event) =>
          sendBack(event)
        )
        .catch((error) => {
          if (!controller.signal.aborted) {
            sendBack({
              type: "mockError",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            sendBack({ type: "mockFinish" });
          }
        });
      return () => controller.abort();
    }),
    editChat: fromCallback<
      GenerationAction,
      { request: ChatRequest; services: GenerationServices }
    >(({ input, sendBack }) => {
      const controller = new AbortController();
      input.services
        .editChat(input.request, controller.signal, (event) => sendBack(event))
        .catch((error) => {
          if (!controller.signal.aborted) {
            sendBack({
              type: "chatError",
              error: error instanceof Error ? error.message : "Unknown error",
            });
            sendBack({
              type: "chatRestore",
              optimisticId: input.request.optimistic.id,
              input: input.request.restoreInput,
            });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            sendBack({ type: "chatFinish" });
          }
        });
      return () => controller.abort();
    }),
  },
  actions: {
    storeDefinitionRequest: assign({
      definitionRequest: ({ event }) =>
        event.type === "definitionRequested"
          ? { requirement: event.requirement }
          : null,
    }),
    resetPanels: ({ context }) => context.services.resetPanels(),
    reloadProjects: ({ context }) => context.services.reloadProjects(),
    applyMockSuccessSideEffects: ({ context, event }) => {
      if (event.type !== "mockSuccessSideEffects") return;
      if (event.enterFocus) context.services.enterFocusMode();
      if (event.reload) context.services.reloadProjects();
    },
    selectScreen: assign({
      selectedIndex: ({ event }) =>
        event.type === "selectScreen" ? event.index : 0,
      focusOverride: null,
    }),
    changeFocusTarget: assign({
      focusOverride: ({ event }) =>
        event.type === "focusTargetChanged" ? event.target : null,
    }),
    changeChatInput: assign({
      chatInput: ({ event }) =>
        event.type === "chatInputChanged" ? event.value : "",
    }),
    startDefinition: assign({
      definitionRequest: ({ context }) => context.definitionRequest,
      defs: null,
      selectedIndex: 0,
      defProgress: 0,
      defError: null,
      mocks: {},
      chat: [],
      mockStale: {},
      definitionStale: {},
      chatError: null,
      focusOverride: null,
    }),
    updateDefinitionProgress: assign({
      defProgress: ({ event }) =>
        event.type === "definitionProgress" ? event.length : 0,
    }),
    finishDefinition: assign({
      defs: ({ event }) =>
        event.type === "definitionDone" ? event.defs : null,
    }),
    failDefinition: assign({
      defError: ({ event }) =>
        event.type === "definitionError" ? event.error : "Unknown error",
    }),
    startMockSingle: assign({
      mockRequest: ({ event }) =>
        event.type === "mockRequested" ? event.request : null,
      mockError: null,
      bulkProgress: null,
      streamingMockHtml: null,
    }),
    startMockBulk: assign({
      bulkMockRequest: ({ event }) =>
        event.type === "bulkMocksRequested" ? event.request : null,
      mockError: null,
      bulkProgress: ({ event }) =>
        event.type === "bulkMocksRequested"
          ? { done: 0, total: event.request.targets.length }
          : null,
      streamingMockHtml: null,
    }),
    updateMockBulkProgress: assign({
      bulkProgress: ({ event }) =>
        event.type === "mockBulkProgress"
          ? { done: event.done, total: event.total }
          : null,
    }),
    streamMock: assign({
      streamingMockHtml: ({ event }) =>
        event.type === "mockStream" ? event.html : null,
    }),
    storeMock: assign({
      mocks: ({ context, event }) =>
        event.type === "mockDone"
          ? { ...context.mocks, [event.screenId]: event.html }
          : context.mocks,
    }),
    failMock: assign({
      mockError: ({ event }) =>
        event.type === "mockError" ? event.error : "Unknown error",
    }),
    settleMock: assign({
      bulkProgress: null,
      streamingMockHtml: null,
      mockRequest: null,
      bulkMockRequest: null,
    }),
    startChat: assign({
      chatRequest: ({ event }) =>
        event.type === "chatRequested" ? event.request : null,
      chatError: null,
      chat: ({ context, event }) =>
        event.type === "chatRequested"
          ? [...context.chat, event.request.optimistic]
          : context.chat,
      chatInput: ({ context, event }) =>
        event.type === "chatRequested" && event.request.clearInput
          ? ""
          : context.chatInput,
    }),
    restoreChat: assign({
      chat: ({ context, event }) =>
        event.type === "chatRestore"
          ? context.chat.filter((t) => t.id !== event.optimisticId)
          : context.chat,
      chatInput: ({ context, event }) =>
        event.type === "chatRestore" && event.input !== undefined
          ? event.input
          : context.chatInput,
    }),
    applyChatProject: assign(({ context, event }) => {
      if (event.type !== "chatProjectDone") return context;
      const doc = projectDocument(event.project);
      return {
        ...context,
        ...doc,
        selectedIndex: clampSelectedIndex(context.selectedIndex, doc.defs),
      };
    }),
    failChat: assign({
      chatError: ({ event }) =>
        event.type === "chatError" ? event.error : "Unknown error",
    }),
    settleChat: assign({
      streamingMockHtml: null,
      chatRequest: null,
    }),
    hydrateProject: assign(({ context, event }) => {
      if (event.type !== "hydrate") return context;
      const doc = projectDocument(event.project);
      return {
        ...context,
        ...doc,
        selectedIndex: 0,
        defError: null,
        mockError: null,
        chatError: null,
        chatInput: "",
        focusOverride: null,
      };
    }),
    resetContext: assign(({ context }) => ({
      ...initialGenerationContext,
      services: context.services,
    })),
  },
}).createMachine({
  id: "generation",
  initial: "idle",
  context: ({ input }) => ({
    ...initialGenerationContext,
    services: input.services,
  }),
  on: {
    selectScreen: { actions: "selectScreen" },
    focusTargetChanged: { actions: "changeFocusTarget" },
    chatInputChanged: { actions: "changeChatInput" },
    hydrate: { actions: "hydrateProject" },
    reset: { target: ".idle", actions: "resetContext" },
  },
  states: {
    idle: {
      on: {
        definitionRequested: {
          target: "defining",
          actions: ["storeDefinitionRequest", "resetPanels", "startDefinition"],
        },
        mockRequested: {
          target: "mockingSingle",
          actions: "startMockSingle",
        },
        bulkMocksRequested: {
          target: "mockingBulk",
          actions: "startMockBulk",
        },
        chatRequested: {
          target: "chatting",
          actions: "startChat",
        },
      },
    },
    defining: {
      invoke: {
        id: "definitionGenerator",
        src: "generateDefinition",
        input: ({ context }) => ({
          request: requiredRequest(
            context.definitionRequest,
            "Missing definition request"
          ),
          services: context.services,
        }),
      },
      on: {
        definitionProgress: { actions: "updateDefinitionProgress" },
        definitionDone: { actions: ["finishDefinition", "reloadProjects"] },
        definitionError: { actions: "failDefinition" },
        definitionFinish: { target: "idle" },
        stop: { target: "idle" },
      },
    },
    mockingSingle: {
      invoke: {
        id: "mockGenerator",
        src: "generateMock",
        input: ({ context }) => ({
          request: requiredRequest(context.mockRequest, "Missing mock request"),
          services: context.services,
        }),
      },
      on: {
        mockStream: { actions: "streamMock" },
        mockDone: { actions: "storeMock" },
        mockError: { actions: "failMock" },
        mockSuccessSideEffects: { actions: "applyMockSuccessSideEffects" },
        mockFinish: { target: "idle", actions: "settleMock" },
        stop: { target: "idle", actions: "settleMock" },
      },
    },
    mockingBulk: {
      invoke: {
        id: "bulkMockGenerator",
        src: "generateAllMocks",
        input: ({ context }) => ({
          request: requiredRequest(
            context.bulkMockRequest,
            "Missing bulk mock request"
          ),
          services: context.services,
        }),
      },
      on: {
        mockStream: { actions: "streamMock" },
        mockDone: { actions: "storeMock" },
        mockBulkProgress: { actions: "updateMockBulkProgress" },
        mockError: { actions: "failMock" },
        mockSuccessSideEffects: { actions: "applyMockSuccessSideEffects" },
        mockFinish: { target: "idle", actions: "settleMock" },
        stop: { target: "idle", actions: "settleMock" },
      },
    },
    chatting: {
      invoke: {
        id: "chatEditor",
        src: "editChat",
        input: ({ context }) => ({
          request: requiredRequest(context.chatRequest, "Missing chat request"),
          services: context.services,
        }),
      },
      on: {
        mockStream: { actions: "streamMock" },
        chatRestore: { actions: "restoreChat" },
        chatProjectDone: { actions: ["applyChatProject", "reloadProjects"] },
        chatError: { actions: "failChat" },
        chatFinish: { target: "idle", actions: "settleChat" },
      },
    },
  },
});

export const initialGenerationSnapshot = getInitialSnapshot(generationMachine, {
  services: noopServices,
});
export type GenerationSnapshot = typeof initialGenerationSnapshot;

export function generationSnapshotReducer(
  snapshot: GenerationSnapshot,
  event: GenerationAction
): GenerationSnapshot {
  return getNextSnapshot(generationMachine, snapshot, event);
}

export type GenerationUxState = {
  phase: "idle" | "definition" | "mock" | "bulkMock" | "chat";
  busy: boolean;
  canStop: boolean;
  message: string | null;
};

export function selectGenerationUx(snapshot: GenerationSnapshot): GenerationUxState {
  const { context } = snapshot;
  if (snapshot.matches("defining")) {
    return {
      phase: "definition",
      busy: true,
      canStop: true,
      message:
        context.defProgress > 0
          ? `画面定義を生成中 (${context.defProgress.toLocaleString()}文字受信)`
          : "画面定義を生成中",
    };
  }
  if (snapshot.matches("mockingSingle")) {
    return {
      phase: "mock",
      busy: true,
      canStop: true,
      message: "選択中のHTMLモックを生成中",
    };
  }
  if (snapshot.matches("mockingBulk")) {
    const progress = context.bulkProgress;
    return {
      phase: "bulkMock",
      busy: true,
      canStop: true,
      message: progress
        ? `HTMLモックを一括生成中 (${progress.done}/${progress.total})`
        : "HTMLモックを一括生成中",
    };
  }
  if (snapshot.matches("chatting")) {
    return {
      phase: "chat",
      busy: true,
      canStop: false,
      message: "修正内容を反映中",
    };
  }
  return {
    phase: "idle",
    busy: false,
    canStop: false,
    message: null,
  };
}
