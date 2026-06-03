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
 * モック編集（選択中画面のHTML）のユーザープロンプト。
 * system は SCREEN_MOCK_SYSTEM_PROMPT を流用し、デザイントークン縛りを維持する。
 */
export function buildMockEditUserPrompt(
  currentHtml: string,
  screen: ScreenDefinition,
  instruction: string,
  designRules?: DesignRules | null
): string {
  return `あなたは既存のHTMLモックを、ユーザーの修正指示に従って編集します。
指示を反映した「完全なHTML文書」（<!DOCTYPE html> から </html> まで）を再出力してください。

【対象画面】${screen.screenName}（${screen.screenId}）

【現在のHTML — 次の区切り行の間が本体】
----- BEGIN CURRENT HTML -----
${currentHtml}
----- END CURRENT HTML -----

【ユーザーの修正指示】
${instruction}${buildDesignRulesBlock(designRules)}

【編集ルール】
- 指示に関係しない部分のレイアウト・文言はできるだけ維持すること。
- tokens.css の <link> と、デザイントークン縛り（生のカラーコード・固定色クラス禁止、セマンティック変数のみ）は厳守すること。
- 出力はHTMLのみ。説明文・前置き・コードフェンスは不要。`;
}
