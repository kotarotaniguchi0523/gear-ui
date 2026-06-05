import type { DesignRules, ScreenDefinition } from "@/lib/schemas";

export const SCREEN_MOCK_SYSTEM_PROMPT = `あなたはプロのフロントエンドエンジニアです。
ユーザーが提示する「画面UI定義書JSON」から、レンダリング可能なHTMLモックを1画面分生成してください。

【出力形式】
- 単一の自己完結したHTML文書（<!DOCTYPE html> から </html> まで）を出力
- Tailwind CSS は CDN (https://cdn.tailwindcss.com) を <head> 内で読み込むこと
- カスタムテーマトークンの読み込み用に、<head> 内で <link rel="stylesheet" href="/tokens.css" /> を必ず含めること
- 出力はHTMLのみ。説明文・前置き・コードフェンスは一切不要

【★★★ デザイントークン縛り（最重要）★★★】
このルールに違反した出力は無効です。

1. **生のカラーコード禁止**: \`#3b82f6\`, \`rgb(...)\`, \`bg-blue-500\`, \`text-red-600\` のような固定色は一切使用しないこと
2. **必ずセマンティッククラスを使用**: 色・余白・角丸はCSS変数経由のセマンティック名のみ
   - 背景: \`bg-[var(--color-bg)]\`, \`bg-[var(--color-surface)]\`, \`bg-[var(--color-primary)]\`
   - 文字色: \`text-[var(--color-fg)]\`, \`text-[var(--color-muted)]\`, \`text-[var(--color-primary-fg)]\`
   - ボーダー: \`border-[var(--color-border)]\`
   - 角丸: \`rounded-[var(--radius-sm)]\`, \`rounded-[var(--radius-md)]\`, \`rounded-[var(--radius-lg)]\`
3. **font-family も指定しない**: tokens.css 側で body に設定されるため、HTML 側ではフォント指定を一切書かない
4. レイアウト用のクラス（flex, grid, p-4, gap-2, w-full, max-w-* など）は通常通り使ってよい

【利用可能なCSS変数（tokens.css で定義済み）】
- \`--color-bg\`: ページ背景
- \`--color-surface\`: カード・パネル背景
- \`--color-fg\`: メインテキスト
- \`--color-muted\`: 補助テキスト
- \`--color-border\`: 罫線
- \`--color-primary\`: プライマリーアクション背景
- \`--color-primary-fg\`: プライマリーアクション文字
- \`--color-danger\`: 危険アクション背景
- \`--radius-sm\`, \`--radius-md\`, \`--radius-lg\`: 角丸サイズ

【作成ガイドライン】
- 画面全体は標準的なノートPC幅（およそ1024px）を想定し、横に広がりすぎないコンパクトなレイアウトにする。主要コンテンツは中央寄せの最大幅コンテナ（例: \`max-w-[1024px] mx-auto\`）でまとめ、フォントや余白も詰め込みすぎず読みやすい標準サイズにする
- 画面UI定義書の components / fields / operationSteps / events / transitions をすべて反映した、業務システムらしいレイアウトを作る
- フォーム項目は label とセットで配置し、required は \`*\` マークで明示
- ボタンや遷移先（transitions）は対応するボタンとして配置
- 文言・項目名は定義書の日本語をそのまま使う
- ダミーデータを使ってもよいが、それらしく業務的な値を入れる
- アクセシビリティ的に問題ない HTML 構造（h1/h2、label/input の関連付け等）にする`;

/**
 * モック「編集」チャット用のシステムプロンプト。
 *
 * 生成用の SCREEN_MOCK_SYSTEM_PROMPT は「出力はHTMLのみ・違反は無効」とHTML出力を
 * 強制するため、ユーザーが質問・相談を送ってもモデルがHTMLを作り直してしまう。
 * 編集チャットでは「修正指示のときだけHTML、そうでなければテキストで回答し再生成しない」
 * という二択を明示する。テキスト応答はサーバ側で会話として扱われ、モックは温存される。
 */
