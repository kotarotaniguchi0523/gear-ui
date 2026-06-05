import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type {
  ChatTurn,
  DefinitionStaleMap,
  DesignRules,
  MockStaleMap,
  ScreenDefinitionSet,
} from "@/lib/schemas";

export interface ProjectRow {
  id: string;
  name: string;
  requirement: string;
  definitions_json: string | null;
  mocks_json: string | null;
  theme: string;
  design_rules_json: string | null;
  chat_json: string | null;
  mock_stale_json: string | null;
  definition_stale_json: string | null;
  created_at: number;
  updated_at: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  hasDefinitions: boolean;
  screenCount: number;
}

export interface Project {
  id: string;
  name: string;
  requirement: string;
  definitions: ScreenDefinitionSet | null;
  mocks: Record<string, string>;
  designRules: DesignRules | null;
  chat: ChatTurn[];
  mockStale: MockStaleMap;
  definitionStale: DefinitionStaleMap;
  createdAt: number;
  updatedAt: number;
}

function hydrate(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    requirement: row.requirement,
    definitions: row.definitions_json
      ? (JSON.parse(row.definitions_json) as ScreenDefinitionSet)
      : null,
    mocks: row.mocks_json
      ? (JSON.parse(row.mocks_json) as Record<string, string>)
      : {},
    designRules: row.design_rules_json
      ? (JSON.parse(row.design_rules_json) as DesignRules)
      : null,
    chat: row.chat_json ? (JSON.parse(row.chat_json) as ChatTurn[]) : [],
    mockStale: row.mock_stale_json
      ? (JSON.parse(row.mock_stale_json) as MockStaleMap)
      : {},
    definitionStale: row.definition_stale_json
      ? (JSON.parse(row.definition_stale_json) as DefinitionStaleMap)
      : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(): ProjectSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, definitions_json, created_at, updated_at
       FROM projects
       ORDER BY updated_at DESC`
    )
    .all() as Array<
    Pick<ProjectRow, "id" | "name" | "definitions_json" | "created_at" | "updated_at">
  >;

  return rows.map((row) => {
    let screenCount = 0;
    if (row.definitions_json) {
      try {
        const parsed = JSON.parse(row.definitions_json) as ScreenDefinitionSet;
        screenCount = parsed.screens?.length ?? 0;
      } catch {
        screenCount = 0;
      }
    }
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hasDefinitions: !!row.definitions_json,
      screenCount,
    };
  });
}

export function getProject(id: string): Project | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM projects WHERE id = ?`)
    .get(id) as ProjectRow | undefined;
  return row ? hydrate(row) : null;
}

export function createProject(input: {
  name?: string;
  requirement?: string;
  designRules?: DesignRules;
}): Project {
  const db = getDb();
  const now = Date.now();
  const id = randomUUID();
  const name = input.name?.trim() || "新規プロジェクト";

  // theme 列はレガシー（旧テーマ機能）。DEFAULT 'indigo' に任せ、アプリからは扱わない。
  db.prepare(
    `INSERT INTO projects (id, name, requirement, design_rules_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    input.requirement ?? "",
    input.designRules ? JSON.stringify(input.designRules) : null,
    now,
    now
  );

  return getProject(id)!;
}

export interface ProjectPatch {
  name?: string;
  requirement?: string;
  definitions?: ScreenDefinitionSet | null;
  mocks?: Record<string, string>;
  designRules?: DesignRules | null;
  chat?: ChatTurn[];
  mockStale?: MockStaleMap;
  definitionStale?: DefinitionStaleMap;
}

export function updateProject(id: string, patch: ProjectPatch): Project | null {
  const existing = getProject(id);
  if (!existing) return null;

  const db = getDb();
  const next: Project = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.requirement !== undefined ? { requirement: patch.requirement } : {}),
    ...(patch.definitions !== undefined ? { definitions: patch.definitions } : {}),
    ...(patch.mocks !== undefined ? { mocks: patch.mocks } : {}),
    ...(patch.designRules !== undefined ? { designRules: patch.designRules } : {}),
    ...(patch.chat !== undefined ? { chat: patch.chat } : {}),
    ...(patch.mockStale !== undefined ? { mockStale: patch.mockStale } : {}),
    ...(patch.definitionStale !== undefined
      ? { definitionStale: patch.definitionStale }
      : {}),
    updatedAt: Date.now(),
  };

  db.prepare(
    `UPDATE projects
     SET name = ?, requirement = ?, definitions_json = ?, mocks_json = ?, design_rules_json = ?, chat_json = ?, mock_stale_json = ?, definition_stale_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    next.name,
    next.requirement,
    next.definitions ? JSON.stringify(next.definitions) : null,
    next.mocks && Object.keys(next.mocks).length > 0
      ? JSON.stringify(next.mocks)
      : null,
    next.designRules ? JSON.stringify(next.designRules) : null,
    next.chat.length > 0 ? JSON.stringify(next.chat) : null,
    Object.keys(next.mockStale).length > 0
      ? JSON.stringify(next.mockStale)
      : null,
    Object.keys(next.definitionStale).length > 0
      ? JSON.stringify(next.definitionStale)
      : null,
    next.updatedAt,
    id
  );

  return next;
}

