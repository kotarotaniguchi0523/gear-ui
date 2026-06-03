import type { ScreenDefinitionSet } from "@/lib/schemas";
import { screenSetToMarkdown } from "@/lib/export/markdown";
import { screenSetToXlsx } from "@/lib/export/xlsx";
import { buildMocksZip } from "@/lib/export/mock-zip";

// ブラウザで Blob を生成して名前付きでダウンロードさせるだけのユーティリティ。
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ファイル名に使えない文字を均し、空なら既定名にフォールバック。
function safeFileBase(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned || "screen-definitions";
}

export function downloadMarkdown(set: ScreenDefinitionSet, baseName = "画面UI定義書"): void {
  const md = screenSetToMarkdown(set, baseName);
  triggerDownload(
    new Blob([md], { type: "text/markdown;charset=utf-8" }),
    `${safeFileBase(baseName)}.md`
  );
}

export function downloadXlsx(set: ScreenDefinitionSet, baseName = "画面UI定義書"): void {
  const bytes = screenSetToXlsx(set);
  // Uint8Array の backing buffer が SharedArrayBuffer の可能性を型から排除するため、
  // プレーンな ArrayBuffer に詰め直してから Blob 化する。
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeFileBase(baseName)}.xlsx`
  );
}

// 生成済みのHTMLモックを、画面ごとのファイル + テーマCSS をまとめた .zip で書き出す。
// テーマCSS(/tokens/{color}.css)はサーバの public 配下にあるので取得して同梱する。
export async function downloadMocksZip(
  set: ScreenDefinitionSet,
  mocks: Record<string, string>,
  color: string,
  baseName = "画面モック"
): Promise<void> {
  const res = await fetch(`/tokens/${color}.css`);
  const tokensCss = res.ok ? await res.text() : "";
  const bytes = buildMocksZip(set, mocks, tokensCss);
  // SharedArrayBuffer の可能性を型から外すため、プレーンな ArrayBuffer に詰め直す。
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  triggerDownload(
    new Blob([buffer], { type: "application/zip" }),
    `${safeFileBase(baseName)}.zip`
  );
}
