import { useActionState, useEffect } from "hono/jsx";
import { X, Settings, Check, AlertCircle } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
  available: boolean;
  onRefresh: () => void;
}

async function markChecked(): Promise<boolean> {
  return true;
}

// Rendered only while the dialog is open (see Page), so mounting == opening:
// the form fields initialize fresh from props on every open, no reset effect.
export function SettingsDialog({ onClose, available, onRefresh }: Props) {
  const [checked, confirmChecked] = useActionState<boolean>(markChecked, false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">設定 — Codex</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="font-semibold text-blue-900 mb-1">Codex SDK</p>
            <p>
              生成機能は API キーではなく、サーバー実行ユーザーの既存 Codex ログインセッションを使います。
              未ログインの場合はサーバー側で `codex login` を実行してください。
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {available ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            )}
            <span className={available ? "text-emerald-700" : "text-amber-700"}>
              {available ? "Codex セッションを利用できます。" : "Codex セッションを確認できません。"}
            </span>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          <div className="ml-auto flex items-center gap-2">
            {checked && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                確認しました
              </span>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              閉じる
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onRefresh();
                confirmChecked(new FormData());
              }}
            >
              状態を確認
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
