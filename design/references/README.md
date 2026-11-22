# References

Research gathered on 22 November 2026 to ground the design language. Read this before
quoting any of it.

## How it was gathered, and how far to trust it

- The five `*-research.md` files were produced by research agents using web search.
  Several primary sites were unreachable from the session (nngroup.com, w3.org,
  web.dev, developer.chrome.com, fonts.google.com, among others), so many claims rest
  on **search-result excerpts, not full-text reads**. Each report says so at the top
  and marks individual items **[unverified]**.
- What was checked directly: font axes and licences (from Fontsource package
  metadata), tour-library versions and licences (from the npm registry), and the
  DESIGN.md format (from its GitHub spec).
- Onboarding benchmark figures are vendor self-reported. Material 3 Expressive's
  research figures are Google's own. Sentiment about "AI slop" and overused fonts is
  blog opinion; only one figure in that area is measured.
- Browser-support rows conflicted between sources in a few places (cross-document view
  transitions, `shape()`, `interpolate-size`, `prefers-reduced-transparency`). Check
  MDN or caniuse before depending on one.
- WCAG criterion wording was written from memory. Confirm against
  https://www.w3.org/TR/WCAG22/ before quoting it anywhere formal.

`votehound-working-copy.md` is different in kind: it is read directly from the design
canvas, so its values are exact.

## Files

| File | Use it for |
|---|---|
| `votehound-working-copy.md` | The precedent: what the language inherits, with measured values |
| `typography-research.md` | Legibility evidence, pairing practice, font bench with verified axes, loading |
| `motion-materials-research.md` | Liquid Glass and its reception, motion evidence, WCAG, technique support table |
| `tours-and-delight-research.md` | Do tours work, benchmarks, libraries and licences, delight theory, egg examples |
| `component-libraries-research.md` | The vibe-coded tells, headless and styled libraries, tokens, DESIGN.md format |
| `claude-code-plugin-research.md` | Plugin layout, install, versioning by commit, hooks, where plugins load |

## Refresh

Defaults and support tables move. Re-run the library, font-sentiment and
browser-support sections every six months or so, and whenever a decision depends on
one of the unverified items.
