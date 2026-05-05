# Contributing to AdkClaw

Thanks for thinking about contributing. AdkClaw is an open-source workshop and reference implementation for autonomous AI agents on Google's Agent Development Kit. We welcome PRs that improve the curriculum, the reference code, or the operational tooling.

## Quick start

```bash
git clone https://github.com/dahabit/adkclaw.git
cd adkclaw
npm install
cp .env.example .env       # add your Gemini key + Telegram token
npm run setup              # interactive: name your agent, pick tone
npm run dev                # daemon up at localhost:3000
npm test                   # all 145 tests should pass
```

## What we accept

| Type of contribution | What we look for |
|----------------------|------------------|
| **Bug fixes** | Reproduce → red test → green fix → PR. Include the reproduction in the PR description. |
| **New tools** | Adds an `AgentTool` with: `name`, `description` (the LLM signal!), `permission`, JSON Schema, `execute()`. Include unit tests + brief docs in `docs/extending.md`. |
| **New sub-agent profiles** | New file in `src/multi-agent/profiles/`. Include role + tool allowlist + default model. |
| **Skill files** | New `workspace.example/skills/<name>.md` with frontmatter. Brief description in `docs/extending.md`. |
| **Codelab improvements** | PRs to `level_N/README.md` with clearer instructions, fixed links, better diagrams. |
| **Documentation** | Improvements to `docs/`, especially `tech-stack.md`, `capabilities.md`, `internals.md`. |
| **Translation** | Codelab translations (Arabic, Spanish, Portuguese, etc.) to `level_N/README.<lang>.md`. |
| **Cloud Run deploy improvements** | `Dockerfile`, `cloudbuild.yaml`, `deploy/` scripts. Especially welcome: cost-reduction tips. |

## What we don't accept (yet)

- New LLM providers (Anthropic, OpenAI, etc.) — AdkClaw is **Google ADK only** by design. Forks welcome.
- LangChain / LangGraph / CrewAI integrations — frameworks hide what we teach. Forks welcome.
- Major architectural changes without a prior issue discussing the rationale.
- Web chat UI (`web/chat/`) — explicitly out of scope.

## Pull request process

1. **Open an issue first** for non-trivial changes (anything > 50 lines). Describe the goal and proposed approach. Avoids wasted work.
2. **Fork and branch**: `git checkout -b feat/your-feature` or `fix/your-bug`.
3. **Make your changes**:
   - Add tests for new code (`vitest`)
   - Run `npm run typecheck` (must pass clean)
   - Run `npm test` (must pass clean)
   - Run `npm run format` (Prettier)
4. **Write a clear commit message**:
   - First line: imperative mood, < 60 chars (`Add X`, `Fix Y`)
   - Body: explain the why, not the what
5. **Open the PR** with a description that includes:
   - What problem it solves
   - How to verify it works (manual test or test command)
   - Any breaking changes (call out clearly)
6. **Respond to review feedback** within 1 week to keep the PR moving.

## Code style

- TypeScript strict mode. No `any` without a justified `// @ts-expect-error: <reason>`.
- No comments unless the **why** is non-obvious.
- File-header doc comment on every new file in `src/` (see `src/agent/runner.ts` as the gold standard).
- Imports use `.js` extensions (NodeNext module resolution).
- Run `npm run format` before committing.

## Testing

- Unit tests in `<file>.test.ts` next to the implementation.
- Integration tests against real workspace files (no mocks for filesystem).
- Mock the LLM (`vi.mock('@google/genai')`) — never make real API calls in tests.
- Aim for *behavior* coverage, not line coverage.

## Domain-specific guidelines

### Adding a tool
1. Define in `src/tools/<name>.ts` exporting an `AgentTool`
2. Description is the **only signal the LLM uses** to pick the tool — write it carefully
3. Permission tier: `allow` for read-only, `ask` for writes/destructive, `deny` for forbidden
4. Add to `src/index.ts` registration block
5. Document in `docs/extending.md`

### Adding a sub-agent profile
1. New file in `src/multi-agent/profiles/<Name>Agent.ts`
2. Include `role`, `reportsTo`, `bootstrap`, `defaultModel`, `toolAllowlist`, `maxToolRounds`
3. Default model = Flash unless the task genuinely needs Pro (cost discipline)
4. Add to `src/multi-agent/profiles/index.ts` registry

### Modifying the agent loop
1. Read `src/agent/runner.ts` doc header thoroughly
2. Don't import workspace details — use the `ContextEngine` interface
3. Don't bypass `HealingEngine` — wrap any new external call
4. Add tests in `src/agent/runner.test.ts`

## Reporting bugs

Open an issue with:
- AdkClaw version (`git rev-parse HEAD`)
- Node version (`node --version`)
- Operating system
- Reproduction steps (the smaller, the better)
- Expected vs actual behavior
- Daemon log excerpt (with secrets redacted)

## Reporting security vulnerabilities

**Do not open a public issue.** Email the maintainers directly:

`security@adkclaw.dev` *(or DM the maintainer on Telegram if you have their handle)*

We aim to acknowledge within 48 hours and patch within 7 days for high-severity issues.

## Code of conduct

Be kind. Be constructive. Disagree without being disagreeable.

We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) v2.1.

## License

By contributing, you agree your code is licensed under [Apache 2.0](LICENSE).

## Thanks

AdkClaw stands on the shoulders of:
- [Google Agent Development Kit](https://google.github.io/adk-docs/)
- [OpenClaw](https://paperclip.ing) — the production-grade agent system that inspired the curriculum
- [Way Back Home](https://github.com/gca-americas/way-back-home) — Google Developer Champions Americas — the codelab pattern we follow

If you want to contribute but aren't sure where to start, look for issues labeled `good first issue` or `help wanted`.
