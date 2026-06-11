# Repository Guidelines

## Project Structure & Module Organization

This is a Hono + Vite project written in TypeScript. The main UI lives in `src/app/page.tsx` and renders with Hono JSX DOM from `src/client/main.tsx`. Shared components are in `src/components/`, and small UI primitives are under `src/components/ui/`. API routes and static serving live in `src/server/routes.ts`. Core logic, schemas, Codex integration, export helpers, previews, and repository access are in `src/lib/`. Prompt builders are in `src/lib/prompts/`. Tests are colocated as `*.test.ts` files, mostly under `src/lib/`. Static design-token themes are in `public/tokens/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies; Node.js `>=20.9.0` is required.
- `pnpm dev`: start the Hono API server and Vite client.
- `pnpm build`: create a production client build and compiled Hono server.
- `pnpm start`: serve the production build after `pnpm build`.
- `pnpm typecheck`: run TypeScript with `--noEmit`.
- `pnpm lint`: run ESLint.
- `pnpm test`: run the Vitest suite once.
- `pnpm test:watch`: run Vitest in watch mode.
- `pnpm security:pmsec`: verify npm/pnpm install-time hardening for this repository.

## Coding Style & Naming Conventions

Use TypeScript, Hono, and Hono JSX DOM. Match nearby code for formatting, comment density, and component structure. Prefer named exports for shared helpers and keep pure logic in `src/lib/` when it can be tested outside UI code. Components use kebab-case filenames such as `project-sidebar.tsx`; tests use `*.test.ts`. When editing prompts, keep `src/lib/prompts/*` aligned with Zod schemas in `src/lib/schemas.ts`.

## Testing Guidelines

Vitest is the test framework. Add or update colocated tests for new logic, schema changes, prompt builders, parsing, exports, and repository behavior. The current test suite is designed to run without Codex login or network access. Before submitting, run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm security:pmsec`.

## Commit & Pull Request Guidelines

Recent history uses concise Japanese change labels such as `（Mod）READMEを更新...`, plus merge commits from GitHub PRs and Dependabot. Keep commits focused and descriptive. Create topic branches like `feat/...` or `fix/...`. Pull requests should follow `.github/PULL_REQUEST_TEMPLATE.md`, describe the change, link related issues when available, include screenshots for UI changes, and confirm the required checks above.

## Security & Configuration Tips

Do not commit Codex auth files or local databases. Generation uses the server user's existing `codex login` session; do not reintroduce browser API-key storage. Follow `SECURITY.md` for vulnerability reports and key-handling expectations. Keep dependency automation in `renovate.json`; do not reintroduce `.github/dependabot.yml` for scheduled dependency PRs.
