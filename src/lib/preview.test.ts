import { describe, expect, it } from "vitest";
import { looksLikeHtmlStart, stripCodeFence } from "@/lib/preview";

describe("looksLikeHtmlStart", () => {
  it("accepts a document opening with <!DOCTYPE html>", () => {
    expect(looksLikeHtmlStart("<!DOCTYPE html>\n<html><head>")).toBe(true);
  });

  it("accepts a document opening with <html> (no doctype)", () => {
    expect(looksLikeHtmlStart("<html lang=\"ja\">")).toBe(true);
  });

  it("tolerates leading whitespace", () => {
    expect(looksLikeHtmlStart("\n  <!doctype html><html>")).toBe(true);
  });

  it("rejects a conversational reply while it is streaming", () => {
    expect(
      looksLikeHtmlStart("申し訳ございませんが、ご質問の意図を")
    ).toBe(false);
  });

  it("rejects an incomplete doctype prefix (keeps waiting)", () => {
    expect(looksLikeHtmlStart("<!doc")).toBe(false);
  });
});

describe("stripCodeFence + looksLikeHtmlStart together", () => {
  it("recognises HTML wrapped in an opening ```html fence", () => {
    expect(looksLikeHtmlStart(stripCodeFence("```html\n<!DOCTYPE html>"))).toBe(
      true
    );
  });
});
