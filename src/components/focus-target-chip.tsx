import { FileText, Monitor } from "@/components/ui/icon";
import type { ChatTarget } from "@/lib/schemas";

export function FocusTargetChip({
  target,
  canMock,
  screenName,
  onChange,
}: {
  target: ChatTarget;
  canMock: boolean;
  screenName?: string;
  onChange: (t: ChatTarget) => void;
}) {
  const cls = (active: boolean) =>
    `inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
      active ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
    }`;
  return (
    <div className="flex items-center gap-1.5 text-[11px] min-w-0">
      <span className="text-slate-400 shrink-0">修正対象:</span>
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
        <button onClick={() => onChange("definition")} className={cls(target === "definition")}>
          <FileText className="w-3 h-3" />
          画面定義
        </button>
        <button
          onClick={() => onChange("mock")}
          disabled={!canMock}
          className={`${cls(target === "mock")} disabled:opacity-40 disabled:cursor-not-allowed`}
          title={!canMock ? "先にこの画面のモックを生成してください" : undefined}
        >
          <Monitor className="w-3 h-3" />
          モック
        </button>
      </div>
      {target === "mock" && screenName && (
        <span className="text-slate-400 truncate">（{screenName}）</span>
      )}
    </div>
  );
}
