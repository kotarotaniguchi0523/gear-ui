# gear-ui

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.9-3c873a.svg)](#動作要件)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

**[日本語](#日本語)** | **[English](#english)**

> AIで **画面UI定義書** と **HTMLモック** を2段パイプラインで生成する OSS ツール。
> An OSS tool that generates screen-UI specifications and HTML mocks with a two-stage LLM pipeline.

---

# 日本語

AIで **画面UI定義書** と **HTMLモック** を2段パイプラインで生成する OSS ツールです。

```
要件文 ─[LLM]─▶ 画面UI定義書 (JSON) ─[LLM]─▶ HTML モック (Tailwind + デザイントークン)
                                                  │
                            tokens.css の差し替えだけでテーマを一括変更
```

LLM は **Claude (Anthropic)** と **OpenAI / OpenAI互換** を切り替えて利用できます。

## 特徴

- **仕様駆動**: いきなり「自然言語 → UI」に飛ばず、画面UI定義書JSONを**中間表現**として挟むので、画面間で項目名・遷移・コンポーネントが一貫します
- **デザイントークン縛り**: モック生成プロンプトに「生のカラーコード禁止、`var(--color-primary)` のようなセマンティック変数のみ使用」というガードレールが組み込まれており、`tokens.css` の差し替えだけで全画面のテーマを切り替えられます
- **マルチプロバイダ**: 環境変数だけで Claude / OpenAI / OpenAI互換（OpenRouter・Together・Groq・Ollama 等）を切り替え可能
- **iframeプレビュー**: 生成HTMLは即プレビュー。`sandbox` で隔離されているので安全

## 動作要件

- **Node.js >= 20.9**（Next.js 16 の要件）
- いずれかのLLM APIキー:
  - **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
  - **OpenAI** または OpenAI互換プロバイダ

## クイックスタート

```bash
# 1. 依存をインストール
npm install

# 2. （任意）共通のAPIキー／プロバイダを使う場合は環境変数を設定
cp .env.example .env.local
#    .env.local を編集してプロバイダとAPIキーを設定

# 3. 開発サーバー起動
npm run dev

# 3. ブラウザで http://localhost:3000 を開き、
#    右上の「設定」から Anthropic API キーを入力（BYOK）
#    キーは端末のlocalStorageに保存され、サーバに永続化はされません
```

> **BYOK（Bring Your Own Key）**: UIから直接APIキーを設定する方式なので、`.env` の編集は不要です。
> サーバホスト側で全ユーザー共通のキーを設定したい場合は `cp .env.example .env.local` で `ANTHROPIC_API_KEY` を設定するとフォールバックとして使われます。

### プロバイダの設定例

`.env.local`:

```bash
# Claude（既定）
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
# LLM_MODEL=gpt-4o            # 任意

# OpenAI互換の例：OpenRouter
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=anthropic/claude-sonnet-4-5

# ローカルの Ollama
LLM_PROVIDER=openai
OPENAI_API_KEY=ollama          # ダミーで可
OPENAI_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1
```

## 使い方

1. 左ペインに要件文を入力（システム概要・対象ユーザー・機能など、自由形式）
2. 「画面定義を生成」で 1〜8 画面分の UI 定義書 JSON が生成される
3. 画面タブを選択して中央ペインで JSON を確認
4. 右ペインの「モックを生成」で選択画面の HTML モックを生成
5. テーマセレクタ（neutral / indigo / emerald）でデザイントークンを切り替え（**再生成なしで即反映**）
6. 「デザインルール」ボタンから、情報密度・角丸・レイアウト・トーンの方針や自由記述の指示を設定（**プロジェクトごとに保存**。次回のモック生成／再生成に反映）

## デザインルール

モックの**見た目の方針**をプロジェクト単位で指定できます。プレビュー上部の「デザインルール」ボタンから設定し、内容はプロジェクトに保存されます。設定後に「モックを生成／再生成」すると反映されます。

| 項目 | 選択肢 | 用途 |
|---|---|---|
| 情報密度 | コンパクト / 標準 / ゆったり | 余白・パディングの詰まり具合 |
| 角丸 | シャープ / 標準 / 丸め | カードやボタンの角の丸さ |
| レイアウト | おまかせ / サイドバー / トップナビ | ナビゲーションの基本配置 |
| トーン | おまかせ / プロ / フレンドリー / ミニマル / ポップ | 全体の雰囲気 |
| 追加のデザイン指示 | 自由記述 | プリセットで表しきれない細かな指定（デザイナー向け） |

プリセットで手軽に、自由記述でより細かく——という二段構えなので、初心者でもデザイナーでも扱えます。指定はモック生成プロンプトに差し込まれますが、**デザイントークン縛り（生のカラーコード禁止）は引き続き厳守**されます。色そのものはデザイントークン（テーマ）側で管理します。

## アーキテクチャ

```
src/
├── app/
│   ├── api/generate/
│   │   ├── definition/route.ts  # 要件文 → 画面UI定義書JSON
│   │   └── mock/route.ts        # 画面UI定義書JSON → HTMLモック
│   ├── layout.tsx
│   ├── page.tsx                 # プレイグラウンドUI（3カラム）
│   └── globals.css
└── lib/
    ├── llm.ts                   # プロバイダ抽象 + JSON/HTML 抽出
    ├── schemas.ts               # Zod スキーマ
    └── prompts/
        ├── screen-definition.ts # 1段目プロンプト
        └── screen-mock.ts       # 2段目プロンプト（トークン縛り）

public/tokens/
├── neutral.css                  # モノクロ系
├── indigo.css                   # インディゴ
└── emerald.css                  # エメラルド
```

## デザイントークン仕様

`public/tokens/*.css` で定義する CSS 変数:

| 変数 | 用途 |
|---|---|
| `--color-bg` | ページ背景 |
| `--color-surface` | カード・パネル背景 |
| `--color-fg` | メインテキスト |
| `--color-muted` | 補助テキスト |
| `--color-border` | 罫線 |
| `--color-primary` | プライマリーアクション背景 |
| `--color-primary-fg` | プライマリーアクション文字色 |
| `--color-danger` | 危険アクション背景 |
| `--radius-sm` / `--radius-md` / `--radius-lg` | 角丸サイズ |

独自テーマを足すには `public/tokens/<name>.css` を追加し、`src/lib/schemas.ts` の `tokenTheme` enum と `src/app/page.tsx` のセレクタに値を追加します。

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `LLM_PROVIDER` | — | `anthropic`（既定）または `openai` |
| `LLM_MODEL` | — | プロバイダ既定モデルの上書き |
| `ANTHROPIC_API_KEY` | `anthropic` 利用時 | Claude API キー |
| `OPENAI_API_KEY` | `openai` 利用時 | OpenAI（互換）API キー |
| `OPENAI_BASE_URL` | — | OpenAI互換エンドポイントのURL |

既定モデル: `anthropic` → `claude-sonnet-4-5`, `openai` → `gpt-4o`

## 開発・テスト

```bash
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック
npm run lint       # ESLint
npm test           # 単体テスト (Vitest)
npm run test:watch # ウォッチ実行
npm run build      # 本番ビルド
```

スキーマ検証・プロバイダ解決・JSON/HTML抽出・プロンプトビルダーの単体テストを [Vitest](https://vitest.dev/) で用意しています。**APIキーやネットワークは不要**です。

## フォントについて

UI フォント（Geist / Geist Mono / Chakra Petch / Noto Sans JP）は `geist` と `@fontsource/*` で **self-host** しています。ビルド時に Google Fonts へアクセスしないため、オフライン環境でも `npm run build` が完結します。

## コントリビューション

歓迎します！ まずは以下をご覧ください:

- [CONTRIBUTING.md](./CONTRIBUTING.md) — セットアップと PR の流れ
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — 行動規範
- [SECURITY.md](./SECURITY.md) — 脆弱性報告と APIキーの扱い

## ライセンス

[Apache License 2.0](./LICENSE)

---

# English

An OSS tool that generates **screen-UI specifications** and **HTML mocks** with a two-stage LLM pipeline.

```
requirement ─[LLM]─▶ screen spec (JSON) ─[LLM]─▶ HTML mock (Tailwind + design tokens)
                                                    │
                              swap tokens.css to re-theme every screen
```

The LLM backend is pluggable: **Claude (Anthropic)** or **OpenAI / OpenAI-compatible** providers.

## Features

- **Spec-driven**: a JSON screen spec sits between "natural language" and "UI", keeping field names, transitions, and components consistent across screens.
- **Design-token guardrail**: the mock prompt forbids raw color codes and allows only semantic variables like `var(--color-primary)`, so swapping `tokens.css` re-themes every screen.
- **Multi-provider**: switch between Claude, OpenAI, and OpenAI-compatible endpoints (OpenRouter, Together, Groq, Ollama, ...) via env vars alone.
- **iframe preview**: rendered instantly inside a sandboxed `<iframe>`.

## Requirements

- **Node.js >= 20.9** (required by Next.js 16)
- An API key for one provider:
  - **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
  - **OpenAI** or an OpenAI-compatible provider

## Quick Start

```bash
# 1. install dependencies
npm install

# 2. configure env vars
cp .env.example .env.local
#    edit .env.local to set the provider and API key

# 3. start the dev server
npm run dev

# 4. open http://localhost:3000 in your browser
```

### Provider examples

`.env.local`:

```bash
# Claude (default)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
# LLM_MODEL=gpt-4o            # optional

# OpenAI-compatible example: OpenRouter
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=anthropic/claude-sonnet-4-5

# local Ollama
LLM_PROVIDER=openai
OPENAI_API_KEY=ollama          # any non-empty value
OPENAI_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1
```

## Usage

1. Enter a requirement in the left pane (free-form: overview, target users, features, ...).
2. Click **Generate definitions** to produce 1–8 screen-spec JSON objects.
3. Select a screen tab to inspect the JSON in the center pane.
4. Click **Generate mock** in the right pane to render the HTML mock.
5. Use the theme selector (neutral / indigo / emerald) to switch design tokens — **applied live, no regeneration**.

## Architecture

```
src/
├── app/
│   ├── api/generate/
│   │   ├── definition/route.ts  # requirement → spec JSON
│   │   └── mock/route.ts        # spec JSON → HTML mock
│   ├── layout.tsx
│   ├── page.tsx                 # playground UI (3 columns)
│   └── globals.css
└── lib/
    ├── llm.ts                   # provider abstraction + JSON/HTML extraction
    ├── schemas.ts               # Zod schemas
    └── prompts/
        ├── screen-definition.ts # stage-1 prompt
        └── screen-mock.ts       # stage-2 prompt (token guardrail)

public/tokens/
├── neutral.css                  # monochrome
├── indigo.css                   # indigo brand
└── emerald.css                  # emerald brand
```

## Design Tokens

CSS variables defined in `public/tokens/*.css`:

| Variable | Purpose |
|---|---|
| `--color-bg` | page background |
| `--color-surface` | card & panel background |
| `--color-fg` | main text |
| `--color-muted` | muted text |
| `--color-border` | borders |
| `--color-primary` | primary action background |
| `--color-primary-fg` | primary action text |
| `--color-danger` | danger action background |
| `--radius-sm` / `--radius-md` / `--radius-lg` | corner radii |

To add a theme, create `public/tokens/<name>.css`, then register it in the `tokenTheme` enum (`src/lib/schemas.ts`) and the selector (`src/app/page.tsx`).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | — | `anthropic` (default) or `openai` |
| `LLM_MODEL` | — | override the default model |
| `ANTHROPIC_API_KEY` | when using Anthropic | Claude API key |
| `OPENAI_API_KEY` | when using OpenAI | OpenAI(-compatible) API key |
| `OPENAI_BASE_URL` | — | base URL for OpenAI-compatible endpoints |

Default models: `anthropic` → `claude-sonnet-4-5`, `openai` → `gpt-4o`

## Development & Testing

```bash
npm run dev        # dev server
npm run typecheck  # type check
npm run lint       # ESLint
npm test           # unit tests (Vitest)
npm run test:watch # watch mode
npm run build      # production build
```

Unit tests (schema validation, provider resolution, JSON/HTML extraction, prompt builders) run with [Vitest](https://vitest.dev/) — **no API key or network required**.

## Fonts

UI fonts (Geist / Geist Mono / Chakra Petch / Noto Sans JP) are **self-hosted** via `geist` and `@fontsource/*`, so the build never reaches out to Google Fonts and works offline.

## Contributing

Contributions are welcome! Please read:

- [CONTRIBUTING.md](./CONTRIBUTING.md) — setup & PR flow
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — code of conduct
- [SECURITY.md](./SECURITY.md) — reporting & API-key handling

## License

[Apache License 2.0](./LICENSE)
