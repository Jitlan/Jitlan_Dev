## Personal design-language plugin: what the current Claude Code docs say

Sources fetched: plugins/overview, plugins/manifest-reference, plugins/components, plugins/install, plugins/loading, plugins/create-marketplace, plugins/host-marketplace, skills, hooks, settings, claude-code-on-the-web, desktop. Items marked **(uncertain)** are not stated outright in the docs I read.

### 1. Layout, manifest, components
Layout (default locations, all at the plugin root, not inside `.claude-plugin/`):
```
design-lang/
├── .claude-plugin/plugin.json   # optional; only "name" is required
├── skills/<skill>/SKILL.md      # plus reference.md, assets, scripts/
├── agents/*.md                  # subagents
├── commands/*.md                # legacy; the docs prefer skills for new work
├── hooks/hooks.json             # top-level "hooks" key, same shape as settings.json
├── .mcp.json  .lsp.json
├── output-styles/*.md  themes/*.json  bin/  monitors/monitors.json
```
Manifest fields include `name` (required, kebab-case), `displayName`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `defaultEnabled`, `dependencies`, `userConfig`, and component keys (`skills`, `commands`, `agents`, `hooks`, `mcpServers`, `outputStyles`). Component paths must start with `./`. Names starting with `claude-`, `anthropic-`, or `anthropics-` are rejected, so avoid them. A `CLAUDE.md` at the plugin root is not loaded; put instructions in a skill.
Source: https://code.claude.com/docs/en/plugins/manifest-reference.md and https://code.claude.com/docs/en/plugins/components.md

SKILL.md frontmatter: `name`, `description` (recommended), `when_to_use` (appended to description; description plus when_to_use is truncated at 1,536 characters in the listing), `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `hooks`, `paths`, `shell`. Unknown fields are ignored. Keep SKILL.md under 500 lines and move detail into linked files that load on demand; scripts are executed, not loaded.
Source: https://code.claude.com/docs/en/skills.md

### 2. Local install, marketplaces, versioning
- Development: `claude --plugin-dir ./design-lang` loads the plugin for one session in place. Run `/reload-plugins` after edits.
- Local marketplace: create `my-marketplace/.claude-plugin/marketplace.json` with a plugin entry whose `source` is `"./plugins/design-lang"`, then:
  - `claude plugin validate ./my-marketplace`
  - `claude plugin marketplace add ./my-marketplace` (or `/plugin marketplace add ./my-marketplace` in a session)
  - `claude plugin install design-lang@my-marketplace` (in a session, `/plugin install` opens the details panel so you choose a scope)
- Relative-path plugins from a local marketplace load in place, so edits apply at the next session or on `/reload-plugins` with no version bump.
- GitHub as marketplace: push the marketplace directory to a repo and users run `/plugin marketplace add owner/repo` (optionally `#ref`). Private repos use the machine's git credentials (`gh auth login` then `gh auth setup-git`). Background auto-update is off by default for third-party and personal marketplaces; turn it on under `/plugin` > Marketplaces.
- Versioning: a `version` in plugin.json pins users until you change it. Omit `version` and users track commits (SHA). Do not set it in both plugin.json and the marketplace entry. Update with `/plugin` > Installed > Update now, or `claude plugin update design-lang@my-marketplace`, then `/reload-plugins`.
- Scopes: user (`enabledPlugins` in `~/.claude/settings.json`), project (`.claude/settings.json`, committed), local (`.claude/settings.local.json`).
Sources: https://code.claude.com/docs/en/plugins/create-marketplace.md, https://code.claude.com/docs/en/plugins/install.md, https://code.claude.com/docs/en/plugins/loading.md, https://code.claude.com/docs/en/plugins/host-marketplace.md

### 3. Namespacing, ${CLAUDE_PLUGIN_ROOT}, static assets
- `skills/tokens/SKILL.md` in plugin `design-lang` runs as `/design-lang:tokens`. A `name:` in frontmatter replaces the last segment.
- `${CLAUDE_PLUGIN_ROOT}` is the plugin's install directory for the current version. It is substituted in skill, command, and agent Markdown and in `allowed-tools` Bash rules, and exported to hook, MCP, and LSP processes. It is not present in Bash-tool environment variables. It changes on update, so keep state in `${CLAUDE_PLUGIN_DATA}`, which persists across updates.
- Static assets: plugin files are copied into the cache at install, but only files inside the plugin directory. A skill can reference bundled files by path and tell Claude to copy them into the project, for example `allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/scripts/copy-tokens.sh *)`. **(uncertain)** The docs do not show an asset-copy example; this follows from the documented substitution rules.
Sources: https://code.claude.com/docs/en/skills.md, https://code.claude.com/docs/en/plugins/manifest-reference.md#environment-variables, https://code.claude.com/docs/en/plugins/loading.md

### 4. Enforcing a design system
- Triggering: rely on `description` and `when_to_use`, and front-load frontend phrases (React, TSX, CSS, Tailwind, component, page). Do not set `disable-model-invocation`. The docs do not guarantee auto-loading. **(uncertain)** For reliability, add a line to the project CLAUDE.md telling Claude to invoke `/design-lang:<skill>` for any frontend work. Project CLAUDE.md is always loaded.
- Lint hook: plugin `hooks/hooks.json` with `PostToolUse`, matcher `Write|Edit`, and a command `"\"${CLAUDE_PLUGIN_ROOT}/scripts/lint-tokens.sh\""`. The file path is in `tool_input.file_path` on stdin JSON. The handler `if` field uses permission-rule syntax, such as `Edit(*.css)` or `Write(*.tsx)`, to filter by extension. PostToolUse runs after the edit, so it cannot undo it. Feedback options: exit 2 with stderr (Claude sees it), `decision: "block"` with `reason`, or `hookSpecificOutput.additionalContext`. **(uncertain)** For preventing a write before it happens, the docs point to PreToolUse; I did not verify its schema here.
- Point the project's CLAUDE.md or DESIGN.md at the skill name and the token file path. Enable the plugin in the repo's `.claude/settings.json` `enabledPlugins` so teammates who install it get it.
Sources: https://code.claude.com/docs/en/hooks.md, https://code.claude.com/docs/en/skills.md, https://code.claude.com/docs/en/plugins/loading.md

### 5. Cloud sessions and desktop app
- Claude Code on the web (claude.ai/code): a cloud session does not load plugins you installed locally, nor plugins that the repo's `.claude/settings.json` enables, and it does not add `extraKnownMarketplaces` marketplaces. Plugins are therefore not available there. **(uncertain)** A workaround is to commit the skill and token files into the repo itself (for example under `.claude/skills/`), since repo contents are part of the clone. I did not read the cloud "what carries over" section to confirm skill behavior.
- Desktop app: plugins are supported. Use the `+` button next to the prompt, then Add plugins or Browse plugins, and choose user, project, or local scope. The terminal, desktop local sessions, and VS Code share the same settings files. Plugins installed in the desktop app are not available to cloud sessions, and plugins are not available in WSL sessions.
Sources: https://code.claude.com/docs/en/claude-code-on-the-web.md, https://code.claude.com/docs/en/desktop.md, https://code.claude.com/docs/en/plugins/loading.md, https://code.claude.com/docs/en/settings.md

Not covered: the `claude plugin eval` harness (available, separate reference) and plugins/create.md, which I did not fetch.
