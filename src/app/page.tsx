"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  FileText,
  Monitor,
  Loader2,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  Settings,
  KeyRound,
  Save,
  SlidersHorizontal,
  Send,
  MessageSquare,
  AlertTriangle,
  Square,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { ExportMenu } from "@/components/export-menu";
import { ChatBubble } from "@/components/chat-bubble";
import { FocusTargetChip } from "@/components/focus-target-chip";
import { ScreenDefinitionView } from "@/components/screen-definition-view";
import { SettingsDialog } from "@/components/settings-dialog";
import { DesignRulesDialog } from "@/components/design-rules-dialog";
import { ProjectSidebar } from "@/components/project-sidebar";
import { downloadMarkdown, downloadXlsx } from "@/lib/export/download";
import { buildPreviewSrcDoc, MOCK_PREVIEW_MIN_WIDTH } from "@/lib/preview";
import { useApiKey } from "@/hooks/use-api-key";
import { useProjects } from "@/hooks/use-projects";
import { useGeneration } from "@/hooks/use-generation";
import { DEFAULT_COLOR } from "@/lib/schemas";
import type { DesignRules } from "@/lib/schemas";

const SAMPLE_REQUIREMENT = `社内向けの簡易タスク管理SaaSを作りたい。
- ユーザーはログインしてタスクの登録・編集・削除ができる
- タスクには「タイトル / 担当者 / 期日 / 優先度（高・中・低）/ ステータス（未着手・進行中・完了）」がある
- 一覧画面ではフィルタとソートができる
- 管理者はメンバー一覧と権限変更ができる`;

