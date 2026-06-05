// モックHTMLをプレビュー iframe に安全に描画するためのクライアント側ヘルパ群。

// モックのライブ描画は iframe のフルリロードを伴うので、この間隔で間引く。
export const LIVE_PREVIEW_INTERVAL_MS = 350;

// モックプレビューの最小幅（px）。これより枠が狭いと横スクロールで見せる。
// モックは約1024px幅を想定して生成されるので、それに合わせる。
export const MOCK_PREVIEW_MIN_WIDTH = 1024;

// ユーザーが生成を中止したときの AbortError は、エラー表示せず黙って戻す。
export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

// ストリーミング途中のHTMLをプレビューへ描画する際、まだ閉じていない可能性のある
// ```html フェンスを取り除く。確定HTMLはサーバ側 extractHtml が整形済み。
export function stripCodeFence(text: string): string {
  return text.replace(/^```(?:html)?\s*\n?/i, "").replace(/```\s*$/i, "");
}

// ストリーミング途中の文字列が「HTML文書の書き出し」かを判定する。
// モック編集に修正指示ではなく質問・雑談が来ると、LLM は会話文を返す。それを
// プレビューへ描画しないよう、描画開始を「HTMLらしさが確定してから」に遅らせる。
// 受信途中なので終端 </html> は待たず、先頭が <!doctype html / <html かだけを見る。
export function looksLikeHtmlStart(text: string): boolean {
  const head = text.trimStart().slice(0, 64).toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

// モックは静的プレビューなので、リンククリックやフォーム送信で iframe が遷移すると
// プレビューが消えてしまう。キャプチャ段階でそれらを抑止するスクリプトを注入する。
// （iframe は allow-scripts のみ・top遷移は不可なので、無効化対象は iframe 内ナビのみ）
const PREVIEW_GUARD_SCRIPT = `<script>
(function () {
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest("a[href]") : null;
    if (a) e.preventDefault();
  }, true);
  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
})();
</script>`;

export function injectPreviewGuards(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, PREVIEW_GUARD_SCRIPT + "</body>");
  }
  return html + PREVIEW_GUARD_SCRIPT;
}

// プレビュー用に tokens.css の <link> を選択中カラーのトークンへ差し替え、
// さらにナビ無効化ガードを注入した最終的な srcDoc を組み立てる。
export function buildPreviewSrcDoc(html: string, color: string): string {
  const themed = html.replace(
    /href=["']\/tokens(?:\.css)?["']/g,
    `href="/tokens/${color}.css"`
  );
  return injectPreviewGuards(themed);
}
