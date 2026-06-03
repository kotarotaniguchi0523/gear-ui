import type { ScreenDefinitionSet } from "@/lib/schemas";
import { buildZip, type ZipEntry } from "@/lib/export/zip";

const encoder = new TextEncoder();

// モックHTML内の tokens.css への参照（/tokens or /tokens.css）を、
// ZIP に同梱する相対パス tokens.css へ差し替える。これでローカル展開しても
// テーマCSSがそのまま当たる。
function rewriteTokensLink(html: string): string {
  return html.replace(/href=["']\/tokens(?:\.css)?["']/g, 'href="tokens.css"');
}

// ファイル名に使えない文字を均す。
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

// 生成済みモック(screenId -> HTML)を、画面ごとのHTMLファイルと
// 共通テーマCSS(tokens.css)をまとめた ZIP のバイト列に組み立てる。
// 未生成の画面はスキップする。
export function buildMocksZip(
  set: ScreenDefinitionSet,
  mocks: Record<string, string>,
  tokensCss: string
): Uint8Array {
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  for (const screen of set.screens) {
    const html = mocks[screen.screenId];
    if (!html) continue;
    const base =
      safeName(`${screen.screenId}_${screen.screenName ?? ""}`) || screen.screenId;
    // 画面名の衝突に備えて連番を振り、ZIP 内での上書きを防ぐ。
    let name = `${base}.html`;
    let i = 2;
    while (used.has(name)) name = `${base}_${i++}.html`;
    used.add(name);
    entries.push({ name, data: encoder.encode(rewriteTokensLink(html)) });
  }

  entries.push({ name: "tokens.css", data: encoder.encode(tokensCss) });
  return buildZip(entries);
}
