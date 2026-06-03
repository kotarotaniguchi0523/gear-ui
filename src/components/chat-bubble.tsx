import { FileText, Monitor } from "lucide-react";
import type { ChatTurn } from "@/lib/schemas";

export function ChatBubble({ turn }: { turn: ChatTurn }) {
  const targetLabel = turn.target === "mock" ? "モック" : "定義";
  const TargetIcon = turn.target === "mock" ? Monitor : FileText;

  if (turn.role === "user") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {turn.text}
        </div>
        <span className="text-[10px] text-slate-400 pr-1">{targetLabel}への指示</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
          turn.error
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-slate-100 text-slate-700"
        }`}
      >
        {turn.text}
      </div>
      <span className="text-[10px] text-slate-400 pl-1 inline-flex items-center gap-1">
        <TargetIcon className="w-2.5 h-2.5" />
        {targetLabel}を更新
      </span>
    </div>
  );
}