export function setMockForScreen(
  projectId: string,
  screenId: string,
  html: string
): Project | null {
  const existing = getProject(projectId);
  if (!existing) return null;
  const mocks = { ...existing.mocks, [screenId]: html };
  // モックを（再）生成したので、その画面の「古い」フラグは解除する。
  const mockStale = { ...existing.mockStale };
  delete mockStale[screenId];
  // 定義から作り直した＝定義とモックが一致するので、定義側のズレも解消する。
  const definitionStale = { ...existing.definitionStale };
  delete definitionStale[screenId];
  return updateProject(projectId, { mocks, mockStale, definitionStale });
}

export function appendChatTurns(
  projectId: string,
  turns: ChatTurn[]
): Project | null {
  const existing = getProject(projectId);
  if (!existing) return null;
  return updateProject(projectId, { chat: [...existing.chat, ...turns] });
}

/**
 * 定義セットを差し替えた際の、モックの存続とstale判定を計算する純関数。
 *  - 新セットに無い画面のモックは破棄
 *  - 定義が変わった（or 既にstale）画面のモックは stale=true
 * staleの過剰判定は「再生成して」バッジが余分に出るだけで実害が小さいため、
 * キー順差異まで吸収する厳密比較はあえて行わない。
 */
export function computeDefinitionUpdate(
  existing: Project,
  newSet: ScreenDefinitionSet
): {
  mocks: Record<string, string>;
  mockStale: MockStaleMap;
  definitionStale: DefinitionStaleMap;
} {
  const oldById = new Map(
    (existing.definitions?.screens ?? []).map((s) => [s.screenId, s])
  );
  const newIds = new Set(newSet.screens.map((s) => s.screenId));

  const mocks: Record<string, string> = {};
  for (const [sid, html] of Object.entries(existing.mocks)) {
    if (newIds.has(sid)) mocks[sid] = html;
  }

  const mockStale: MockStaleMap = {};
  const definitionStale: DefinitionStaleMap = {};
  for (const s of newSet.screens) {
    const old = oldById.get(s.screenId);
    const changed = !old || JSON.stringify(old) !== JSON.stringify(s);
    if (mocks[s.screenId] && (changed || existing.mockStale[s.screenId])) {
      mockStale[s.screenId] = true; // モックが無い画面はstale判定の対象外
    }
    // 定義を編集した画面は、その定義が最新になるので「定義が古い」フラグを解除する。
    // 触っていない画面の definitionStale はそのまま引き継ぐ。
    if (existing.definitionStale[s.screenId] && !changed) {
      definitionStale[s.screenId] = true;
    }
  }

  return { mocks, mockStale, definitionStale };
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  return result.changes > 0;
}
