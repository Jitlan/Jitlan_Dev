# Plugin plan

The design language becomes a Claude Code plugin in its own repository, separate from
the portfolio. This document is the plan; nothing here is built yet. Facts about the
plugin system are from `../references/claude-code-plugin-research.md`.

Decisions already made:

- **Claude only, for now.** The plugin targets Claude Code's format (skills, hooks).
  No AGENTS.md, Cursor rules or other-agent layer.
- **Versions by commit.** No hand-bumped version number. Every commit to the plugin
  repository is a new version.
- **Local, personal use.** Installed on my machine at user scope; not published to a
  public marketplace.

## Repository

One repository that is both the marketplace and the plugin.

```
quicksilver/
├── .claude-plugin/
│   ├── marketplace.json        # lists one plugin, source "./"
│   └── plugin.json             # name + description. NO "version" field.
├── skills/
│   ├── design/                 # the main skill; auto-loads on frontend work
│   │   ├── SKILL.md            # under 500 lines: the contract and the workflow
│   │   ├── DESIGN.md           # the spec (moved from the portfolio)
│   │   └── docs/               # typography, core-and-spread, materials, motion, …
│   ├── init/SKILL.md           # copy tokens + DESIGN.md + EGGS.md into a project
│   ├── tour/SKILL.md           # write or update a tour manifest for a feature
│   ├── egg/SKILL.md            # propose an egg against the contract; log it
│   └── audit/SKILL.md          # review a screen against the definition of done
├── assets/
│   ├── tokens.css
│   ├── tour.schema.json
│   └── templates/              # EGGS.md, first-run.tour.json, core menu skeleton
├── hooks/hooks.json            # PostToolUse lint on written UI files
├── scripts/
│   ├── lint-design.mjs         # the checks the hook runs
│   └── contrast.py
└── references/                 # the research, for the skill to cite on demand
```

Avoid a plugin name starting with `claude-` or `anthropic-`; those are rejected.

## Versioning by commit

- `plugin.json` omits `version`, and the marketplace entry omits it too. With no
  version set, an installed plugin tracks the repository's commits, so every commit is
  a release.
- Setting `version` anywhere would pin installs until it changes. Don't.
- Third-party marketplaces do not auto-update by default. Turn it on once: `/plugin` →
  Marketplaces → enable auto-update for this marketplace. Otherwise update by hand with
  `claude plugin update quicksilver@<marketplace>` and then `/reload-plugins`.
- While developing, skip the marketplace entirely: `claude --plugin-dir ./quicksilver`
  loads the working copy in place, and `/reload-plugins` picks up edits.
- A marketplace added from a *local path* loads the plugin in place, so edits apply
  without a commit. Use the GitHub form for the by-commit behaviour.

`.claude-plugin/plugin.json`:

```json
{
  "name": "quicksilver",
  "description": "Personal design language: one core, three voices, five materials, a tour and an egg in every app.",
  "author": { "name": "Jordan Liebling" },
  "repository": "https://github.com/Jitlan/quicksilver"
}
```

`.claude-plugin/marketplace.json`:

```json
{
  "name": "jitlan",
  "owner": { "name": "Jordan Liebling" },
  "plugins": [
    { "name": "quicksilver", "source": "./", "description": "Personal design language." }
  ]
}
```

Install:

```
/plugin marketplace add Jitlan/quicksilver
/plugin install quicksilver@jitlan        # choose user scope
```

A private repository works; it uses the machine's git credentials.

Check the exact manifest field names against the current docs with
`claude plugin validate .` before the first install; the reference was written from
documentation summaries.

## The skills

| Skill | Invoked | Does |
|---|---|---|
| `quicksilver:design` | Automatically on frontend work, or by name | Loads the contract. Makes Claude name the core, the ceremony and the floating material before writing UI; build solid-first; run the checks. Detail lives in linked files that load on demand. |
| `quicksilver:init` | By name, once per project | Copies `tokens.css`, a project `DESIGN.md` (with the app's colour cast and voice casting), `EGGS.md` and a first-run tour manifest into the project, and adds one line to the project's `CLAUDE.md` pointing at the design skill. |
| `quicksilver:tour` | By name, or from `design` when a feature is added | Writes or updates `*.tour.json`, adds `data-tour` hooks, and adds the test that every target exists. |
| `quicksilver:egg` | By name | Proposes two or three eggs for the app, checks each against the contract, implements the chosen one lazily, logs it in `EGGS.md`. |
| `quicksilver:audit` | By name | Runs the definition of done against a screen: contrast script, Playwright with reduced motion and forced colours, keyboard pass. Reports failures; fixes on request. |

Triggering is by the skill's `description` and `when_to_use` (together capped at about
1,500 characters), so those front-load the words that appear in real requests:
component, page, screen, CSS, React, TSX, Tailwind, layout, animation, dark mode, UI.
Auto-loading is not guaranteed, which is why `init` also writes the line into the
project's `CLAUDE.md`.

## The hook

`hooks/hooks.json` registers a `PostToolUse` hook on `Write|Edit` for `.css`, `.html`,
`.tsx`, `.jsx`, `.vue`, `.svelte` files, running `scripts/lint-design.mjs` from
`${CLAUDE_PLUGIN_ROOT}`. It runs after the edit, so it reports and does not block:
findings go back to Claude as context, and Claude fixes them in the next edit.

First checks, chosen because they are mechanical and catch the common regressions:

- A colour literal outside the token file.
- A banned font family (Inter, Geist, Space Grotesk, Roboto, Instrument Serif).
- `transition: all`, an infinite animation, or a `linear-gradient` used as a surface
  background.
- An animation or transition in a file with no reduced-motion path and no use of the
  motion tokens.
- `backdrop-filter` without an `@supports` guard and a border.
- `onClick` on a `div` or `span`; `text-decoration: underline` on a non-link.
- A tour manifest with more than five steps, or a `target` with no matching
  `data-tour` in the project.

Keep the list short. A linter that cries wolf gets ignored by people and by agents.

## Where it works

- **Terminal, desktop app (local sessions), VS Code:** yes. They share the same
  settings files, so one user-scope install covers all three.
- **Claude Code on the web (cloud sessions):** installed plugins do not carry into
  cloud sessions. Until that changes, `quicksilver:init` copying `DESIGN.md` and
  `tokens.css` *into each project* is what makes the language available there: the
  files travel with the repository. That is also why the spec stays a plain
  `DESIGN.md` and is not only locked inside a skill.

## Build order

1. Create the repository; move `DESIGN.md`, `design/docs/` and `design/references/`
   into it; leave a pointer here.
2. Write `skills/design/SKILL.md` and try it with `--plugin-dir` on a throwaway app.
3. Add `init`, then use it on the portfolio and on VoteHound.
4. Add the hook with three checks; grow it only when a real regression slips through.
5. Add `tour`, `egg`, `audit`.
6. Add the marketplace file, install at user scope from GitHub, enable auto-update.
7. Write a handful of eval prompts ("build a settings page", "add a toast") and keep
   the outputs to compare after each change to the skill.

## Keeping tokens in one place

`tokens.css` and the front matter of `DESIGN.md` currently repeat each other. In the
plugin, pick one source (the front matter) and generate the other, or add a script that
fails when they disagree. Google's `design.md` CLI can lint the file and export tokens
to DTCG and Tailwind; it is alpha, so pin it and expect churn.
