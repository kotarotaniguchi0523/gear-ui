import type { DesignRules, ScreenDefinition, ScreenDefinitionSet } from "@/lib/schemas";
import { buildDesignRulesBlock } from "@/lib/prompts/screen-mock";

/**
 * 定義編集（セット全体）のユーザープロンプト。
 * system は SCREEN_DEFINITION_SYSTEM_PROMPT を流用し、出力スキーマを揃える。
 */
export function buildDefinitionEditUserPrompt(
  current: ScreenDefinitionSet,
  instruction: string
): string {
  return `あなたは既存の「画面UI定義書セット（JSON）」を、ユーザーの修正指示に従って編集します。
指示を反映した「セット全体」の新しいJSONを、同じスキーマで出力してください。

【現在の定義（JSON）— 次の区切り行の間が本体】
----- BEGIN DEFINITION JSON -----
${JSON.stringify(current, null, 2)}
----- END DEFINITION JSON -----

【ユーザーの修正指示】
${instruction}

【編集ルール】
- 既存画面の screenId は変更しないこと。新規画面を追加する場合は続き番号で SCR-XXX を採番する。
- 指示に関係しない画面・項目は一切変更せず、そのまま残すこと。
- transitions の destination は引き続き他画面と整合させること。
- 出力は screens 配列を持つJSONのみ。説明文・前置き・コードフェンス外のテキストは不要。`;
}

/**
 * モック → 定義 の逆同期プロンプト。
 * 直接編集されたモックHTMLの内容を、対象画面の定義へ反映させる。
 * 出力は定義セット全体（同じスキーマ）。
 */
export function buildDefinitionSyncUserPrompt(
  current: ScreenDefinitionSet,
  screen: ScreenDefinition,
  currentHtml: string
): string {
  return `あなたは既存の「画面UI定義書セット（JSON）」を、編集済みのHTMLモックの内容に合わせて更新します。
対象画面のモックがユーザーによって直接編集され、定義（components / fields / events / transitions など）と食い違っている可能性があります。
モックHTMLから読み取れる項目・操作・遷移を、対象画面の定義へ反映した「セット全体」の新しいJSONを、同じスキーマで出力してください。

【同期対象の画面】${screen.screenName}（${screen.screenId}）

【現在の定義（JSON）— 次の区切り行の間が本体】
----- BEGIN DEFINITION JSON -----
${JSON.stringify(current, null, 2)}
----- END DEFINITION JSON -----

【編集済みモックHTML（このHTMLが正。次の区切り行の間が本体）】
----- BEGIN CURRENT HTML -----
${currentHtml}
----- END CURRENT HTML -----

【編集ルール】
- 反映先は対象画面（${screen.screenId}）の定義のみ。他画面は一切変更せず、そのまま残すこと。
- 既存画面の screenId は変更しないこと。
- モックに現れる入力項目は fields に、ボタン/アクションは events や transitions に、見出し・領域は components に対応づけて反映する。
- モックから読み取れない情報（既存の overview など）は無理に消さず、矛盾しない範囲で活かすこと。
- transitions の destination は引き続き他画面と整合させること。
- 出力は screens 配列を持つJSONのみ。説明文・前置き・コードフェンス外のテキストは不要。`;
}

/**
 * モック編集（選択中画面のHTML）のユーザープロンプト。
 * system は SCREEN_MOCK_SYSTEM_PROMPT を流用し、デザイントークン縛りを維持する。
 */
export function buildMockEditUserPrompt(
  currentHtml: string,
  screen: ScreenDefinition,
  instruction: string,
  designRules?: DesignRules | null
): string {
  return `次のユーザーメッセージに応じて、対象画面のHTMLモックを編集してください。
メッセージが修正指示でない（質問・相談・確認など）場合の振る舞いは、システム指示の二択ルールに従うこと。

【対象画面】${screen.screenName}（${screen.screenId}）

【現在のHTML — 次の区切り行の間が本体】
----- BEGIN CURRENT HTML -----
${currentHtml}
----- END CURRENT HTML -----

【ユーザーのメッセージ】
${instruction}${buildDesignRulesBlock(designRules)}

【修正指示だった場合の編集ルール】
- 指示に関係しない部分のレイアウト・文言はできるだけ維持すること。
- tokens.css の <link> と、デザイントークン縛り（生のカラーコード・固定色クラス禁止、セマンティック変数のみ）は厳守すること。
- 出力は「完全なHTML文書」のみ。説明文・前置き・コードフェンスは付けないこと。`;
}
