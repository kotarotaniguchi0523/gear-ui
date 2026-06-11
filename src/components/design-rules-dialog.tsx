import { useEffect, useReducer } from "hono/jsx";
import { X, Palette, Check, RotateCcw } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import type { DesignRules } from "@/lib/schemas";

interface Props {
  onClose: () => void;
  value: DesignRules | null;
  onSave: (rules: DesignRules) => void;
}

type OptionGroup<T extends string> = {
  key: keyof DesignRules;
  label: string;
  hint: string;
  options: { value: T; label: string; desc: string }[];
};

// プリセット軸。初心者でも「どれを選べばどうなるか」が分かるよう、
// 各選択肢に短い説明を添えている。
const DENSITY: OptionGroup<NonNullable<DesignRules["density"]>> = {
  key: "density",
  label: "情報密度",
  hint: "余白の詰まり具合",
  options: [
    { value: "compact", label: "コンパクト", desc: "余白控えめ・密" },
    { value: "standard", label: "標準", desc: "バランス重視" },
    { value: "comfortable", label: "ゆったり", desc: "余白広め" },
  ],
};

const RADIUS: OptionGroup<NonNullable<DesignRules["radius"]>> = {
  key: "radius",
  label: "角丸",
  hint: "カードやボタンの角",
  options: [
    { value: "sharp", label: "シャープ", desc: "角張った印象" },
    { value: "soft", label: "標準", desc: "ほどよい丸み" },
    { value: "round", label: "丸め", desc: "柔らかい印象" },
  ],
};

const LAYOUT: OptionGroup<NonNullable<DesignRules["layout"]>> = {
  key: "layout",
  label: "レイアウト",
  hint: "ナビゲーションの配置",
  options: [
    { value: "auto", label: "おまかせ", desc: "AIが判断" },
    { value: "sidebar", label: "サイドバー", desc: "左に縦メニュー" },
    { value: "topnav", label: "トップナビ", desc: "上に横メニュー" },
  ],
};

const TONE: OptionGroup<NonNullable<DesignRules["tone"]>> = {
  key: "tone",
  label: "トーン",
  hint: "全体の雰囲気",
  options: [
    { value: "auto", label: "おまかせ", desc: "AIが判断" },
    { value: "professional", label: "プロ", desc: "堅実・信頼感" },
    { value: "friendly", label: "フレンドリー", desc: "親しみやすい" },
    { value: "minimal", label: "ミニマル", desc: "洗練・無駄なし" },
    { value: "playful", label: "ポップ", desc: "明るく遊び心" },
  ],
};

const GROUPS = [DENSITY, RADIUS, LAYOUT, TONE];

// カラーパレットは見た目で選べるようスウォッチ付きで別扱いにする。
// swatch は /tokens/{value}.css の --color-primary に対応。
const COLORS: { value: NonNullable<DesignRules["color"]>; label: string; swatch: string }[] = [
  { value: "neutral", label: "Neutral", swatch: "#111827" },
  { value: "indigo", label: "Indigo", swatch: "#4338ca" },
  { value: "emerald", label: "Emerald", swatch: "#047857" },
];

type DraftState = {
  rules: DesignRules;
  savedNotice: boolean;
};

type DraftAction =
  | { type: "pick"; key: keyof DesignRules; value: string }
  | { type: "notes"; value: string }
  | { type: "reset" }
  | { type: "savedNotice"; value: boolean };

type DraftHandler<K extends DraftAction["type"]> = (
  state: DraftState,
  action: Extract<DraftAction, { type: K }>
) => DraftState;

const draftHandlers: {
  [K in DraftAction["type"]]: DraftHandler<K>;
} = {
  pick: (state, action) => {
    const current = state.rules[action.key];
    const next = { ...state.rules };
    if (current === action.value) {
      delete next[action.key];
    } else {
      (next as Record<string, unknown>)[action.key] = action.value;
    }
    return { ...state, rules: next };
  },
  notes: (state, action) => ({
    ...state,
    rules: { ...state.rules, notes: action.value },
  }),
  reset: (state) => ({ ...state, rules: {} }),
  savedNotice: (state, action) => ({
    ...state,
    savedNotice: action.value,
  }),
};

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  const handler = draftHandlers[action.type] as (
    state: DraftState,
    action: DraftAction
  ) => DraftState;
  return handler(state, action);
}

function isEqual(a: DesignRules, b: DesignRules): boolean {
  return (
    a.color === b.color &&
    a.density === b.density &&
    a.radius === b.radius &&
    a.layout === b.layout &&
    a.tone === b.tone &&
    (a.notes ?? "") === (b.notes ?? "")
  );
}

// 開いている間だけマウントされる前提（page.tsx 側で制御）なので、
// props から初期化する。
export function DesignRulesDialog({ onClose, value, onSave }: Props) {
  const [draft, dispatchDraft] = useReducer(draftReducer, {
    rules: value ?? {},
    savedNotice: false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function pick(key: keyof DesignRules, val: string) {
    dispatchDraft({ type: "pick", key, value: val });
  }

  function handleSave() {
    // notes は空文字なら落とす
    const cleaned: DesignRules = { ...draft.rules };
    if (!cleaned.notes?.trim()) delete cleaned.notes;
    onSave(cleaned);
    dispatchDraft({ type: "savedNotice", value: true });
    setTimeout(
      () => dispatchDraft({ type: "savedNotice", value: false }),
      1500
    );
  }

  const rules = draft.rules;
  const dirty = !isEqual(rules, value ?? {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-fuchsia-600" />
            <h2 className="text-sm font-bold text-slate-900">デザインルール</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-600 leading-relaxed bg-fuchsia-50 border border-fuchsia-100 rounded-lg p-3">
            モック生成時の見た目の方針です。選んだルールは
            <span className="font-semibold">このプロジェクトのモック生成</span>
            に反映されます。
            <br />
            カラーはプレビューに即時反映され、その他のルールは「モックを生成 / 再生成」で反映されます。
          </p>

          <div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <label className="text-xs font-semibold text-slate-700">カラー</label>
              <span className="text-[11px] text-slate-400">配色パレット</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => {
                const active = rules.color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => pick("color", c.value)}
                    className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                      active
                        ? "border-fuchsia-500 bg-fuchsia-50 ring-1 ring-fuchsia-300"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10"
                      style={{ background: c.swatch }}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        active ? "text-fuchsia-700" : "text-slate-700"
                      }`}
                    >
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {GROUPS.map((group) => (
            <div key={group.key as string}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {group.label}
                </label>
                <span className="text-[11px] text-slate-400">{group.hint}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => {
                  const active = rules[group.key] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => pick(group.key, opt.value)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left ${
                        active
                          ? "border-fuchsia-500 bg-fuchsia-50 ring-1 ring-fuchsia-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`text-xs font-semibold ${
                          active ? "text-fuchsia-700" : "text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-slate-400">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                追加のデザイン指示
              </label>
              <span className="text-[11px] text-slate-400">自由記述（任意）</span>
            </div>
            <textarea
              value={rules.notes ?? ""}
              onChange={(e) =>
                dispatchDraft({
                  type: "notes",
                  value: (e.target as HTMLTextAreaElement).value,
                })
              }
              rows={3}
              maxLength={2000}
              placeholder="例: 見出しは太めに。ボタンは大きく押しやすく。表は罫線控えめで。ブランドは落ち着いた信頼感のある印象に。"
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs resize-none bg-white text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-fuchsia-400 focus:border-fuchsia-400"
            />
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatchDraft({ type: "reset" })}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            リセット
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {draft.savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                保存しました
              </span>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              閉じる
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty}>
              保存
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
