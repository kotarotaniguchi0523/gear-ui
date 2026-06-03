import { describe, expect, it } from "vitest";
import {
  generateDefinitionRequestSchema,
  generateMockRequestSchema,
  screenDefinitionSchema,
  screenDefinitionSetSchema,
} from "@/lib/schemas";

const minimalScreen = {
  screenId: "SCR-001",
  screenName: "ユーザー一覧",
};

describe("screenDefinitionSchema", () => {
  it("accepts a screen with only the required fields", () => {
    expect(screenDefinitionSchema.safeParse(minimalScreen).success).toBe(true);
  });

  it("accepts a fully populated screen", () => {
    const full = {
      ...minimalScreen,
      category: "マスタ管理",
      targetUser: "管理者",
      overview: "ユーザーを一覧表示する画面",
      components: [{ name: "テーブル", type: "table", description: "一覧" }],
      operationSteps: [{ step: 1, action: "開く", systemResponse: "表示" }],
      fields: [{ name: "氏名", type: "text", required: true }],
      events: [{ trigger: "クリック", action: "検索" }],
      transitions: [{ action: "詳細", destination: "SCR-002" }],
    };
    expect(screenDefinitionSchema.safeParse(full).success).toBe(true);
  });

  it("rejects a screen missing screenName", () => {
    expect(
      screenDefinitionSchema.safeParse({ screenId: "SCR-001" }).success
    ).toBe(false);
  });

  it("rejects an operationStep whose step is not a number", () => {
    const bad = {
      ...minimalScreen,
      operationSteps: [{ step: "1", action: "開く" }],
    };
    expect(screenDefinitionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("screenDefinitionSetSchema", () => {
  it("accepts an empty screens array", () => {
    expect(screenDefinitionSetSchema.safeParse({ screens: [] }).success).toBe(
      true
    );
  });

  it("rejects a payload without a screens array", () => {
    expect(screenDefinitionSetSchema.safeParse({}).success).toBe(false);
  });
});

describe("generateDefinitionRequestSchema", () => {
  it("accepts a non-empty requirement", () => {
    expect(
      generateDefinitionRequestSchema.safeParse({ requirement: "在庫管理" })
        .success
    ).toBe(true);
  });

  it("rejects an empty requirement", () => {
    expect(
      generateDefinitionRequestSchema.safeParse({ requirement: "" }).success
    ).toBe(false);
  });

  it("rejects a requirement over the length limit", () => {
    expect(
      generateDefinitionRequestSchema.safeParse({
        requirement: "あ".repeat(20001),
      }).success
    ).toBe(false);
  });
});

describe("generateMockRequestSchema", () => {
  it("accepts a request with design rules including a color palette", () => {
    const parsed = generateMockRequestSchema.safeParse({
      screen: minimalScreen,
      designRules: { color: "indigo", density: "compact" },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a request without design rules (optional)", () => {
    expect(
      generateMockRequestSchema.safeParse({ screen: minimalScreen }).success
    ).toBe(true);
  });

  it("rejects an unknown color palette", () => {
    const parsed = generateMockRequestSchema.safeParse({
      screen: minimalScreen,
      designRules: { color: "crimson" },
    });
    expect(parsed.success).toBe(false);
  });
});
