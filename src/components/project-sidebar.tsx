import { useActionState } from "hono/jsx";
import {
  Plus,
  Trash2,
  Folder,
  Check,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "@/components/ui/icon";
import type { ProjectSummary } from "@/hooks/use-projects";

interface Props {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectSidebar({
  projects,
  activeProjectId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  if (collapsed) {
    return (
      <aside className="w-10 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 m-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"
          title="サイドバーを開く"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onCreate}
          className="p-2 m-1 rounded text-blue-600 hover:bg-blue-50"
          title="新規プロジェクト"
        >
          <Plus className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
      <header className="px-3 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Folder className="w-3.5 h-3.5" />
          プロジェクト
          <span className="text-[10px] text-slate-400 font-mono">({projects.length})</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCreate}
            className="p-1 rounded text-blue-600 hover:bg-blue-50"
            title="新規プロジェクト"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="サイドバーを閉じる"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto p-1.5">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
            <Layers className="w-7 h-7 text-slate-300 mb-2" />
            <p className="text-[11px] text-slate-500">プロジェクトはまだありません</p>
            <button
              onClick={onCreate}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + 新規プロジェクト
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                active={p.id === activeProjectId}
                onSelect={() => onSelect(p.id)}
                onRename={(name) => onRename(p.id, name)}
                onDelete={() => onDelete(p.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ProjectRow({
  project,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  project: ProjectSummary;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  type EditState = { editing: boolean; draft: string };
  type EditAction =
    | { type: "start"; name: string }
    | { type: "change"; draft: string }
    | { type: "cancel"; name: string }
    | { type: "finish" };

  const [edit, dispatchEdit] = useActionState<EditState>(
    (state: EditState, action: EditAction): EditState => {
      if (action.type === "start") return { editing: true, draft: action.name };
      if (action.type === "change") return { ...state, draft: action.draft };
      if (action.type === "cancel") return { editing: false, draft: action.name };
      return { ...state, editing: false };
    },
    { editing: false, draft: project.name }
  );

  function commit() {
    const next = edit.draft.trim();
    if (next && next !== project.name) {
      onRename(next);
    }
    dispatchEdit({ type: "finish" });
  }

  if (edit.editing) {
    return (
      <li className="px-2 py-1.5 rounded-md bg-blue-50 flex items-center gap-1">
        <input
          autoFocus
          value={edit.draft}
          onChange={(e) =>
            dispatchEdit({
              type: "change",
              draft: (e.target as HTMLInputElement).value,
            })
          }
          onKeyDown={(e) => {
            if (e.isComposing) return;
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              dispatchEdit({ type: "cancel", name: project.name });
            }
          }}
          className="flex-1 min-w-0 text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={commit}
          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            dispatchEdit({ type: "cancel", name: project.name });
          }}
          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
        >
          <X className="w-3 h-3" />
        </button>
      </li>
    );
  }

  return (
    <li>
      <div
        className={`group px-2 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${
          active
            ? "bg-blue-50 ring-1 ring-blue-200"
            : "hover:bg-slate-50"
        }`}
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-medium truncate ${
              active ? "text-blue-900" : "text-slate-700"
            }`}
          >
            {project.name}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span>
              {project.hasDefinitions ? `${project.screenCount}画面` : "未生成"}
            </span>
            <span>·</span>
            <span>{formatRelative(project.updatedAt)}</span>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatchEdit({ type: "start", name: project.name });
            }}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
            title="名前を変更"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`「${project.name}」を削除します。よろしいですか？`)) {
                onDelete();
              }
            }}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
            title="削除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

function formatRelative(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "たった今";
  if (diff < hour) return `${Math.floor(diff / min)}分前`;
  if (diff < day) return `${Math.floor(diff / hour)}時間前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}日前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
