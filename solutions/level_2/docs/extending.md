# Extending AdkClaw

Three ways to give the agent new capabilities — no core changes needed for the first two.

## 1. Workspace skills (no code, hot-reload)

Drop a markdown file into `workspace/skills/` and the agent picks it up on the next turn — no restart.

```
workspace/skills/
├── research-topic.md
├── write-blog-post.md
└── monitor-github-releases.md
```

**Skill file format:**

```markdown
---
name: write-blog-post
description: Use when the user asks to write a blog post, article, or long-form content piece.
when_to_invoke: User says "write a post about X", "draft an article on Y", "create content for Z"
---

## Steps
1. Use memory_recall to find any relevant past research on this topic
2. Clarify target audience and desired length if not specified
3. Draft an outline (headings + bullet points per section)
4. Expand each section into prose
5. Save draft to workspace output via text_create
6. Return the file path and a summary of what was written
```

**Rules:**
- `name` must match the filename (slugified)
- `description` is what the model reads when deciding to use this skill — be specific about triggers
- `when_to_invoke` is optional but helps the model pattern-match correctly
- Body can be as long as needed — it's only loaded via `load_skill` when the model chooses it

**The model's skill-selection loop:**
1. Bootstrap injects: `## Available Skills\n- research-topic: Use when ...\n- write-blog-post: ...`
2. Model sees the index and calls `load_skill('write-blog-post')` when relevant
3. Model reads the full body and follows the steps

**Self-authoring skills:** ask the agent to write its own skill: *"Create a skill file for the research workflow we just used so you remember it next time."* The agent writes the file via `text_create` into `workspace/skills/` and picks it up on the next bootstrap.

---

## 2. Memory bank entries (no code, persistent facts)

Add structured knowledge directly by writing markdown files into `workspace/bank/`:

```
workspace/bank/
├── facts/
│   ├── flutter-version.md
│   └── company-stack.md
├── decisions/
│   └── use-riverpod-for-state.md
├── projects/
│   └── adkclaw-build.md
└── people/
    └── dahabit.md
```

**File format:**

```markdown
---
name: flutter-version
tags: [flutter, versions]
updated: 2026-05-04
---

Flutter stable is 3.32 as of May 2026. Dart SDK 3.6.
Impeller is the default renderer on all platforms.
```

The agent reads all bank files on every bootstrap (as a one-liner index) and uses `memory_recall` to surface relevant entries. Add facts via the `memory_save` tool or by writing files directly.

---

## 3. New tools (code change, registered once)

Tools expose arbitrary code to the LLM. Full guide in [DEVELOPER.md](../DEVELOPER.md#adding-a-tool).

Quick checklist:
- [ ] `src/tools/<name>.ts` — export `make<Name>Tool(): AgentTool`
- [ ] `src/tools/<name>.test.ts` — tests first (TDD)
- [ ] Register in `src/index.ts`
- [ ] Add row to `src/tools/AGENTS.md`
- [ ] `npm run build && npm test` — both must be clean

**Permission guidance:**

| Operation | Use |
|-----------|-----|
| Read-only (files, web, memory) | `allow` |
| Write files, send messages | `ask` |
| Shell commands, external APIs with side effects | `ask` |
| Nothing — keep tool off model's radar | `deny` |

---

## 4. New sub-agent profiles (code change)

Profiles constrain a sub-agent to a role. Full guide in [DEVELOPER.md](../DEVELOPER.md#adding-a-sub-agent-profile).

Quick checklist:
- [ ] Add `AgentProfile` to `src/multi-agent/profiles/index.ts`
- [ ] Add to `PROFILES` export map
- [ ] Add `makeSpawn<Name>Tool` to `src/tools/spawn.ts`
- [ ] Register spawn tool in `src/index.ts`

**Profile model choice:**
- `defaultModel: 'flash'` — for single-step, fast tasks (search, communicate, format)
- `defaultModel: 'pro'` — for multi-step reasoning (research, code review, planning)

**toolAllowlist discipline:** start empty and add tools one by one. A researcher that can't write files can't accidentally corrupt the workspace. A communicator with no tools can't be used to exfiltrate data.

---

## 5. Integrating an external service

The recommended path is: **skill first → tool if the skill alone isn't enough**.

**Example: GitHub issue triage**

Step 1 — skill (no code):
```markdown
---
name: triage-github-issues
description: Use when the user wants to triage or review GitHub issues for a repo.
---
## Steps
1. Use web_fetch to load https://github.com/<owner>/<repo>/issues?state=open
2. For each issue title: classify as bug / feature / question
3. Return a table: issue #, title, classification, suggested label
```

Step 2 — if web_fetch isn't enough (e.g. API rate limits, private repos), add a `github_fetch` tool that calls the GitHub REST API with a token, then update the skill to use `github_fetch` instead.

This two-step approach keeps the tool surface minimal and keeps the logic teachable.

---

## 6. Adding a cron job via the agent

No code needed. Ask the agent to schedule something:

> "Monitor the Flutter changelog at https://docs.flutter.dev/release/release-notes every morning at 9am. If anything new shipped since yesterday, send me a message."

The agent will call `cron_add` to create the job, which persists in SQLite. Jobs survive restarts.

Manual cron management via the HTTP API:
```bash
# List jobs
curl http://localhost:3000/api/status | jq .sessions

# Via the REPL: ask the agent
adkclaw chat
> list all cron jobs
> remove the flutter monitor job
```

---

## Codelab development

The reference implementation is the answer key. Codelabs are carved from it in `codelab/`.

**Adding a workshop step:**
1. Identify the diff between consecutive working states
2. Copy only the relevant source files into the step directory
3. Replace to-be-implemented sections with stub comments
4. Verify `npm install && npm run dev` works in the step directory

**Step naming convention:** `step-<N>-<what-you-build>` — the name is the lesson title.

**The starter baseline** (`codelab/starter/`) should contain only:
- `package.json` with all deps
- `tsconfig.json`
- Empty `src/index.ts` stub
- `workspace.example/` copy

Students start from the starter, implement each step, and can verify against the solution.
