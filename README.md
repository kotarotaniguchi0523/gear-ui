# gear-ui

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.9-3c873a.svg)](#requirements)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

Codex で **画面 UI 定義書** と **HTML モック** を 2 段パイプラインで生成する OSS ツールです。

```
requirement ─[Codex]─▶ screen spec (JSON) ─[Codex]─▶ HTML mock
                                                    │
                              swap /tokens/*.css to re-theme every screen
```

## Features

- **Spec-driven generation**: requirements become a validated JSON screen-definition set before mock generation.
- **Design-token guardrails**: mock prompts forbid raw color codes and rely on semantic CSS variables.
- **Codex backend**: generation runs server-side through `@openai/codex-sdk`; browser API keys are not used.
- **Sandboxed preview**: generated HTML is rendered in a sandboxed iframe with live SSE progress.
- **Project persistence**: projects, definitions, mocks, chat history, and stale flags are stored in SQLite.

## Requirements

- Node.js `>=20.9.0`
- pnpm
- A logged-in Codex session for the server process user:

```bash
codex login
```

No Anthropic/OpenAI API key is configured in the app UI. Codex uses the server user's existing local Codex login session.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the Vite dev URL, normally `http://localhost:5173`. The Hono API server runs on `http://localhost:3000` and Vite proxies `/api` to it.

Optional configuration:

```bash
cp .env.example .env.local
# edit PORT or UI_AI_CREATOR_DB_PATH if needed
```

## Usage

1. Enter the system requirements in the left pane.
2. Click **画面定義を生成** to create the screen-definition JSON.
3. Select a screen in the center pane.
4. Click **モックを生成** or **全画面を生成** to create HTML mocks.
5. Adjust design rules and color tokens without regenerating existing HTML.
6. Use the chat pane to edit definitions or mocks after generation.

## Architecture

```
src/
├── server/
│   ├── index.ts          # Node entrypoint
│   └── routes.ts         # Hono API + static serving
├── client/
│   └── main.tsx          # Hono JSX DOM entrypoint
├── app/
│   ├── page.tsx          # main interactive UI
│   └── globals.css
├── components/           # Hono JSX DOM components
├── hooks/                # client state and API flows
└── lib/
    ├── codex.ts          # Codex SDK boundary
    ├── repo/projects.ts  # SQLite repository
    ├── schemas.ts        # Zod schemas
    └── prompts/          # prompt builders
```

API routes are defined as a Hono route chain and exposed to the client through `hono/client` where practical. Streaming generation endpoints keep the existing SSE event shape: `delta`, `done`, and `error`.

## Development

```bash
pnpm dev        # Hono server + Vite client
pnpm typecheck  # TypeScript
pnpm lint       # ESLint
pnpm test       # Vitest
pnpm build      # Vite client + compiled Hono server
pnpm start      # serve the production build
pnpm security:pmsec # npm/pnpm install hardening check
```

Unit tests cover schemas, prompt builders, repository behavior, export helpers, preview helpers, and response extraction. Tests do not require Codex login or network access.

## Supply-Chain Hardening

This repository uses pnpm project settings in `pnpm-workspace.yaml` for install-time hardening. Do not move pnpm settings into `.npmrc`; pnpm v11 reads project settings from `pnpm-workspace.yaml`.

- `pnpm security:pmsec` runs `pmsec` for the npm/pnpm tools relevant to this repository and verifies the pnpm project settings.
- Lefthook runs `pnpm lint:actions` as a pre-commit check for GitHub Actions workflows.

## Design Tokens

Themes live in `public/tokens/*.css`. To add a palette, add `public/tokens/<name>.css`, then register it in `src/lib/schemas.ts` and the color list in `src/components/design-rules-dialog.tsx`.

## License & Attribution

This repository is maintained as a fork of
[`lance-digital/gear-ui`](https://github.com/lance-digital/gear-ui).
It is licensed under the [Apache License 2.0](./LICENSE). Original copyright
and attribution notices from Lancetier Inc. are retained in [`LICENSE`](./LICENSE)
and [`NOTICE`](./NOTICE). Fork-specific modifications and maintenance are provided by
[`kotarotaniguchi0523`](https://github.com/kotarotaniguchi0523).
