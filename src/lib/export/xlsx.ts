import type { ScreenDefinition, ScreenDefinitionSet } from "@/lib/schemas";
import { buildZip, type ZipEntry } from "@/lib/export/zip";

// 画面UI定義書を .xlsx（Excel）へ変換する純粋関数。
// 既存のSI設計書文化に馴染むよう、項目・遷移などをシート分けして出力する。
// 依存ライブラリを足さず、OOXML(SpreadsheetML) を直接組み立てる。

export type CellStyle = "strong" | "heading";

// セル値は素の値（既定スタイル）でも、スタイル付き { v, style } でも書ける。
export interface StyledCell {
  v: string | number | boolean | undefined | null;
  style?: CellStyle;
}
export type CellInput = string | number | boolean | undefined | null | StyledCell;

export interface Sheet {
  name: string;
  rows: CellInput[][];
  // 先頭行を見出しとしてウィンドウ枠固定するか（目次シート向け）。
  freezeHeader?: boolean;
}

// セルXfs（styles.xml）のインデックスと対応。0=既定（罫線のみ）。
const STYLE_INDEX: Record<CellStyle, number> = { strong: 1, heading: 2 };

function isStyledCell(c: CellInput): c is StyledCell {
  return typeof c === "object" && c !== null && "v" in c;
}
function cellOf(c: CellInput): StyledCell {
  return isStyledCell(c) ? c : { v: c };
}

const encoder = new TextEncoder();

// styles.xml: フォント・塗り・罫線・セル書式の定義。
// s="0" 既定（細罫）/ s="1" 強調（太字＋薄グレー塗り）/ s="2" 見出し（太字大＋塗り）。
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF1E293B"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

// XML 1.0 が許可しない制御文字（\t \n \r 以外の C0 制御）が混ざると、
// Excel は「壊れたファイル」として開けなくなる。エスケープ前に取り除く。
function stripInvalidXmlChars(s: string): string {
  // 許可: \t(09) \n(0A) \r(0D)。それ以外の C0 制御文字（00-08, 0B, 0C, 0E-1F）を除去。
  // eslint-disable-next-line no-control-regex -- XML 1.0 invalid C0 control range.
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function escapeXml(s: string): string {
  return stripInvalidXmlChars(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 0-based 列インデックス → Excel の列名（0→A, 26→AA）。
function colName(index: number): string {
  let n = index;
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function cellValue(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "○" : "";
  return String(v);
}

// シート名に使えない文字 \ / ? * [ ] : を除去し、31文字に丸める（Excel の制約）。
function safeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

// 全角（CJK・記号）は約2文字幅として数え、列幅を中身に合わせて決める。
function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (ch.codePointAt(0) ?? 0) > 0xff ? 2 : 1;
  return w;
}

function colWidths(rows: CellInput[][]): number[] {
  const maxCols = rows.reduce((m, row) => Math.max(m, row.length), 0);
  const raw = new Array<number>(maxCols).fill(0);
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const text = cellValue(cellOf(row[i]).v);
      if (text) raw[i] = Math.max(raw[i], visualWidth(text));
    }
  }
  // 最小8・最大60に収め、少し余白を足す。
  return raw.map((w) => Math.min(60, Math.max(8, Math.round((w + 2) * 1.1 * 10) / 10)));
}

function sheetXml(sheet: Sheet): string {
  const widths = colWidths(sheet.rows);
  const cols = widths.length
    ? `<cols>${widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";
  // 先頭行（見出し）を固定。それ以外のシートは固定しない。
  const views = sheet.freezeHeader
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`
    : "";

  const rows = sheet.rows
    .map((row, r) => {
      const cells = row.map(cellOf);
      // 末尾の空セルは出さない（罫線のガタつき防止）。途中の空セルは罫線のため残す。
      let last = -1;
      for (let i = 0; i < cells.length; i++) {
        if (cellValue(cells[i].v) !== "") last = i;
      }
      if (last < 0) return `<row r="${r + 1}"/>`;
      let xml = "";
      for (let c = 0; c <= last; c++) {
        const sc = cells[c];
        const s = sc.style ? STYLE_INDEX[sc.style] : 0;
        const ref = `${colName(c)}${r + 1}`;
        const text = cellValue(sc.v);
        xml +=
          text === ""
            ? `<c r="${ref}" s="${s}"/>`
            : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
                text
              )}</t></is></c>`;
      }
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

// シート名は Excel 上で一意でなければならない。安全化したうえで衝突したら連番を付ける。
function uniqueSheetNames(sheets: Sheet[]): Sheet[] {
  const seen = new Set<string>();
  return sheets.map((s, i) => {
    let name = safeSheetName(s.name, i);
    if (seen.has(name)) {
      let n = 2;
      // 連番ぶんの桁を確保するため 31 文字制限内に収め直す。
      const base = name.slice(0, 28);
      while (seen.has(`${base}_${n}`)) n++;
      name = `${base}_${n}`;
    }
    seen.add(name);
    return { ...s, name };
  });
}

function buildWorkbook(sheets: Sheet[]): Uint8Array {
  const named = uniqueSheetNames(sheets);

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${named
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${
          i + 1
        }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join(
      ""
    )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named
    .map(
      (s, i) =>
        `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${
          i + 1
        }"/>`
    )
    .join("")}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named
    .map(
      (_, i) =>
        `<Relationship Id="rId${
          i + 1
        }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
          i + 1
        }.xml"/>`
    )
    .join(
      ""
    )}<Relationship Id="rId${
    named.length + 1
  }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/styles.xml", data: encoder.encode(STYLES_XML) },
    ...named.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: encoder.encode(sheetXml(s)),
    })),
  ];

  return buildZip(entries);
}

