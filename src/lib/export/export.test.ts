import { describe, expect, it } from "vitest";
import type { ScreenDefinitionSet } from "@/lib/schemas";
import { screenSetToMarkdown, screenToMarkdown } from "@/lib/export/markdown";
import { screenSetToSheets, screenSetToXlsx } from "@/lib/export/xlsx";
import { buildZip } from "@/lib/export/zip";
import { buildMocksZip } from "@/lib/export/mock-zip";

const sampleSet: ScreenDefinitionSet = {
  screens: [
    {
      screenId: "SCR-001",
      screenName: "タスク一覧",
      category: "トランザクション",
      targetUser: "一般ユーザー",
      overview: "タスクを一覧表示する画面",
      components: [{ name: "検索ボックス", type: "search-box", description: "絞り込み" }],
      fields: [
        { name: "タイトル", type: "text", required: true, validation: "必須", description: "件名" },
      ],
      operationSteps: [{ step: 1, action: "画面を開く", systemResponse: "一覧を表示" }],
      events: [{ trigger: "ボタンクリック", action: "新規作成", description: "モーダルを開く" }],
      transitions: [{ action: "行クリック", destination: "SCR-002", condition: "権限あり" }],
    },
    {
      screenId: "SCR-002",
      screenName: "タスク詳細",
      // 任意項目が無い画面でも落ちないこと
    },
  ],
};

describe("screenToMarkdown", () => {
  it("renders heading, overview and section tables", () => {
    const md = screenToMarkdown(sampleSet.screens[0]);
    expect(md).toContain("## SCR-001 タスク一覧");
    expect(md).toContain("> タスクを一覧表示する画面");
    expect(md).toContain("### 項目");
    expect(md).toContain("| タイトル | text | ○ |");
    expect(md).toContain("### 画面遷移");
    expect(md).toContain("SCR-002");
  });

  it("escapes pipe characters in cell values", () => {
    const md = screenToMarkdown({
      screenId: "SCR-X",
      screenName: "テスト",
      fields: [{ name: "a|b", type: "text" }],
    });
    expect(md).toContain("a\\|b");
  });

  it("omits sections with no data without throwing", () => {
    const md = screenToMarkdown(sampleSet.screens[1]);
    expect(md).toContain("## SCR-002 タスク詳細");
    expect(md).not.toContain("### 項目");
  });
});

describe("screenSetToMarkdown", () => {
  it("includes a title and a screen index table", () => {
    const md = screenSetToMarkdown(sampleSet, "テスト定義書");
    expect(md).toContain("# テスト定義書");
    expect(md).toContain("## 画面一覧");
    expect(md).toContain("| SCR-001 | タスク一覧 |");
    expect(md).toContain("| SCR-002 | タスク詳細 |");
  });
});

describe("screenSetToSheets", () => {
  it("emits an index sheet plus one sheet per screen", () => {
    const sheets = screenSetToSheets(sampleSet);
    // 画面一覧（目次）+ 2画面 = 3シート
    expect(sheets.length).toBe(3);
    expect(sheets[0].name).toBe("画面一覧");
    expect(sheets[1].name).toBe("SCR-001 タスク一覧");
    expect(sheets[2].name).toBe("SCR-002 タスク詳細");
    // 画面一覧はヘッダ + 2画面で 3 行
    expect(sheets[0].rows.length).toBe(3);
  });

  it("lays out each screen's sections vertically with headings", () => {
    // セルは素の値かスタイル付き { v } のどちらでも来るので値だけ取り出す。
    const text = (c: unknown): string =>
      c !== null && typeof c === "object" && "v" in c
        ? String((c as { v: unknown }).v ?? "")
        : String(c ?? "");
    const sheets = screenSetToSheets(sampleSet);
    const sheet = sheets[1]; // SCR-001
    const flat = sheet.rows.map((r) => r.map(text).join("|"));
    expect(flat).toContain("画面ID|SCR-001");
    expect(flat).toContain("■ 項目");
    expect(flat).toContain("■ 画面遷移");
    // データの無いセクションは見出しごと出ない（SCR-002 は項目なし）
    const detail = sheets[2].rows.map((r) => text(r[0]));
    expect(detail).not.toContain("■ 項目");
  });
});

describe("screenSetToXlsx", () => {
  it("produces a non-empty zip with a valid local-file signature", () => {
    const bytes = screenSetToXlsx(sampleSet);
    expect(bytes.length).toBeGreaterThan(0);
    // ZIP local file header signature "PK\x03\x04"
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // 末尾は end-of-central-directory signature "PK\x05\x06"
    const tail = bytes.slice(bytes.length - 22, bytes.length - 18);
    expect([tail[0], tail[1], tail[2], tail[3]]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});

describe("buildMocksZip", () => {
  const mocks = {
    "SCR-001": '<html><head><link href="/tokens"></head><body>一覧</body></html>',
    "SCR-002": '<html><head><link href="/tokens.css"></head><body>詳細</body></html>',
  };
  // store 方式なのでファイル名・本文はZIP内に素のバイトで載る。全体を復号して検査する。
  const dump = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

  it("emits one html file per generated mock plus a shared tokens.css", () => {
    const text = dump(buildMocksZip(sampleSet, mocks, "/* css */"));
    expect(text).toContain("SCR-001_タスク一覧.html");
    expect(text).toContain("SCR-002_タスク詳細.html");
    expect(text).toContain("tokens.css");
    expect(text).toContain("/* css */");
  });

  it("rewrites the tokens link to the bundled relative path", () => {
    const text = dump(buildMocksZip(sampleSet, mocks, ""));
    expect(text).toContain('href="tokens.css"');
    expect(text).not.toContain('href="/tokens"');
    expect(text).not.toContain('href="/tokens.css"');
  });

  it("skips screens that have no generated mock", () => {
    // SCR-001 のみ生成済み
    const text = dump(buildMocksZip(sampleSet, { "SCR-001": mocks["SCR-001"] }, ""));
    expect(text).toContain("SCR-001_タスク一覧.html");
    expect(text).not.toContain("SCR-002");
  });
});

describe("buildZip", () => {
  it("round-trips entry count into the end-of-central-directory record", () => {
    const enc = new TextEncoder();
    const zip = buildZip([
      { name: "a.txt", data: enc.encode("hello") },
      { name: "b.txt", data: enc.encode("world") },
    ]);
    const dv = new DataView(zip.buffer);
    // EOCD は末尾 22 バイト。total entries は offset 10。
    const eocd = zip.length - 22;
    expect(dv.getUint16(eocd + 10, true)).toBe(2);
  });
});
