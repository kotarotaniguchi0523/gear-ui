"use client";

import type { ScreenDefinition } from "@/lib/schemas";
import {
  Users,
  LayoutGrid,
  FormInput,
  Zap,
  ArrowRightLeft,
  ListOrdered,
} from "lucide-react";

interface Props {
  screen: ScreenDefinition;
}

export function ScreenDefinitionView({ screen }: Props) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-slate-100 text-slate-700 rounded">
            {screen.screenId}
          </span>
          {screen.category && (
            <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded font-medium">
              {screen.category}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900">
          {screen.screenName}
        </h3>
        {screen.overview && (
          <p className="text-xs text-slate-600 leading-relaxed">
            {screen.overview}
          </p>
        )}
        {screen.targetUser && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            <span>{screen.targetUser}</span>
          </div>
        )}
      </header>

      {screen.components && screen.components.length > 0 && (
        <Section icon={<LayoutGrid className="w-3.5 h-3.5" />} title="コンポーネント" count={screen.components.length}>
          <ul className="space-y-1.5">
            {screen.components.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs p-2 bg-slate-50 rounded border border-slate-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-slate-900">{c.name}</span>
                    {c.type && (
                      <span className="px-1.5 py-px text-[10px] font-mono bg-indigo-50 text-indigo-700 rounded">
                        {c.type}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-slate-500 mt-0.5">{c.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {screen.fields && screen.fields.length > 0 && (
        <Section icon={<FormInput className="w-3.5 h-3.5" />} title="項目" count={screen.fields.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-3 font-medium">項目名</th>
                  <th className="py-1.5 pr-3 font-medium">型</th>
                  <th className="py-1.5 pr-3 font-medium">必須</th>
                </tr>
              </thead>
              <tbody>
                {screen.fields.map((f, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-medium text-slate-900">
                      {f.name}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-600 font-mono text-[11px]">
                      {f.type ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3">
                      {f.required ? (
                        <span className="text-rose-600 font-bold">*</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {screen.operationSteps && screen.operationSteps.length > 0 && (
        <Section icon={<ListOrdered className="w-3.5 h-3.5" />} title="操作手順" count={screen.operationSteps.length}>
          <ol className="space-y-2">
            {screen.operationSteps.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                  {s.step}
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="text-slate-900">{s.action}</div>
                  {s.systemResponse && (
                    <div className="text-slate-500 italic">
                      → {s.systemResponse}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {screen.events && screen.events.length > 0 && (
        <Section icon={<Zap className="w-3.5 h-3.5" />} title="イベント" count={screen.events.length}>
          <ul className="space-y-1.5">
            {screen.events.map((e, i) => (
              <li
                key={i}
                className="text-xs p-2 bg-slate-50 rounded border border-slate-100 space-y-0.5"
              >
                <div className="flex items-center gap-1.5 text-slate-900">
                  <span className="font-medium">{e.trigger}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-blue-700 font-medium">{e.action}</span>
                </div>
                {e.description && (
                  <p className="text-slate-500">{e.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {screen.transitions && screen.transitions.length > 0 && (
        <Section icon={<ArrowRightLeft className="w-3.5 h-3.5" />} title="画面遷移" count={screen.transitions.length}>
          <ul className="space-y-1.5">
            {screen.transitions.map((t, i) => (
              <li
                key={i}
                className="text-xs p-2 bg-slate-50 rounded border border-slate-100 flex items-center gap-2"
              >
                <span className="text-slate-700">{t.action}</span>
                <span className="text-slate-400">→</span>
                <span className="px-1.5 py-px font-mono text-[11px] bg-indigo-50 text-indigo-700 rounded">
                  {t.destination}
                </span>
                {t.condition && (
                  <span className="text-slate-500 italic">
                    ({t.condition})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2 text-slate-700">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-slate-400 font-mono">({count})</span>
      </div>
      {children}
    </section>
  );
}
