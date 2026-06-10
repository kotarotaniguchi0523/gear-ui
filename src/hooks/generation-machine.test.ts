import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
  generationMachine,
  generationSnapshotReducer,
  initialGenerationSnapshot,
  selectGenerationUx,
} from "@/hooks/generation-machine";
import type { GenerationServices } from "@/hooks/generation-machine";
import type { Project } from "@/hooks/use-projects";
import type { ScreenDefinitionSet } from "@/lib/schemas";

const defs: ScreenDefinitionSet = {
  screens: [
    {
      screenId: "SCR-001",
      screenName: "Dashboard",
    },
  ],
};

const project: Project = {
  id: "project-1",
  name: "Demo",
  requirement: "管理画面",
  definitions: defs,
  mocks: { "SCR-001": "<html>updated</html>" },
  designRules: null,
  chat: [],
  mockStale: {},
  definitionStale: {},
  createdAt: 1,
  updatedAt: 2,
};

function createTestServices(
  overrides: Partial<GenerationServices> = {}
): GenerationServices {
  return {
    generateDefinition: async () => {},
    generateMock: async () => {},
    generateAllMocks: async () => {},
    editChat: async () => {},
    reloadProjects: () => {},
    resetPanels: () => {},
    enterFocusMode: () => {},
    ...overrides,
  };
}

