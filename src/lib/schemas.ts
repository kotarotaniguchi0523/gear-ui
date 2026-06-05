import { z } from "zod";

export const screenComponentSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
});

export const operationStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  systemResponse: z.string().optional(),
});

export const fieldSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  required: z.boolean().optional(),
  validation: z.string().optional(),
  description: z.string().optional(),
});

export const eventSchema = z.object({
  trigger: z.string(),
  action: z.string(),
  description: z.string().optional(),
});

export const transitionSchema = z.object({
  action: z.string(),
  destination: z.string(),
  condition: z.string().optional(),
});

export const screenDefinitionSchema = z.object({
  screenId: z.string(),
  screenName: z.string(),
  category: z.string().optional(),
  targetUser: z.string().optional(),
  overview: z.string().optional(),
  components: z.array(screenComponentSchema).optional(),
  operationSteps: z.array(operationStepSchema).optional(),
  fields: z.array(fieldSchema).optional(),
  events: z.array(eventSchema).optional(),
  transitions: z.array(transitionSchema).optional(),
});

export const screenDefinitionSetSchema = z.object({
  screens: z.array(screenDefinitionSchema),
});

export type ScreenDefinition = z.infer<typeof screenDefinitionSchema>;
export type ScreenDefinitionSet = z.infer<typeof screenDefinitionSetSchema>;

export const generateDefinitionRequestSchema = z.object({
  requirement: z.string().min(1).max(20000),
  projectId: z.string().uuid().optional(),
});

// カラーパレット: モックのトークンCSS（/tokens/{color}.css）を選ぶ軸。
// 旧「テーマ」を廃止し、デザインルールの一軸として統合した。
export const colorPaletteEnum = z.enum(["neutral", "indigo", "emerald"]);
export type ColorPalette = z.infer<typeof colorPaletteEnum>;
export const DEFAULT_COLOR: ColorPalette = "indigo";

// デザインルール: モック生成時の見た目の方針を指定する。
// プリセット（color / density / radius / layout / tone）は初心者でも選びやすく、
// notes は自由記述でデザイナーがより細かく指定できる二段構えにしている。
export const designRulesSchema = z.object({
  color: colorPaletteEnum.optional(),
  density: z.enum(["compact", "standard", "comfortable"]).optional(),
  radius: z.enum(["sharp", "soft", "round"]).optional(),
  layout: z.enum(["auto", "sidebar", "topnav"]).optional(),
  tone: z.enum(["auto", "professional", "friendly", "minimal", "playful"]).optional(),
  notes: z.string().max(2000).optional(),
});
export type DesignRules = z.infer<typeof designRulesSchema>;

export const generateMockRequestSchema = z.object({
  screen: screenDefinitionSchema,
  designRules: designRulesSchema.optional(),
  projectId: z.string().uuid().optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  requirement: z.string().max(20000).optional(),
  designRules: designRulesSchema.optional(),
});

export const projectPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  requirement: z.string().max(20000).optional(),
  designRules: designRulesSchema.optional(),
});

// チャット修正窓: 定義生成後に「あとから直す」ための対話。
// target は「文脈で自動振り分け」されたフォーカス対象。
//  - definition: 画面UI定義書セット全体を編集（画面の追加/削除/修正が可能）
//  - mock: 選択中画面のHTMLモックだけを直接編集（見た目の微調整向け）
export const chatTargetEnum = z.enum(["definition", "mock"]);
export type ChatTarget = z.infer<typeof chatTargetEnum>;

export const chatTurnSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  target: chatTargetEnum,
  // user: 入力した指示。assistant: 変更内容の要約。
  text: z.string(),
  // mock編集や特定画面に紐づくターンの対象画面ID。
  screenId: z.string().optional(),
  ts: z.number(),
  // assistant の失敗ターン（エラー表示用）。
  error: z.boolean().optional(),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const chatEditRequestSchema = z.object({
  projectId: z.string().uuid(),
  target: chatTargetEnum,
  // 通常の修正指示。syncFromMock=true のときは未使用でよい（自動で同期指示を組む）。
  instruction: z.string().min(1).max(4000),
  // mock編集時は対象画面ID（必須）。definition編集はセット全体に作用する。
  screenId: z.string().optional(),
  // target=definition のとき true なら、指定画面のモックHTMLに合わせて定義を逆同期する。
  syncFromMock: z.boolean().optional(),
});
export type ChatEditRequest = z.infer<typeof chatEditRequestSchema>;

// モックが古い（対応する定義が後から変わった）かどうかを画面IDごとに保持する。
export type MockStaleMap = Record<string, boolean>;

// 定義が古い（モックを直接編集して定義に未反映）かどうかを画面IDごとに保持する。
// MockStaleMap と同型だが、意味（向き）が逆なので型エイリアスで意図を表す。
export type DefinitionStaleMap = Record<string, boolean>;
