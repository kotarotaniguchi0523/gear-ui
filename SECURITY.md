# Security Policy

## Supported Versions

Security fixes target the current `main` branch.

## Reporting a Vulnerability

Please report vulnerabilities privately through GitHub Security Advisories or the repository maintainers. Do not open a public issue for sensitive reports.

## Credential Handling

- The browser UI does not collect or store Anthropic/OpenAI API keys.
- Generation uses `@openai/codex-sdk` on the server side.
- Codex authentication comes from the server process user's existing Codex login session.
- Treat Codex auth files under `CODEX_HOME` or `~/.codex` as secrets. Do not commit them or paste them into issues, logs, or chat.

## Dependency Installation

- Use pnpm, not npm, for dependency installation in this repository.
- Run `pnpm security:pmsec` before submitting changes that affect dependencies or package manager configuration.
- pnpm project hardening is stored in `pnpm-workspace.yaml`; do not add pnpm settings to `.npmrc`.

## Generated HTML

Generated mocks are rendered in a sandboxed iframe. Keep that boundary intact when changing preview behavior.

## Local Data

Projects are stored in SQLite. By default the database is under `data/projects.db`; set `UI_AI_CREATOR_DB_PATH` to move it.