describe("generationMachine", () => {
  it("exposes definition progress as UX state", () => {
    const running = generationSnapshotReducer(initialGenerationSnapshot, {
      type: "definitionRequested",
      requirement: "管理画面",
    });
    const progressed = generationSnapshotReducer(running, {
      type: "definitionProgress",
      length: 1200,
    });

    expect(progressed.matches("defining")).toBe(true);
    expect(progressed.context.defProgress).toBe(1200);
    expect(selectGenerationUx(progressed)).toMatchObject({
      phase: "definition",
      busy: true,
      canStop: true,
    });
    expect(selectGenerationUx(progressed).message).toContain("1,200");
  });

  it("stores generated mocks and clears bulk progress when settled", () => {
    const bulk = generationSnapshotReducer(initialGenerationSnapshot, {
      type: "bulkMocksRequested",
      request: {
        targets: [
          defs.screens[0],
          { screenId: "SCR-002", screenName: "Settings" },
        ],
        projectId: "project-1",
        designRules: null,
        enterFocusOnDone: false,
        reloadOnDone: false,
      },
    });
    const stored = generationSnapshotReducer(bulk, {
      type: "mockDone",
      screenId: "SCR-001",
      html: "<html></html>",
    });
    const progressed = generationSnapshotReducer(stored, {
      type: "mockBulkProgress",
      done: 1,
      total: 2,
    });
    const settled = generationSnapshotReducer(progressed, {
      type: "mockFinish",
    });

    expect(progressed.matches("mockingBulk")).toBe(true);
    expect(progressed.context.mocks["SCR-001"]).toBe("<html></html>");
    expect(selectGenerationUx(progressed).message).toContain("1/2");
    expect(settled.matches("idle")).toBe(true);
    expect(settled.context.bulkProgress).toBeNull();
  });

  it("keeps optimistic chat reversible on error", () => {
    const chatting = generationSnapshotReducer(initialGenerationSnapshot, {
      type: "chatRequested",
      request: {
        projectId: "project-1",
        target: "definition",
        instruction: "検索を追加",
        clearInput: true,
        optimistic: {
          id: "tmp-1",
          role: "user",
          target: "definition",
          text: "検索を追加",
          ts: 1,
        },
        restoreInput: "検索を追加",
        errorMessage: "修正に失敗しました",
      },
    });
    const restored = generationSnapshotReducer(chatting, {
      type: "chatRestore",
      optimisticId: "tmp-1",
      input: "検索を追加",
    });

    expect(chatting.matches("chatting")).toBe(true);
    expect(chatting.context.chat).toHaveLength(1);
    expect(restored.context.chat).toHaveLength(0);
    expect(restored.context.chatInput).toBe("検索を追加");
  });

  it("accepts completed definitions then returns to idle", () => {
    const running = generationSnapshotReducer(initialGenerationSnapshot, {
      type: "definitionRequested",
      requirement: "管理画面",
    });
    const done = generationSnapshotReducer(running, {
      type: "definitionDone",
      defs,
    });
    const idle = generationSnapshotReducer(done, {
      type: "definitionFinish",
    });

    expect(done.context.defs).toEqual(defs);
    expect(idle.matches("idle")).toBe(true);
    expect(selectGenerationUx(idle).busy).toBe(false);
  });

  it("processes events through the XState actor runtime", () => {
    const actor = createActor(generationMachine, {
      input: { services: createTestServices() },
    });
    actor.start();

    actor.send({
      type: "bulkMocksRequested",
      request: {
        targets: [
          defs.screens[0],
          { screenId: "SCR-002", screenName: "Settings" },
          { screenId: "SCR-003", screenName: "Profile" },
        ],
        projectId: "project-1",
        designRules: null,
        enterFocusOnDone: false,
        reloadOnDone: false,
      },
    });
    actor.send({
      type: "mockBulkProgress",
      done: 2,
      total: 3,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("mockingBulk")).toBe(true);
    expect(snapshot.context.bulkProgress).toEqual({ done: 2, total: 3 });
    expect(selectGenerationUx(snapshot).message).toContain("2/3");

    actor.stop();
  });

  it("runs definition generation through an invoked actor", async () => {
    let resetPanels = 0;
    let reloadProjects = 0;
    const actor = createActor(generationMachine, {
      input: {
        services: createTestServices({
          resetPanels: () => {
            resetPanels += 1;
          },
          reloadProjects: () => {
            reloadProjects += 1;
          },
          generateDefinition: async (request, _signal, send) => {
            expect(request.requirement).toBe("管理画面");
            send({ type: "definitionProgress", length: 42 });
            send({ type: "definitionDone", defs });
          },
        }),
      },
    });
    actor.start();

    actor.send({ type: "definitionRequested", requirement: "管理画面" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("idle")).toBe(true);
    expect(snapshot.context.defs).toEqual(defs);
    expect(snapshot.context.defProgress).toBe(42);
    expect(resetPanels).toBe(1);
    expect(reloadProjects).toBe(1);

    actor.stop();
  });

  it("runs mock generation through an invoked actor and side-effect actions", async () => {
    let enteredFocus = 0;
    let reloadProjects = 0;
    const actor = createActor(generationMachine, {
      input: {
        services: createTestServices({
          enterFocusMode: () => {
            enteredFocus += 1;
          },
          reloadProjects: () => {
            reloadProjects += 1;
          },
          generateMock: async (request, _signal, send) => {
            send({ type: "mockStream", html: "<html>draft</html>" });
            send({
              type: "mockDone",
              screenId: request.screen.screenId,
              html: "<html>final</html>",
            });
            send({
              type: "mockSuccessSideEffects",
              enterFocus: request.enterFocusOnDone,
              reload: request.reloadOnDone,
            });
          },
        }),
      },
    });
    actor.start();

    actor.send({
      type: "mockRequested",
      request: {
        screen: defs.screens[0],
        projectId: "project-1",
        designRules: null,
        streamPreview: true,
        enterFocusOnDone: true,
        reloadOnDone: true,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("idle")).toBe(true);
    expect(snapshot.context.mocks["SCR-001"]).toBe("<html>final</html>");
    expect(snapshot.context.streamingMockHtml).toBeNull();
    expect(enteredFocus).toBe(1);
    expect(reloadProjects).toBe(1);

    actor.stop();
  });

  it("runs chat editing through an invoked actor", async () => {
    let reloadProjects = 0;
    const optimistic = {
      id: "tmp-1",
      role: "user" as const,
      target: "mock" as const,
      text: "余白を詰めて",
      ts: 1,
      screenId: "SCR-001",
    };
    const actor = createActor(generationMachine, {
      input: {
        services: createTestServices({
          reloadProjects: () => {
            reloadProjects += 1;
          },
          editChat: async (_request, _signal, send) => {
            send({ type: "mockStream", html: "<html>editing</html>" });
            send({ type: "chatProjectDone", project });
          },
        }),
      },
    });
    actor.start();

    actor.send({
      type: "chatRequested",
      request: {
        projectId: "project-1",
        target: "mock",
        instruction: "余白を詰めて",
        optimistic,
        clearInput: true,
        restoreInput: "余白を詰めて",
        screenId: "SCR-001",
        errorMessage: "修正に失敗しました",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("idle")).toBe(true);
    expect(snapshot.context.defs).toEqual(defs);
    expect(snapshot.context.mocks["SCR-001"]).toBe("<html>updated</html>");
    expect(snapshot.context.streamingMockHtml).toBeNull();
    expect(reloadProjects).toBe(1);

    actor.stop();
  });
});
