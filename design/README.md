# Quicksilver: the working files

`/DESIGN.md` at the repository root is the contract. This directory holds everything
behind it: the longer documentation, the research it rests on, and the ideas that are
not decided yet.

These files live in the portfolio repository for now. They are not part of the served
site (`dist/`). The plan is to move the reusable parts into a Claude Code plugin in its
own repository; see `docs/plugin-plan.md`.

## docs/ — how the language works

| File | What it covers |
|---|---|
| `docs/tokens.css` | The token source: colour, voices, shape, materials, motion. Starter CSS, ready to import. |
| `docs/typography.md` | The three voices, the emphasis grammar, the bench of approved fonts, loading. |
| `docs/core-and-spread.md` | The mercury model: core, drop, pool, bead; the laws; the implementation ladder. |
| `docs/materials.md` | Solid, paper, glass, metal, ink; the scrim rule; the material dial. |
| `docs/motion.md` | Two channels, the duration and easing tokens, the frequency budget, reduced motion. |
| `docs/components.md` | Anatomy, states and accessibility notes for each component. |
| `docs/guided-tours.md` | The tour rules, the step contract, the `tour.json` manifest, implementation. |
| `docs/easter-eggs.md` | The egg contract, kinds of egg, `EGGS.md`, the Playfulness setting. |
| `docs/accessibility.md` | The definition of done, the preference matrix, the contrast script. |
| `docs/plugin-plan.md` | How this becomes a Claude Code plugin that updates by commit. |

## references/ — what it rests on

| File | What it is |
|---|---|
| `references/votehound-working-copy.md` | What was taken from the VoteHound Working Copy redesign, with the measured values. |
| `references/typography-research.md` | Legibility studies, pairing practice, verified font axes and licences, loading. |
| `references/motion-materials-research.md` | Liquid Glass and its reception, motion evidence, WCAG, browser support for each technique. |
| `references/tours-and-delight-research.md` | Whether tours work, benchmarks, tour libraries and licences, delight theory, easter eggs. |
| `references/component-libraries-research.md` | The "vibe-coded" tells, headless and styled libraries, tokens, the DESIGN.md format. |
| `references/claude-code-plugin-research.md` | Plugin layout, install, versioning, hooks, what works where. |

Read `references/README.md` before quoting any of it: it says how the research was
gathered and which claims are unverified.

## ideas/ — not decided

| File | What it is |
|---|---|
| `ideas/backlog.md` | Things worth trying, roughly in order of how much I want them. |
| `ideas/open-questions.md` | Decisions that are still open, with the options. |
