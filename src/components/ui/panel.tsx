import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function Panel({
  weight = 1,
  icon,
  title,
  subtitle,
  headerExtra,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  children,
}: {
  weight?: number;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}) {
  // 同じ <section> のまま flex の伸び率と basis をアニメーションさせて、
  // 畳む／開くを滑らかにスライドさせる（パッと切り替わらない）。
  const isRail = collapsible && collapsed;
  return (
    <section
      style={{
        flexGrow: isRail ? 0 : weight,
        flexBasis: isRail ? "3.25rem" : 0,
      }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 min-w-0 overflow-hidden transition-all duration-300 ease-in-out"
    >
      {isRail ? (
        // 縦バー全体をクリックで展開。開閉アイコン＋縦書きタイトルで畳んだパネルと分かる見た目に。
        <button
          onClick={onToggleCollapse}
          className="group flex-1 w-full flex flex-row lg:flex-col items-center justify-center lg:justify-start gap-2.5 px-3 py-2 lg:px-0 lg:py-4 hover:bg-slate-50 transition-colors"
          title={`${title}を開く`}
        >
          <span className="shrink-0 text-slate-400 group-hover:text-slate-700 transition-colors">
            <PanelLeftOpen className="w-4 h-4" />
          </span>
          <span className="shrink-0">{icon}</span>
          <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 truncate lg:[writing-mode:vertical-rl] lg:tracking-wider transition-colors">
            {title}
          </span>
        </button>
      ) : (
        <>
          <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0">{icon}</div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">{title}</h2>
                {subtitle && (
                  <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="ml-auto shrink-0 flex items-center gap-1">
              {headerExtra}
              {collapsible && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title={`${title}を畳む`}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </header>
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        </>
      )}
    </section>
  );
}
