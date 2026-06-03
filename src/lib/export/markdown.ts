import type { ScreenDefinition, ScreenDefinitionSet } from "@/lib/schemas";

// 画面UI定義書を「人が読む / Git でレビューする」ための Markdown へ変換する。
// JSON は内部のパイプライン中間表現として残し、ここではそれを成果物フォーマットに
// 落とすだけの純粋関数群（副作用なし・ブラウザでもサーバでも動く）。

// テーブルセルに改行や "|" が混ざると Markdown の表が崩れるためエスケープする。
function cell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

export function screenToMarkdown(screen: ScreenDefinition): string {
  const out: string[] = [];
  out.push(`## ${screen.screenId} ${screen.screenName}`);
  out.push("");

  if (screen.overview) {
    out.push(`> ${screen.overview.replace(/\r?\n/g, " ")}`);
    out.push("");
  }

  const meta: string[] = [];
  if (screen.category) meta.push(`- **分類**: ${screen.category}`);
  if (screen.targetUser) meta.push(`- **対象ユーザー**: ${screen.targetUser}`);
  if (meta.length) {
    out.push(meta.join("\n"));
    out.push("");
  }

  if (screen.components?.length) {
    out.push("### コンポーネント");
    out.push(
      table(
        ["名称", "種別", "説明"],
        screen.components.map((c) => [cell(c.name), cell(c.type), cell(c.description)])
      )
    );
    out.push("");
  }

  if (screen.fields?.length) {
    out.push("### 項目");
    out.push(
      table(
        ["項目名", "型", "必須", "バリデーション", "説明"],
        screen.fields.map((f) => [
          cell(f.name),
          cell(f.type),
          f.required ? "○" : "—",
          cell(f.validation),
          cell(f.description),
        ])
      )
    );
    out.push("");
  }

  if (screen.operationSteps?.length) {
    out.push("### 操作手順");
    out.push(
      table(
        ["#", "操作", "システム応答"],
        screen.operationSteps.map((s) => [cell(s.step), cell(s.action), cell(s.systemResponse)])
      )
    );
    out.push("");
  }

  if (screen.events?.length) {
    out.push("### イベント");
    out.push(
      table(
        ["トリガー", "アクション", "説明"],
        screen.events.map((e) => [cell(e.trigger), cell(e.action), cell(e.description)])
      )
    );
    out.push("");
  }

  if (screen.transitions?.length) {
    out.push("### 画面遷移");
    out.push(
      table(
        ["トリガー", "遷移先", "条件"],
        screen.transitions.map((t) => [cell(t.action), cell(t.destination), cell(t.condition)])
      )
    );
    out.push("");
  }

  return out.join("\n").trimEnd() + "\n";
}

export function screenSetToMarkdown(
  set: ScreenDefinitionSet,
  title = "画面UI定義書"
): string {
  const out: string[] = [];
  out.push(`# ${title}`);
  out.push("");

  // 画面一覧（目次代わり）。先頭に置くことで全体像を掴んでから各画面に入れる。
  out.push("## 画面一覧");
  out.push(
    table(
      ["画面ID", "画面名", "分類", "対象ユーザー"],
      set.screens.map((s) => [
        cell(s.screenId),
        cell(s.screenName),
        cell(s.category),
        cell(s.targetUser),
      ])
    )
  );
  out.push("");
  out.push("---");
  out.push("");

  out.push(set.screens.map(screenToMarkdown).join("\n---\n\n"));

  return out.join("\n").trimEnd() + "\n";
}
