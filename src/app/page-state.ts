import { DEFAULT_COLOR } from "@/lib/schemas";
import type { DesignRules } from "@/lib/schemas";

export const SAMPLE_REQUIREMENT = `社内向けの簡易タスク管理SaaSを作りたい。
- ユーザーはログインしてタスクの登録・編集・削除ができる
- タスクには「タイトル / 担当者 / 期日 / 優先度（高・中・低）/ ステータス（未着手・進行中・完了）」がある
- 一覧画面ではフィルタとソートができる
- 管理者はメンバー一覧と権限変更ができる`;

export type SaveStatus = "idle" | "saving" | "saved";

export type PageState = {
  requirement: string;
  settingsOpen: boolean;
  designRules: DesignRules | null;
  designRulesOpen: boolean;
  activeProjectId: string | null;
  sidebarCollapsed: boolean;
  reqCollapsed: boolean;
  defCollapsed: boolean;
  saveStatus: SaveStatus;
};

export type PageAction =
  | { type: "requirementChanged"; value: string }
  | { type: "settingsOpened" }
  | { type: "settingsClosed" }
  | { type: "designRulesChanged"; value: DesignRules | null }
  | { type: "designRulesOpened" }
  | { type: "designRulesClosed" }
  | { type: "projectActivated"; id: string | null }
  | { type: "sidebarToggled" }
  | { type: "requirementPanelToggled" }
  | { type: "definitionPanelToggled" }
  | { type: "panelsChanged"; reqCollapsed: boolean; defCollapsed: boolean }
  | { type: "saveStarted" }
  | { type: "saveCompleted" }
  | { type: "saveSettled" }
  | { type: "projectHydrated"; requirement: string; designRules: DesignRules | null }
  | { type: "projectReset" };

export const initialPageState: PageState = {
  requirement: SAMPLE_REQUIREMENT,
  settingsOpen: false,
  designRules: null,
  designRulesOpen: false,
  activeProjectId: null,
  sidebarCollapsed: false,
  reqCollapsed: false,
  defCollapsed: false,
  saveStatus: "idle",
};

type PageHandler<K extends PageAction["type"]> = (
  state: PageState,
  action: Extract<PageAction, { type: K }>
) => PageState;

const pageHandlers: {
  [K in PageAction["type"]]: PageHandler<K>;
} = {
  requirementChanged: (state, action) => ({ ...state, requirement: action.value }),
  settingsOpened: (state) => ({ ...state, settingsOpen: true }),
  settingsClosed: (state) => ({ ...state, settingsOpen: false }),
  designRulesChanged: (state, action) => ({ ...state, designRules: action.value }),
  designRulesOpened: (state) => ({ ...state, designRulesOpen: true }),
  designRulesClosed: (state) => ({ ...state, designRulesOpen: false }),
  projectActivated: (state, action) => ({ ...state, activeProjectId: action.id }),
  sidebarToggled: (state) => ({
    ...state,
    sidebarCollapsed: !state.sidebarCollapsed,
  }),
  requirementPanelToggled: (state) => ({
    ...state,
    reqCollapsed: !state.reqCollapsed,
  }),
  definitionPanelToggled: (state) => ({
    ...state,
    defCollapsed: !state.defCollapsed,
  }),
  panelsChanged: (state, action) => ({
    ...state,
    reqCollapsed: action.reqCollapsed,
    defCollapsed: action.defCollapsed,
  }),
  saveStarted: (state) => ({ ...state, saveStatus: "saving" }),
  saveCompleted: (state) => ({ ...state, saveStatus: "saved" }),
  saveSettled: (state) => ({ ...state, saveStatus: "idle" }),
  projectHydrated: (state, action) => ({
    ...state,
    requirement: action.requirement,
    designRules: action.designRules,
    saveStatus: "idle",
    reqCollapsed: false,
    defCollapsed: false,
  }),
  projectReset: (state) => ({
    ...state,
    activeProjectId: null,
    requirement: SAMPLE_REQUIREMENT,
    designRules: null,
  }),
};

export function pageReducer(state: PageState, action: PageAction): PageState {
  const handler = pageHandlers[action.type] as (
    state: PageState,
    action: PageAction
  ) => PageState;
  return handler(state, action);
}

export function countDesignRules(designRules: DesignRules | null): number {
  if (!designRules) return 0;
  let n = 0;
  if (designRules.color) n++;
  if (designRules.density) n++;
  if (designRules.radius) n++;
  if (designRules.layout && designRules.layout !== "auto") n++;
  if (designRules.tone && designRules.tone !== "auto") n++;
  if (designRules.notes?.trim()) n++;
  return n;
}

export function selectedColor(designRules: DesignRules | null): NonNullable<DesignRules["color"]> {
  return designRules?.color ?? DEFAULT_COLOR;
}
