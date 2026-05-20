# Tools

Notes on tools available to {{AGENT_NAME}}.

- `filesystem` — read / write / list inside the workspace.
- `shell` — execute shell commands. Requires user approval (`permission: ask`).
- `web_search` — Google Search grounding via Gemini.
- `web_fetch` — fetch a URL and extract markdown.

Additional tools register dynamically (browser, pdf_create, presentation_create, gemini_cli, etc.) as later phases land.