// 「プロジェクト 06/03 14:25」のような、作成時刻つきの既定名を組み立てる。
function timestampedName(prefix: string): string {
  return `${prefix} ${new Date().toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function Page() {
  const [requirement, setRequirement] = useState(SAMPLE_REQUIREMENT);

  const { apiKey, save: saveApiKey, clear: clearApiKey, loaded: keyLoaded, hasKey } = useApiKey();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [envKeySet, setEnvKeySet] = useState<boolean | null>(null);

  const [designRules, setDesignRules] = useState<DesignRules | null>(null);
  const [designRulesOpen, setDesignRulesOpen] = useState(false);

  const projects = useProjects();
  // These are stable (useCallback in useProjects); pull them out so effect/callback
  // dependency lists stay accurate without re-running on every render.
  const {
    reload: reloadProjects,
    create: createProject,
    load: loadProject,
    patch: patchProject,
    remove: removeProject,
  } = projects;
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 要件・定義パネルの折りたたみ。モック初回生成時に自動で畳んでプレビューに集中する
  // 「フォーカスモード」を提供しつつ、ヘッダ／縦バーから手動でも開閉できる。
  const [reqCollapsed, setReqCollapsed] = useState(false);
  const [defCollapsed, setDefCollapsed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const requirementSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // モックが初めて出来たら、最も幅を取る「画面UI定義書」だけを畳んでプレビューを広げる。
  const enterFocusMode = useCallback(() => {
    setDefCollapsed(true);
  }, []);

  async function ensureProject(): Promise<string> {
    if (activeProjectId) return activeProjectId;
    const created = await createProject({
      name: timestampedName("プロジェクト"),
      requirement,
      ...(designRules ? { designRules } : {}),
    });
    setActiveProjectId(created.id);
    return created.id;
  }

  // 「定義 → モック → チャット修正」のドキュメント状態と生成アクション。
  const gen = useGeneration({
    activeProjectId,
    requirement,
    designRules,
    apiKey,
    ensureProject,
    reloadProjects,
    onResetPanels: () => {
      setReqCollapsed(false);
      setDefCollapsed(false);
    },
    onEnterFocusMode: enterFocusMode,
  });

  useEffect(() => {
    fetch("/api/settings/status")
      .then((r) => r.json())
      .then((d) => setEnvKeySet(!!d.envKeySet))
      .catch(() => setEnvKeySet(false));
  }, []);

  useEffect(() => {
    // One-time, client-only read of the deep-link param. Reading window in a
    // lazy initializer instead would diverge from the server render (which has
    // no URL) and trip hydration, so this stays an on-mount effect.
    const params = new URLSearchParams(window.location.search);
    const p = params.get("p");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe mount read
    if (p) setActiveProjectId(p);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeProjectId) params.set("p", activeProjectId);
    else params.delete("p");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}` : window.location.pathname
    );
  }, [activeProjectId]);

  const hydrateGen = gen.hydrate;
  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    loadProject(activeProjectId).then((proj) => {
      if (cancelled) return;
      if (!proj) {
        setActiveProjectId(null);
        return;
      }
      setRequirement(proj.requirement || "");
      setDesignRules(proj.designRules ?? null);
      setSaveStatus("idle");
      setReqCollapsed(false);
      setDefCollapsed(false);
      hydrateGen(proj);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, loadProject, hydrateGen]);

  const canGenerate = hasKey || envKeySet === true;
  const showKeyWarning = keyLoaded && envKeySet === false && !hasKey;
  const activeProject = useMemo(
    () => projects.list.find((p) => p.id === activeProjectId) ?? null,
    [projects.list, activeProjectId]
  );
  const designRuleCount = useMemo(() => {
    if (!designRules) return 0;
    let n = 0;
    if (designRules.color) n++;
    if (designRules.density) n++;
    if (designRules.radius) n++;
    // 「おまかせ(auto)」は未指定と同じ扱いでカウントしない
    if (designRules.layout && designRules.layout !== "auto") n++;
    if (designRules.tone && designRules.tone !== "auto") n++;
    if (designRules.notes?.trim()) n++;
    return n;
  }, [designRules]);

  const flashSaved = useCallback(() => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 1200);
  }, []);

  // モックの全画面表示: 要件チャットと定義書の両パネルを畳んでプレビューを最大化する。
  const mockFullscreen = reqCollapsed && defCollapsed;
  const toggleMockFullscreen = useCallback(() => {
    const next = !mockFullscreen; // 全画面でなければ両パネルを畳む / 全画面なら開く
    setReqCollapsed(next);
    setDefCollapsed(next);
  }, [mockFullscreen]);

  const handleRequirementChange = useCallback(
    (value: string) => {
      setRequirement(value);
      if (!activeProjectId) return;
      if (requirementSaveTimer.current) clearTimeout(requirementSaveTimer.current);
      setSaveStatus("saving");
      requirementSaveTimer.current = setTimeout(() => {
        patchProject(activeProjectId, { requirement: value }).then(flashSaved);
      }, 600);
    },
    [activeProjectId, patchProject, flashSaved]
  );

  const handleDesignRulesChange = useCallback(
    (value: DesignRules) => {
      setDesignRules(value);
      if (!activeProjectId) return;
      setSaveStatus("saving");
      patchProject(activeProjectId, { designRules: value }).then(flashSaved);
    },
    [activeProjectId, patchProject, flashSaved]
  );

  // 色は旧テーマ機能をデザインルールへ統合したもの。tokens.css を
  // /tokens/{color}.css に差し替えて即時反映する（再生成は不要）。
  const color = designRules?.color ?? DEFAULT_COLOR;
  const themedSrcDoc = useMemo(
    () => (gen.previewHtml ? buildPreviewSrcDoc(gen.previewHtml, color) : null),
    [gen.previewHtml, color]
  );

  async function handleCreateProject() {
    const created = await createProject({
      name: timestampedName("新規プロジェクト"),
      requirement: "",
    });
    setActiveProjectId(created.id);
  }

  async function handleDeleteProject(id: string) {
    await removeProject(id);
    if (id === activeProjectId) {
      setActiveProjectId(null);
      setRequirement(SAMPLE_REQUIREMENT);
      setDesignRules(null);
      gen.reset();
    }
  }

  async function handleRenameProject(id: string, name: string) {
    await patchProject(id, { name });
  }

  const defs = gen.defs;
  const selectedScreen = gen.selectedScreen;
  const mockGenerating = gen.mocking || gen.bulkProgress !== null;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Logo size="md" subtitle="AI Screen Mock Generator" />
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">要件</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-slate-700">画面定義</span>
            <ChevronRight className="w-3 h-3" />
            <span className="font-medium text-slate-700">HTMLモック</span>
          </div>
          {activeProject && (
            <>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">編集中:</span>
                <span className="font-medium text-slate-900">{activeProject.name}</span>
                {saveStatus === "saving" && (
                  <span className="inline-flex items-center gap-1 text-slate-400 ml-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    保存中
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 ml-1">
                    <Save className="w-3 h-3" />
                    保存済み
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
              showKeyWarning
                ? "text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title={
              hasKey
                ? "API キー設定済み"
                : envKeySet
                ? "サーバ環境変数のキーを使用中"
                : "API キー未設定"
            }
          >
            {showKeyWarning ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            {showKeyWarning ? "APIキーを設定" : "設定"}
            {hasKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.21.7.82.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>

      {showKeyWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-xs text-amber-900 shrink-0">
          <KeyRound className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">
            Anthropic API キーが設定されていません。生成機能を使うには右上の「APIキーを設定」から登録してください。
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="px-2 py-0.5 bg-amber-600 text-white rounded text-[11px] font-semibold hover:bg-amber-700"
          >
            設定する
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <ProjectSidebar
          projects={projects.list}
          activeProjectId={activeProjectId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onSelect={(id) => setActiveProjectId(id)}
          onCreate={handleCreateProject}
          onRename={handleRenameProject}
          onDelete={handleDeleteProject}
        />

        <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-3 p-3">
          <Panel
            weight={3}
            collapsible
            collapsed={reqCollapsed}
            onToggleCollapse={() => setReqCollapsed((v) => !v)}
            icon={<Sparkles className="w-4 h-4 text-blue-600" />}
            title="プロジェクト要件"
            subtitle={defs ? "チャットで定義・モックを修正" : "作りたいシステムを自由形式で記述"}
          >
            {!defs ? (
              // 初回: 要件を入力して定義を生成するシード入力モード
              <div className="flex-1 min-h-0 flex flex-col gap-3 p-4">
                <textarea
                  value={requirement}
                  onChange={(e) => handleRequirementChange(e.target.value)}
                  className="flex-1 min-h-0 w-full p-3 border border-slate-200 rounded-lg text-xs font-mono resize-none bg-slate-50 text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  placeholder="作りたいシステムの概要・対象ユーザー・機能を自由に書いてください"
                />
                {gen.defining ? (
                  <Button
                    onClick={gen.stopGeneration}
                    variant="danger"
                    size="md"
                    className="w-full"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span className="inline-flex items-baseline gap-1.5">
                      生成を中止
                      {gen.defProgress > 0 && (
                        <span className="text-[10px] font-normal opacity-80 tabular-nums">
                          {gen.defProgress.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </Button>
                ) : (
                  <Button
                    onClick={gen.generateDefinitions}
                    disabled={requirement.trim().length === 0 || !canGenerate}
                    size="md"
                    className="w-full"
                    title={!canGenerate ? "先にAPIキーを設定してください" : undefined}
                  >
                    <Sparkles className="w-4 h-4" />
                    画面定義を生成
                  </Button>
                )}
                {gen.defError && <ErrorMessage message={gen.defError} />}
              </div>
            ) : (
              // 生成後: チャットで後から修正する窓。初回要件は折りたたんで保持。
              <div className="flex-1 min-h-0 flex flex-col">
                <details className="border-b border-slate-100 group shrink-0">
                  <summary className="px-4 py-2 text-[11px] font-medium text-slate-500 cursor-pointer hover:bg-slate-50 flex items-center gap-1.5 select-none">
                    <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    初回要件（編集して作り直す）
                  </summary>
                  <div className="px-4 pb-3 flex flex-col gap-2">
                    <textarea
                      value={requirement}
                      onChange={(e) => handleRequirementChange(e.target.value)}
                      rows={5}
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-mono resize-none bg-slate-50 text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    />
                    {gen.defining ? (
                      <Button
                        onClick={gen.stopGeneration}
                        variant="danger"
                        size="sm"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span className="inline-flex items-baseline gap-1.5">
                          生成を中止
                          {gen.defProgress > 0 && (
                            <span className="text-[10px] font-normal opacity-80 tabular-nums">
                              {gen.defProgress.toLocaleString()}
                            </span>
                          )}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        onClick={gen.generateDefinitions}
                        disabled={requirement.trim().length === 0 || !canGenerate}
                        variant="outline"
                        size="sm"
                        title={
                          !canGenerate
                            ? "先にAPIキーを設定してください"
                            : "現在の定義・モック・チャット履歴を破棄して作り直します"
                        }
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        この要件で作り直す
                      </Button>
                    )}
                    {gen.defError && <ErrorMessage message={gen.defError} />}
                  </div>
                </details>

                <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-2">
                  {gen.chat.length === 0 ? (
                    <div className="m-auto text-center px-4">
                      <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        生成した画面定義やモックを、ここから言葉で修正できます。
                        <br />
                        例:「管理者画面に検索機能を追加して」
                      </p>
                    </div>
                  ) : (
                    gen.chat.map((t) => <ChatBubble key={t.id} turn={t} />)
                  )}
                </div>

                <div className="border-t border-slate-100 p-3 flex flex-col gap-2 shrink-0">
                  <FocusTargetChip
                    target={gen.effectiveTarget}
                    canMock={!!gen.currentMockHtml}
                    screenName={selectedScreen?.screenName}
                    onChange={gen.setFocusOverride}
                  />
                  {gen.chatError && <ErrorMessage message={gen.chatError} />}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={gen.chatInput}
                      onChange={(e) => gen.setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          gen.sendChat();
                        }
                      }}
                      rows={2}
                      disabled={gen.chatBusy || !canGenerate}
                      placeholder={
                        gen.effectiveTarget === "mock"
                          ? "このモックへの修正指示（⌘/Ctrl+Enterで送信）"
                          : "画面定義への修正指示（⌘/Ctrl+Enterで送信）"
                      }
                      className="flex-1 min-w-0 resize-none p-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 disabled:bg-slate-50"
                    />
                    <button
                      onClick={gen.sendChat}
                      disabled={gen.chatBusy || !canGenerate || gen.chatInput.trim().length === 0}
                      className="shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={!canGenerate ? "先にAPIキーを設定してください" : "送信"}
                    >
                      {gen.chatBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            weight={5}
            collapsible
            collapsed={defCollapsed}
            onToggleCollapse={() => setDefCollapsed((v) => !v)}
            icon={<FileText className="w-4 h-4 text-indigo-600" />}
            title="画面UI定義書"
            subtitle={
              defs
                ? `${defs.screens.length}画面 / ${selectedScreen?.screenName ?? ""}`
                : "AIが要件から画面を洗い出します"
            }
            headerExtra={
              defs && (
                <ExportMenu
                  onMarkdown={() =>
                    downloadMarkdown(defs, activeProject?.name || "画面UI定義書")
                  }
                  onXlsx={() =>
                    downloadXlsx(defs, activeProject?.name || "画面UI定義書")
                  }
                />
              )
            }
          >
            {!defs ? (
              <EmptyState
                icon={<FileText className="w-10 h-10" />}
                title="まだ生成されていません"
                description="左ペインで要件を入力して、「画面定義を生成」を押してください"
              />
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                  <div className="flex flex-wrap gap-1.5">
                    {defs.screens.map((s, i) => (
                      <button
                        key={s.screenId}
                        onClick={() => gen.selectScreen(i)}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium inline-flex items-center ${
                          i === gen.selectedIndex
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        title={
                          gen.mockStale[s.screenId]
                            ? "定義が更新されたため、モックが古い可能性があります"
                            : undefined
                        }
                      >
                        <span className="font-mono text-[10px] opacity-70 mr-1">
                          {s.screenId}
                        </span>
                        {s.screenName}
                        {gen.mockStale[s.screenId] && (
                          <span
                            className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400"
                            aria-label="モックが古い可能性"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {selectedScreen && <ScreenDefinitionView screen={selectedScreen} />}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            weight={4}
            icon={<Monitor className="w-4 h-4 text-emerald-600" />}
            title="HTMLモックプレビュー"
            subtitle="デザイントークン縛りで生成"
            headerExtra={
              <div className="flex items-center gap-1">
                {gen.currentMockHtml && (
                  <button
                    onClick={gen.generateMock}
                    disabled={mockGenerating}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-50"
                    title="再生成"
                  >
                    {gen.mocking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <button
                  onClick={toggleMockFullscreen}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                  title={mockFullscreen ? "全画面表示を解除" : "モックを全画面表示"}
                >
                  {mockFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            }
          >
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDesignRulesOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${
                    designRuleCount > 0
                      ? "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200 hover:bg-fuchsia-100"
                      : "text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  title="モックの色・見た目の方針を設定"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  デザインルール
                  {designRuleCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-fuchsia-600 text-white text-[10px] font-semibold">
                      {designRuleCount}
                    </span>
                  )}
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  {mockGenerating && (
                    <Button onClick={gen.stopGeneration} variant="danger" size="sm">
                      <Square className="w-3.5 h-3.5 fill-current" />
                      中止
                    </Button>
                  )}
                  {defs && defs.screens.length > 1 && (
                    <Button
                      onClick={gen.generateAllMocks}
                      disabled={mockGenerating || !canGenerate}
                      loading={gen.bulkProgress !== null}
                      variant="outline"
                      size="sm"
                      title={
                        !canGenerate
                          ? "先にAPIキーを設定してください"
                          : "画面定義の数だけモックをまとめて生成します"
                      }
                    >
                      {gen.bulkProgress === null && <LayoutGrid className="w-3.5 h-3.5" />}
                      {gen.bulkProgress !== null
                        ? `生成中 ${gen.bulkProgress.done}/${gen.bulkProgress.total}`
                        : "全画面を生成"}
                    </Button>
                  )}
                  {!gen.currentMockHtml && (
                    <Button
                      onClick={gen.generateMock}
                      disabled={!selectedScreen || mockGenerating || !canGenerate}
                      loading={gen.mocking}
                      size="sm"
                      title={!canGenerate ? "先にAPIキーを設定してください" : undefined}
                    >
                      {!gen.mocking && <Sparkles className="w-3.5 h-3.5" />}
                      {gen.mocking ? "生成中…" : "モックを生成"}
                    </Button>
                  )}
                </div>
              </div>
              {gen.mockError && (
                <div className="px-4 pt-3">
                  <ErrorMessage message={gen.mockError} />
                </div>
              )}
              {gen.currentMockStale && gen.currentMockHtml && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-[11px] text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1">
                    画面定義が更新されました。このモックは古い可能性があります。
                  </span>
                  <button
                    onClick={gen.generateMock}
                    disabled={mockGenerating}
                    className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-semibold hover:bg-amber-700 disabled:opacity-50"
                  >
                    再生成
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0 bg-slate-50 overflow-auto">
                {themedSrcDoc ? (
                  // パネル幅にモックを無理に押し込まず、デスクトップ相当の最小幅を
                  // 確保して、狭いときは横スクロールで見せる（全画面ボタンで広げると収まる）。
                  <iframe
                    title="mock preview"
                    srcDoc={themedSrcDoc}
                    className="h-full bg-white block"
                    style={{ width: "100%", minWidth: MOCK_PREVIEW_MIN_WIDTH }}
                    sandbox="allow-scripts"
                  />
                ) : (
                  <EmptyState
                    icon={<Monitor className="w-10 h-10" />}
                    title={
                      selectedScreen ? "モックは未生成です" : "画面を選択してください"
                    }
                    description={
                      selectedScreen
                        ? "上部の「モックを生成」を押すと、選択中の画面のHTMLモックが生成されます"
                        : "中央ペインで画面定義を生成し、画面タブを選択してください"
                    }
                  />
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          apiKey={apiKey}
          onSave={saveApiKey}
          onClear={clearApiKey}
        />
      )}

      {designRulesOpen && (
        <DesignRulesDialog
          onClose={() => setDesignRulesOpen(false)}
          value={designRules}
          onSave={handleDesignRulesChange}
        />
      )}
    </div>
  );
}
