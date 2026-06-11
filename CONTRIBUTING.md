# Contributing to gear-ui

Contributions are welcome.

## Prerequisites

- Node.js `>=20.9.0`
- pnpm
- `codex login` completed for local generation testing

Install and start the app:

```bash
pnpm install
pnpm dev
```

The Vite client normally runs on `http://localhost:5173`; the Hono API server runs on `http://localhost:3000`.

## Before Opening a PR

Run all checks:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm security:pmsec
```

The unit test suite does not require Codex login, API keys, or network access.
`pnpm security:pmsec` checks npm/pnpm install-time hardening for this repository. Full `npx pmsec` may also report tools that are not part of this repo, such as Bundler; those are host-level findings.

## Git Hooks

Lefthook is installed by `pnpm install` via the `prepare` script. The pre-commit hook runs `pnpm lint:actions` for changed GitHub Actions workflows, which invokes `sisakulint`.

## Pull Request Flow

1. Fork the repo and create a topic branch such as `feat/...` or `fix/...`.
2. Make a focused change and add or update tests when behavior changes.
3. Run the checks above.
4. Open a PR using `.github/PULL_REQUEST_TEMPLATE.md`.
5. Include screenshots for UI changes and link related issues when available.

## Coding Guidelines

- Use TypeScript with Hono, Hono JSX DOM, and Vite.
- Keep server-only code out of client bundles; Codex SDK usage belongs behind `src/lib/codex.ts` and Hono routes.
- Keep schemas in `src/lib/schemas.ts` aligned with prompt output.
- Prefer colocated tests named `*.test.ts`.
- Keep pnpm project hardening in `pnpm-workspace.yaml`; do not add pnpm settings to `.npmrc`.
- Do not reintroduce browser API-key storage or provider-specific SDKs unless the project direction changes.

## Contributor License Agreement

By submitting a contribution, you agree that your contribution is provided under the terms described in this repository's Apache-2.0 license and existing project contribution policy.
