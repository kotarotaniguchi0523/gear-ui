import { useActionState, useEffect, useRef } from "hono/jsx";
import { Download, FileSpreadsheet, FileType } from "@/components/ui/icon";

export function ExportMenu({
  onMarkdown,
  onXlsx,
}: {
  onMarkdown: () => void;
  onXlsx: () => void;
}) {
  const [open, applyMenuAction] = useActionState<boolean>(
    (current: boolean, action: "toggle" | "close") =>
      action === "toggle" ? !current : false,
    false
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        applyMenuAction("close");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => applyMenuAction("toggle")}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200"
        title="定義書を Markdown / Excel で書き出す"
      >
        <Download className="w-3.5 h-3.5" />
        書き出し
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-10 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          <button
            onClick={() => {
              onMarkdown();
              applyMenuAction("close");
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileType className="w-3.5 h-3.5 text-slate-500" />
            Markdown (.md)
          </button>
          <button
            onClick={() => {
              onXlsx();
              applyMenuAction("close");
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