export const SCREEN_MOCK_EDIT_SYSTEM_PROMPT = `あなたは既存のHTMLモック（1画面分）を編集するアシスタントです。
ユーザーのメッセージを読み、次の2通りのいずれかで応答してください。

【1. メッセージが「具体的な修正指示」のとき】
例:「電話番号の列を追加」「ボタンを赤く」「余白を詰めて」「項目名を変更して」
→ 指示を反映した「完全なHTML文書」（<!DOCTYPE html> から </html> まで）だけを出力する。
→ デザイントークン縛りを厳守する: 生のカラーコード・固定色クラス（例 #3b82f6, bg-blue-500）禁止、
   色・余白・角丸は CSS変数経由のセマンティック名のみ（例 bg-[var(--color-primary)]）、
   <head> 内の <link rel="stylesheet" href="/tokens.css" /> は必ず維持する。
→ 説明文・前置き・コードフェンスは一切付けない。

【2. メッセージが「修正指示ではない」とき】
例:「他の画面も更新できる？」「これでいい？」「次は何をすれば？」などの質問・相談・確認・雑談
→ HTMLを一切出力せず、モックの再生成もしない。
→ プレーンテキストで簡潔に回答する（HTMLタグ・コードフェンス・<!DOCTYPE> を含めない）。
→ 編集対象は「いま表示している1画面」のみ。他の画面について聞かれたら、
   対象にしたい画面を選択してから指示するよう案内する。

判定に迷う曖昧なメッセージは 2 を優先し、勝手にHTMLを作り直さないこと。`;

const DENSITY_RULES: Record<NonNullable<DesignRules["density"]>, string> = {
  compact: "情報密度を高めにし、余白・パディングは控えめにしてコンパクトにまとめる",
  standard: "標準的な余白バランスにする",
  comfortable: "余白・行間を広めにとり、ゆったりと読みやすいレイアウトにする",
};

const RADIUS_RULES: Record<NonNullable<DesignRules["radius"]>, string> = {
  sharp:
    "角丸は最小限にする（rounded-none もしくは rounded-[var(--radius-sm)] を基本とし、シャープで端正な印象に）",
  soft: "角丸は標準的にする（rounded-[var(--radius-md)] を基本にする）",
  round:
    "角丸は大きめにする（rounded-[var(--radius-lg)] を基本とし、柔らかく親しみやすい印象に）",
};

const LAYOUT_RULES: Record<NonNullable<DesignRules["layout"]>, string> = {
  auto: "",
  sidebar: "左サイドバーのナビゲーションを基本としたレイアウトにする",
  topnav: "上部のナビゲーションバーを基本としたレイアウトにする",
};

const TONE_RULES: Record<NonNullable<DesignRules["tone"]>, string> = {
  auto: "",
  professional: "堅実で信頼感のある、業務システムらしいトーンでまとめる",
  friendly: "親しみやすく柔らかいトーンでまとめる",
  minimal: "余計な装飾を排した、ミニマルで洗練されたトーンでまとめる",
  playful: "明るく遊び心のあるトーンでまとめる",
};

/**
 * デザインルールを、モック生成プロンプトに差し込む指示テキストへ変換する。
 * 指定が一つも無い場合は空文字を返す。
 */
export function buildDesignRulesBlock(rules?: DesignRules | null): string {
  if (!rules) return "";

  const lines: string[] = [];
  if (rules.density) lines.push(`- 情報密度: ${DENSITY_RULES[rules.density]}`);
  if (rules.radius) lines.push(`- 角丸: ${RADIUS_RULES[rules.radius]}`);
  if (rules.layout && LAYOUT_RULES[rules.layout]) {
    lines.push(`- レイアウト: ${LAYOUT_RULES[rules.layout]}`);
  }
  if (rules.tone && TONE_RULES[rules.tone]) {
    lines.push(`- トーン: ${TONE_RULES[rules.tone]}`);
  }
  const notes = rules.notes?.trim();
  if (notes) lines.push(`- 追加のデザイン指示: ${notes}`);

  if (lines.length === 0) return "";

  return `\n\n【★ デザインルール（このプロジェクト固有の指定。デザイントークン縛りは引き続き厳守すること）】
以下の方針に従ってモックの見た目を整えてください。
${lines.join("\n")}`;
}

export function buildScreenMockUserPrompt(
  screen: ScreenDefinition,
  designRules?: DesignRules | null
): string {
  return `以下の画面UI定義書JSONから、HTMLモックを生成してください。

【画面UI定義書 — 次の区切り行の間が本体】
----- BEGIN SCREEN JSON -----
${JSON.stringify(screen, null, 2)}
----- END SCREEN JSON -----${buildDesignRulesBlock(designRules)}

要件をすべて反映した、デザイントークン縛りに従う1ページのHTMLを出力してください。`;
}
