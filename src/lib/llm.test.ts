import { describe, expect, it } from "vitest";
import {
  extractHtml,
  extractJson,
  looksLikeHtmlDocument,
  parseProvider,
  resolveModel,
} from "@/lib/llm";

describe("parseProvider", () => {
  it("defaults to anthropic when unset", () => {
    expect(parseProvider(undefined)).toBe("anthropic");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseProvider("  OpenAI ")).toBe("openai");
  });

  it("accepts the supported providers", () => {
    expect(parseProvider("anthropic")).toBe("anthropic");
    expect(parseProvider("openai")).toBe("openai");
  });

  it("throws on an unsupported provider", () => {
    expect(() => parseProvider("gemini")).toThrow(/Unsupported LLM_PROVIDER/);
  });
});

describe("resolveModel", () => {
  it("uses the provider default when nothing is overridden", () => {
    expect(resolveModel("anthropic")).toBe("claude-sonnet-4-5");
    expect(resolveModel("openai")).toBe("gpt-4o");
  });

  it("prefers the env model over the default", () => {
    expect(resolveModel("openai", undefined, "gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  it("prefers an explicit model over both env and default", () => {
    expect(resolveModel("openai", "o3", "gpt-4o-mini")).toBe("o3");
  });

  it("ignores a blank env model", () => {
    expect(resolveModel("anthropic", undefined, "   ")).toBe("claude-sonnet-4-5");
  });
});

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a bare JSON array", () => {
    expect(extractJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("unwraps a ```json fenced block", () => {
    const raw = 'Here you go:\n```json\n{"screens": []}\n```';
    expect(extractJson(raw)).toEqual({ screens: [] });
  });

  it("unwraps a fenced block without a language tag", () => {
    const raw = "```\n{\"ok\": true}\n```";
    expect(extractJson(raw)).toEqual({ ok: true });
  });

  it("slices JSON out of surrounding prose when not fenced", () => {
    const raw = 'Sure! {"id": "SCR-001"} — hope that helps.';
    expect(extractJson(raw)).toEqual({ id: "SCR-001" });
  });

  it("handles nested objects when slicing from prose", () => {
    const raw = 'result: {"a":{"b":[1,2]}} done';
    expect(extractJson(raw)).toEqual({ a: { b: [1, 2] } });
  });

  it("recovers JSON when a fenced block is truncated by backticks in a string", () => {
    // The non-greedy fence regex stops at the ``` inside the string value, so the
    // fenced capture is invalid JSON; falling back to the full raw recovers it.
    const raw = '```json\n{"note": "see ```code``` here", "ok": true}\n```';
    expect(extractJson(raw)).toEqual({ note: "see ```code``` here", ok: true });
  });

  it("throws when there is no JSON at all", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("extractHtml", () => {
  it("unwraps an ```html fenced block", () => {
    const raw = "```html\n<!DOCTYPE html><html></html>\n```";
    expect(extractHtml(raw)).toBe("<!DOCTYPE html><html></html>");
  });

  it("unwraps a fenced block without a language tag", () => {
    const raw = "```\n<div>hi</div>\n```";
    expect(extractHtml(raw)).toBe("<div>hi</div>");
  });

  it("returns trimmed raw content when not fenced", () => {
    const raw = "  <span>plain</span>  ";
    expect(extractHtml(raw)).toBe("<span>plain</span>");
  });
});

describe("looksLikeHtmlDocument", () => {
  it("accepts a full <!DOCTYPE html> document", () => {
    expect(
      looksLikeHtmlDocument("<!DOCTYPE html><html><body>x</body></html>")
    ).toBe(true);
  });

  it("accepts a document starting with <html>", () => {
    expect(looksLikeHtmlDocument("<html lang=\"ja\"></html>")).toBe(true);
  });

  it("rejects a conversational clarification reply", () => {
    const reply =
      "申し訳ございませんが、ご質問の意図を正確に理解できませんでした。全ての画面もやれる？について…";
    expect(looksLikeHtmlDocument(reply)).toBe(false);
  });

  it("rejects an HTML fragment without a closing </html>", () => {
    expect(looksLikeHtmlDocument("<div>just a fragment</div>")).toBe(false);
  });
});
