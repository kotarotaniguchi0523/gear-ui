# Security Policy / セキュリティポリシー

## 日本語

### 脆弱性の報告

セキュリティ上の問題を見つけた場合は、**公開 Issue を作成せず**、メールでご連絡ください:

- **kkuma6653@gmail.com**

可能であれば、再現手順・影響範囲・想定される攻撃シナリオを添えてください。
できるだけ早く確認し、対応方針をご返信します。

### API キーの取り扱い（重要）

- `ANTHROPIC_API_KEY` は **サーバーサイド（`src/app/api/**/route.ts`、`runtime = "nodejs"`）でのみ**読み込まれ、クライアント（ブラウザ）には一切送信されません。
- キーは `.env.local` に保存します。`.gitignore` で除外されており、コミットされません。**キーをコミット・公開しないでください。**
- このツールを公開ホスティングする場合、誰でも API を叩けてしまうと **API 利用料が発生**します。認証・レート制限を別途設けることを推奨します。

### 生成モックに関する注意

- 生成される HTML モックは `https://cdn.tailwindcss.com`（開発用 CDN）を読み込むため、プレビューには**ネットワーク接続が必要**です。本番用途には自前の Tailwind ビルドへ差し替えてください。
- プレビューは `<iframe sandbox>` で隔離して表示されます。

---

## English

### Reporting a vulnerability

If you discover a security issue, **please do not open a public issue.**
Instead, email us:

- **kkuma6653@gmail.com**

Where possible, include reproduction steps, impact, and a likely attack scenario.
We will acknowledge and respond with a remediation plan as soon as we can.

### API key handling (important)

- `ANTHROPIC_API_KEY` is read **only on the server** (`src/app/api/**/route.ts`,
  `runtime = "nodejs"`) and is never sent to the browser.
- The key lives in `.env.local`, which is git-ignored. **Never commit or publish your key.**
- If you host this tool publicly, an open API endpoint means anyone can incur
  **API usage costs** on your account. Add authentication and rate limiting.

### Note on generated mocks

- Generated HTML mocks load `https://cdn.tailwindcss.com` (a dev CDN), so previews
  **require network access**. Replace it with a self-hosted Tailwind build for production.
- Previews are rendered inside a sandboxed `<iframe>`.

### Supported versions

This project is pre-1.0; only the latest `main` receives security fixes.