type Row = CellInput[];

const strong = (v: string | number): StyledCell => ({ v, style: "strong" });
const heading = (v: string): StyledCell => ({ v, style: "heading" });

// 1画面 = 1シート。画面の見出し（基本情報）に続けて、各セクションを縦に並べた
// 「設計書」らしいレイアウトを組む。空のセクションは見出しごと省く。
function screenToSheet(screen: ScreenDefinition): Sheet {
  const rows: Row[] = [];

  rows.push([strong("画面ID"), screen.screenId]);
  rows.push([strong("画面名"), screen.screenName]);
  if (screen.category) rows.push([strong("分類"), screen.category]);
  if (screen.targetUser) rows.push([strong("対象ユーザー"), screen.targetUser]);
  if (screen.overview) rows.push([strong("概要"), screen.overview]);

  const section = (title: string, header: string[], body: Row[]) => {
    if (body.length === 0) return;
    rows.push([]); // 空行で区切る
    rows.push([heading(`■ ${title}`)]);
    rows.push(header.map((h) => strong(h)));
    rows.push(...body);
  };

  section(
    "コンポーネント",
    ["名称", "種別", "説明"],
    (screen.components ?? []).map((c) => [c.name, c.type, c.description])
  );
  section(
    "項目",
    ["項目名", "型", "必須", "バリデーション", "説明"],
    (screen.fields ?? []).map((f) => [
      f.name,
      f.type,
      f.required ? "○" : "",
      f.validation,
      f.description,
    ])
  );
  section(
    "操作手順",
    ["#", "操作", "システム応答"],
    (screen.operationSteps ?? []).map((s) => [s.step, s.action, s.systemResponse])
  );
  section(
    "イベント",
    ["トリガー", "アクション", "説明"],
    (screen.events ?? []).map((e) => [e.trigger, e.action, e.description])
  );
  section(
    "画面遷移",
    ["トリガー", "遷移先", "条件"],
    (screen.transitions ?? []).map((t) => [t.action, t.destination, t.condition])
  );

  return { name: `${screen.screenId} ${screen.screenName}`, rows };
}

// 画面定義セットを、設計書として読みやすいシート構成に展開する。
// 先頭に画面一覧（目次）、続けて 1画面ずつのシートを並べる。
export function screenSetToSheets(set: ScreenDefinitionSet): Sheet[] {
  const index: Sheet = {
    name: "画面一覧",
    freezeHeader: true,
    rows: [
      ["画面ID", "画面名", "分類", "対象ユーザー", "概要"].map((h) => strong(h)),
      ...set.screens.map((s) => [
        s.screenId,
        s.screenName,
        s.category,
        s.targetUser,
        s.overview,
      ]),
    ],
  };

  return [index, ...set.screens.map(screenToSheet)];
}

export function screenSetToXlsx(set: ScreenDefinitionSet): Uint8Array {
  return buildWorkbook(screenSetToSheets(set));
}
