# Contributing to gear-ui / コントリビューションガイド

日本語 / English — このリポジトリへの貢献を歓迎します！ Contributions are welcome!

---

## 日本語

### 開発環境のセットアップ

- Node.js **20.9 以上**（`package.json` の `engines` を参照）
- `npm install` で依存をインストール
- Claude API キーを `.env.local` に設定（[クイックスタート](./README.md#クイックスタート)参照）

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY を記入
npm run dev
```

### 変更を送る前に

プルリクエスト前に、以下がすべて通ることを確認してください。**API キーやネットワークは不要**です。

```bash
npm run typecheck   # 型チェック
npm test            # 単体テスト
npm run lint        # ESLint
npm run build       # 本番ビルド
```

### プルリクエストの流れ

1. リポジトリを fork し、`feat/...` や `fix/...` のようなトピックブランチを切る
2. 変更を加え、必要に応じてテストを追加・更新する（`src/**/*.test.ts`）
3. 上記のチェックをすべてパスさせる
4. わかりやすいコミットメッセージで PR を作成する（[PR テンプレート](./.github/PULL_REQUEST_TEMPLATE.md)に沿って記入）

### コーディング規約

- TypeScript / React（Next.js App Router）
- 既存ファイルのスタイル・命名・コメント密度に合わせる
- 新しい機能・分岐を足したらテストも添える
- LLM プロンプトを変更する場合は、出力スキーマ（`src/lib/schemas.ts`）との整合を保つ

### 独自テーマ（デザイントークン）の追加

`public/tokens/<name>.css` を追加し、`src/lib/schemas.ts` の `tokenTheme` enum と `src/app/page.tsx` のセレクタに値を追加してください。

---

## English

### Prerequisites

- Node.js **20.9+** (see `engines` in `package.json`)
- Install dependencies with `npm install`
- A Claude API key in `.env.local` (see the [Quick Start](./README.md#クイックスタート))

### Before opening a PR

Make sure all of the following pass. **No API key or network access is required.**

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

### Pull request flow

1. Fork the repo and create a topic branch (`feat/...`, `fix/...`).
2. Make your change and add/update tests where relevant (`src/**/*.test.ts`).
3. Get all checks above to pass.
4. Open a PR with a clear description, following the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).

### Coding guidelines

- TypeScript / React (Next.js App Router).
- Match the style, naming, and comment density of surrounding code.
- Add tests for new logic and branches.
- When changing LLM prompts, keep them consistent with the output schema in `src/lib/schemas.ts`.

### Adding a color palette (design tokens)

Add `public/tokens/<name>.css`, then register the value in the `colorPaletteEnum`
(`src/lib/schemas.ts`) and in the `COLORS` list in
`src/components/design-rules-dialog.tsx`. Color is part of the per-project design
rules (`DesignRules.color`); the preview swaps `/tokens/<color>.css` at render time.

---

## Contributor License Agreement (CLA)

By submitting a contribution (pull request, patch, or any other work) to this
project, you agree to the following terms:

1. **You retain copyright** in your contributions.

2. **License grant.** You grant Lancetier Inc. and all recipients of the software
   a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to
   use, reproduce, modify, prepare derivative works of, publicly display,
   publicly perform, sublicense, and distribute your contributions and such
   derivative works, consistent with the [Apache License 2.0](./LICENSE).

3. **Re-licensing right.** In addition, you grant Lancetier Inc. the right to
   license and re-license your contributions, and derivative works thereof,
   under any license terms of Lancetier Inc.'s choosing — including proprietary
   or commercial terms (for example, a hosted or open-core offering). This lets
   the project change its license in the future without requiring the consent of
   every contributor.

4. **You represent** that you are legally entitled to grant the above and that,
   to your knowledge, your contributions do not infringe the rights of any third
   party.

You also agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
