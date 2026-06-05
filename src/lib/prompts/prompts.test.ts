import { describe, expect, it } from "vitest";
import {
  SCREEN_DEFINITION_SYSTEM_PROMPT,
  buildScreenDefinitionUserPrompt,
} from "@/lib/prompts/screen-definition";
import {
  SCREEN_MOCK_SYSTEM_PROMPT,
  SCREEN_MOCK_EDIT_SYSTEM_PROMPT,
  buildScreenMockUserPrompt,
  buildDesignRulesBlock,
} from "@/lib/prompts/screen-mock";

describe("buildScreenDefinitionUserPrompt", () => {
  it("embeds the raw requirement text", () => {
    const prompt = buildScreenDefinitionUserPrompt("勤怠管理システム");
    expect(prompt).toContain("勤怠管理システム");
  });
});

describe("buildScreenMockUserPrompt", () => {
  it("embeds the screen definition as pretty-printed JSON", () => {
    const prompt = buildScreenMockUserPrompt({
      screenId: "SCR-001",
      screenName: "ログイン",
    });
    expect(prompt).toContain('"screenName": "ログイン"');
    expect(prompt).toContain('"screenId": "SCR-001"');
  });

  it("omits the design-rules block when no rules are given", () => {
    const prompt = buildScreenMockUserPrompt({
      screenId: "SCR-001",
      screenName: "ログイン",
    });
    expect(prompt).not.toContain("デザインルール");
  });

  it("embeds the design-rules block when rules are given", () => {
    const prompt = buildScreenMockUserPrompt(
      { screenId: "SCR-001", screenName: "ログイン" },
      { density: "compact", notes: "見出しは太めに" }
    );
    expect(prompt).toContain("デザインルール");
    expect(prompt).toContain("情報密度");
    expect(prompt).toContain("見出しは太めに");
  });
});

describe("buildDesignRulesBlock", () => {
  it("returns empty string for null / empty rules", () => {
    expect(buildDesignRulesBlock()).toBe("");
    expect(buildDesignRulesBlock(null)).toBe("");
    expect(buildDesignRulesBlock({})).toBe("");
  });

  it("skips the 'auto' choices that mean no preference", () => {
    const block = buildDesignRulesBlock({ layout: "auto", tone: "auto" });
    expect(block).toBe("");
  });

  it("includes each specified axis", () => {
    const block = buildDesignRulesBlock({
      density: "comfortable",
      radius: "round",
      layout: "sidebar",
      tone: "professional",
    });
    expect(block).toContain("情報密度");
    expect(block).toContain("角丸");
    expect(block).toContain("レイアウト");
    expect(block).toContain("トーン");
  });
});

describe("system prompts", () => {
  it("definition prompt enforces a JSON-only contract", () => {
    expect(SCREEN_DEFINITION_SYSTEM_PROMPT).toContain("screens");
  });

  it("mock prompt enforces the design-token guardrail", () => {
    expect(SCREEN_MOCK_SYSTEM_PROMPT).toContain("--color-primary");
  });

  it("mock edit prompt keeps the design-token guardrail", () => {
    expect(SCREEN_MOCK_EDIT_SYSTEM_PROMPT).toContain("--color-primary");
  });

  it("mock edit prompt allows a plain-text reply for non-edit messages", () => {
    // 質問・相談には再生成せずテキストで返す二択ルールを明示していること。
    expect(SCREEN_MOCK_EDIT_SYSTEM_PROMPT).toContain("プレーンテキスト");
    expect(SCREEN_MOCK_EDIT_SYSTEM_PROMPT).toContain("再生成もしない");
  });
});
