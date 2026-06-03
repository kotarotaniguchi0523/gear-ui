"use client";

import { useEffect, useState } from "react";
import { X, KeyRound, ExternalLink, Eye, EyeOff, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
  apiKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
}

// Rendered only while the dialog is open (see Page), so mounting == opening:
// the form fields initialize fresh from props on every open, no reset effect.
export function SettingsDialog({ onClose, apiKey, onSave, onClear }: Props) {
  const [value, setValue] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSave() {
    onSave(value);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
  }

  function handleClear() {
    onClear();
    setValue("");
  }

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
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">設定 — Anthropic API キー</h2>
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
            <p className="font-semibold text-blue-900 mb-1">BYOK（Bring Your Own Key）</p>
            <p>
              ご自身のAnthropic APIキーをこの端末に保存します。キーはブラウザのlocalStorageに保存され、
              サーバーには生成リクエスト時にのみ送信されます（保存はしません）。
            </p>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-blue-700 hover:text-blue-900 font-medium"
            >
              console.anthropic.com でキーを取得
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              API キー
            </label>
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setReveal(!reveal)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
                aria-label={reveal ? "隠す" : "表示"}
              >
                {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {apiKey && (
              <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                現在の保存値: {apiKey.slice(0, 8)}…{apiKey.slice(-4)}
              </p>
            )}
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          {apiKey && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="w-3.5 h-3.5" />
              削除
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                保存しました
              </span>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              閉じる
            </Button>
            <Button size="sm" onClick={handleSave} disabled={value.trim() === apiKey}>
              保存
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
