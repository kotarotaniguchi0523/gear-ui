export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  // Try the fenced block first, then the full response. The non-greedy fence
  // match can stop early at a ``` that appears *inside* a JSON string value, so
  // falling back to `raw` recovers the complete object in that case.
  const candidates = fenced ? [fenced[1], raw] : [raw];

  for (const text of candidates) {
    const candidate = text.trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const firstBrace = candidate.search(/[{[]/);
      const lastBrace = Math.max(
        candidate.lastIndexOf("}"),
        candidate.lastIndexOf("]")
      );
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
        } catch {
          // Fall through to the next candidate.
        }
      }
    }
  }
  throw new Error("No JSON object/array found in response");
}

export function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return raw.trim();
}

/**
 * 抽出済みテキストが「HTML文書らしい」かを判定する。
 * モック編集に修正指示ではなく質問が来た場合、Codex はHTMLではなく会話文を返す。
 * その会話文をモックとして保存してしまわないよう、保存前のガードに使う。
 */
export function looksLikeHtmlDocument(text: string): boolean {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  const startsLikeHtml =
    head.startsWith("<!doctype html") || head.startsWith("<html");
  return startsLikeHtml && /<\/html\s*>/i.test(text);
}
