import { describe, it, expect } from "vitest";
import { computeDefinitionUpdate, type Project } from "@/lib/repo/projects";
import type { ScreenDefinition, ScreenDefinitionSet } from "@/lib/schemas";

function screen(id: string, name: string, overview = ""): ScreenDefinition {
  return { screenId: id, screenName: name, overview };
}

function project(
  screens: ScreenDefinition[],
  mocks: Record<string, string>,
  mockStale: Record<string, boolean> = {},
  definitionStale: Record<string, boolean> = {}
): Project {
  return {
    id: "p1",
    name: "test",
    requirement: "",
    definitions: { screens },
    mocks,
    designRules: null,
    chat: [],
    mockStale,
    definitionStale,
    createdAt: 0,
    updatedAt: 0,
  };
}

const set = (screens: ScreenDefinition[]): ScreenDefinitionSet => ({ screens });

describe("computeDefinitionUpdate", () => {
  it("変更が無ければ既存モックは残り、staleにならない", () => {
    const existing = project([screen("SCR-001", "ログイン")], { "SCR-001": "<html>" });
    const { mocks, mockStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン")])
    );
    expect(mocks).toEqual({ "SCR-001": "<html>" });
    expect(mockStale).toEqual({});
  });

  it("定義が変わった画面のモックはstaleになる", () => {
    const existing = project([screen("SCR-001", "ログイン", "旧")], {
      "SCR-001": "<html>",
    });
    const { mocks, mockStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン", "新しい概要")])
    );
    expect(mocks).toEqual({ "SCR-001": "<html>" });
    expect(mockStale).toEqual({ "SCR-001": true });
  });

  it("削除された画面のモックは破棄される", () => {
    const existing = project(
      [screen("SCR-001", "ログイン"), screen("SCR-002", "一覧")],
      { "SCR-001": "<a>", "SCR-002": "<b>" }
    );
    const { mocks, mockStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン")])
    );
    expect(mocks).toEqual({ "SCR-001": "<a>" });
    expect(mockStale).toEqual({});
  });

  it("モックが無い新規画面はstale対象にならない", () => {
    const existing = project([screen("SCR-001", "ログイン")], { "SCR-001": "<a>" });
    const { mocks, mockStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン"), screen("SCR-002", "新規")])
    );
    expect(mocks).toEqual({ "SCR-001": "<a>" });
    expect(mockStale).toEqual({});
  });

  it("既にstaleだった画面は定義が変わらなくてもstaleを維持する", () => {
    const existing = project(
      [screen("SCR-001", "ログイン")],
      { "SCR-001": "<a>" },
      { "SCR-001": true }
    );
    const { mockStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン")])
    );
    expect(mockStale).toEqual({ "SCR-001": true });
  });

  it("definitionStaleな画面は定義を編集すると解消される", () => {
    const existing = project(
      [screen("SCR-001", "ログイン", "旧")],
      { "SCR-001": "<a>" },
      {},
      { "SCR-001": true }
    );
    const { definitionStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン", "新")])
    );
    expect(definitionStale).toEqual({});
  });

  it("definitionStaleな画面は定義を触らなければフラグを維持する", () => {
    const existing = project(
      [screen("SCR-001", "ログイン"), screen("SCR-002", "一覧", "旧")],
      { "SCR-001": "<a>", "SCR-002": "<b>" },
      {},
      { "SCR-001": true }
    );
    // SCR-002 だけ定義を変更。SCR-001 は未変更なので definitionStale を維持。
    const { definitionStale } = computeDefinitionUpdate(
      existing,
      set([screen("SCR-001", "ログイン"), screen("SCR-002", "一覧", "新")])
    );
    expect(definitionStale).toEqual({ "SCR-001": true });
  });
});
