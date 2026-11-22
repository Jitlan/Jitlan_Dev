# UI libraries, "vibe-coded" tells and DESIGN.md: state of play, November 2026

Every claim carries a source number from the list at the end. Items I could not confirm are marked **[unverified]**. Three hosts were blocked in this session (ui.shadcn.com, 2025.stateofreact.com, strapi.io), so shadcn facts come from its GitHub source and survey figures come from secondary coverage.

## 1. The "AI slop / vibe-coded" discourse

- **Anthropic's diagnosis (12 Nov 2025):** the blog post "Improving frontend design through Skills" names the cause "distributional convergence". It lists the tells as Inter/Roboto/Arial/system fonts, purple gradients on white, predictable layouts and minimal animation. Its ~400-token prompt steers four vectors: typography, colour and theme (CSS variables, "dominant colors with sharp accents"), motion (CSS-only first) and backgrounds. It also notes Claude then converges on Space Grotesk, so that is banned too. [1]
- **The current `frontend-design` SKILL.md goes further**, and it flags the *second-generation* tells:
  - Palettes: warm cream background (~#F4F1EA) with a serif and a terracotta accent; near-black with one acid-green or vermilion accent.
  - Layout: the "SaaS-card kit" of identical rounded cards, uniform radius, the same `rgba(0,0,0,.1)` shadow and gradient washes; a hero of big number, small label and gradient accent.
  - Template chrome: tracked all-caps eyebrow labels, `01/02/03` markers without a real sequence, `A · B · C` meta strings, monospace micro-labels, arrows appended to links, one accented word in a headline.
  - Motion: fade-and-slide-up entrances, hover effects on every card.
  - Process: plan 4–6 named colours, type roles and a wireframe; review the plan for defaults; "spend your boldness in one place". [2]
- **Community lists agree:** Inter, a purple/indigo gradient hero, centred hero plus three rounded cards, stock shadcn components, Lucide icons, glowing gradient borders. [3][4][5]
- **Tells move.** One audit catalogue says purple is the old default and "cream + serif + sage" is the 2026 tell, which matches Anthropic's own skill. [2][6]
- **The usual fix:** override theme tokens. Stock defaults are the giveaway, not shadcn itself. [4][7] These are opinion pieces, several of them promotional.
- **[unverified]** I found no specific sources for emoji headings, glassmorphism or excessive badges as tells, though they fit the same pattern.

## 2. Headless / primitive layers

| Library | Status | Notes |
|---|---|---|
| Base UI | v1.0.0 stable on **11 Dec 2025** (35 components), package renamed `@base-ui/react`, v1.6.0 by June 2026 | Backed by MUI, with contributors from Radix and Floating UI. InfoQ covered it in Feb 2026, but the changelog date is authoritative. [8][9] |
| Radix UI | Still WorkOS-owned and usable; unified `radix-ui` package adopted by shadcn in Feb 2026 | "Barely moving / momentum went elsewhere" is the community view. I found no official WorkOS statement, so treat the maintenance concern as **[unverified sentiment]**. [10][11][12] |
| React Aria Components (Adobe) | Stable, used in Adobe's own products | Consistently named the pick where accessibility and internationalisation matter most; the API is more verbose. HeroUI v3 builds on it. [10][13][14] |
| Ark UI / Zag.js | Active | Main draw is one state-machine core across React, Vue and Solid; it underlies Chakra v3 and Park UI. [10][14] |
| Web Awesome / Shoelace | Shoelace is sunset (last release 2.20.1, March 2025); Web Awesome 3.x is the successor (3.10–3.12 in mid-2026) | [15][16] |
| Spectrum Web Components | In transition from 1st-gen to 2nd-gen | No stable 2nd-gen date found. [17] |

- **Accessibility reputation:** React Aria leads by reputation because of Adobe's long assistive-technology testing and internationalisation work. Base UI and Radix are regarded as solid on WAI-ARIA patterns. I found no rigorous independent audit; the one axe-core comparison I saw has a weak methodology. One source cautions that "accessible by default" rarely means audited against real screen readers. [10][13][18]
- **[unverified]** I found no 2026 status news for Headless UI, Ariakit, Kobalte, Melt, Bits UI or Lit.

## 3. Styled systems

- **shadcn/ui:**
  - Base UI became the default for new projects on **2 July 2026**. Radix is "not being deprecated", and a migration skill ships via `npx skills add shadcn/ui`. [19]
  - The CLI has namespaced registries and an MCP server (CLI 3.0, Aug 2025). [20]
  - Eight built-in styles are reported (Nova, Vega, Maia, Lyra, Mira, Luma, Sera, Rhea), from a single secondary source. [21]
  - The sameness complaint is widespread: "most Tailwind + shadcn apps look like they were built by the same person or worse, the same AI model". The same piece blames skipping the design phase, not the components. [22] A competitor notes that extension blocks "look the same too" and points to headless primitives plus your own CSS. [21]
- **Chakra v3:** a rewrite onto Panda CSS and Ark UI that prompted teams to re-evaluate. Park UI is the same stack, and Mantine is cited as the closest batteries-included alternative. [23]
- **HeroUI v3:** React Aria plus Tailwind v4, described as having "gorgeous defaults" but an opinionated look. [14][23]
- **daisyUI 5:** a framework-agnostic Tailwind plugin. [23]
- **MUI:** still first in usage in State of React 2025. [24]
- **Tailwind:** Tailwind Labs cut 3 of 4 engineers on 6 Jan 2026. Docs traffic was down ~40% and revenue ~80%, attributed to AI; sponsors then stepped in. [25] State of CSS 2025 lists "excessive Tailwind usage" among pain points. [26]
- **Modern CSS:**
  - `:has()`, container queries and subgrid are now "everyday practice" per State of CSS 2025. [26]
  - `@scope` recently became Baseline. [27]
  - `light-dark()` and relative `oklch(from …)` colour are usable for theming. [28]
  - Tailwind v4 itself emits native cascade layers, so the split is about build step and authoring style, not capability. [29]
  - Evidence for dropping utility frameworks entirely is anecdotal. [29]
- **[unverified]** I found nothing current on vanilla-extract, Open Props, Catalyst or MUI/Mantine version specifics.

## 4. Animated / expressive collections

- Aceternity (dark, dramatic: 3D cards, beams, spotlights) "shows up on half the AI-startup landing pages". Magic UI is described as polished and opinionated, React Bits as subtler and more customisable. [30][31]
- "Particle effects and glowing borders were fresh in 2024. In 2026, too many sites look like the same dark-mode AI startup." (vendor-adjacent source) [32]
- The look is recognisable enough to be satirised as a component library, `performative-ui`. [33]
- **[unverified]** I found nothing specific on Motion Primitives, Animate UI, Origin UI/COSS or Kokonut.

## 5. Design tokens

- The Design Tokens Community Group published its **first stable version, 2025.10, on 28 Oct 2025**, with Format, Color and Resolver modules. It is a Final Community Group Report, **not a W3C Standard**. [34][35]
- Style Dictionary v5 uses it as the base format; v5.3.0 added the 2025.10 structured colour format, and v5.5.0 was current by July 2026. [36]
- Tokens Studio's Figma plugin is active (2.11.12, Aug 2026) and a new platform is replacing the old one. Explicit 2025.10 conformance is **[unverified]**. [37]
- For agents, DESIGN.md's CLI exports tokens to DTCG and to a Tailwind theme, so one file can feed both. [38]

## 6. DESIGN.md (precise structure)

- **What it is:** a Google Labs (Stitch) format, open-sourced at `github.com/google-labs-code/design.md` under Apache-2.0. Version is **`alpha`**: "spec, schema and CLI under active development". ~29k stars, no tagged releases. Release date is reported as 21 April 2026, though one source says March. [38][39][40]
- **File shape:** Markdown prose plus YAML tokens. Tokens go in `---` front matter and/or fenced `yaml` blocks inside sections. All blocks merge, and each top-level key may appear only once. [39]
- **Top-level keys:** `version` (optional, `alpha`), `name` (**required**), `description`, `omitted` (sections exempt from warnings), `colors`, `typography`, `rounded`, `spacing`, `motion`, `components`. [39]
- **Token types:** [39]
  - Colour: any CSS colour, including `oklch` and `color-mix()`; hex is the recommended default.
  - Typography: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `fontFeature`, `fontVariation`.
  - Dimension: `px`, `em` or `rem`. Duration: `ms`. Motion: `duration`, `delay`, `timingFunction`.
- **References:** `{colors.primary}`-style curly-brace dot paths. External files are referenced as an inline code span `@path/file.ext#fragment`, resolved from the DESIGN.md directory. [39]
- **Components:** recognised properties are `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`. Variants are sibling keys such as `button-primary-hover`. [39]
- **Sections:** `##` headings, all optional, but those present must follow this order: [38][39]
  1. Overview (alias: Brand & Style)
  2. Colors
  3. Typography
  4. Layout (alias: Layout & Spacing)
  5. Elevation & Depth (alias: Elevation)
  6. Shapes
  7. Motion & Micro-interaction (alias: Motion)
  8. Voice & Content Strategy
  9. Components
  10. Do's and Don'ts
- **Strictness:** unknown sections and token names are preserved; duplicate headings or duplicate YAML keys reject the file. [39]
- **Recommended names (non-normative):** colours `primary`, `secondary`, `tertiary`, `neutral`, `surface`, `on-surface`, `error`; type `headline-*`, `body-*`, `label-*`; rounded `none`–`full`. A `primary` colour is expected. [39]
- **CLI:** `lint`, `diff`, `export` (`tailwind`, `css-tailwind`, `dtcg`) and `spec`. Lint rules include `broken-ref` (error), `contrast-ratio` (WCAG AA 4.5:1), `orphaned-tokens`, `section-order` and `missing-typography`. [38]
- **Philosophy:** "the prose is where the design lives"; tokens are context, not rendering instructions. Use a specific reference instead of adjectives, and keep the do's and don'ts list short. [41]
- **Criticisms:** it is a lossy hand-written summary and weak on interaction states. [42]
- **awesome-design-md (VoltAgent):** brand-derived files, ~100k+ stars by Sept 2026 (counts conflict). Using one unmodified reproduces someone else's brand. [43]
- **Comparable conventions:**
  - Figma's MCP server has `create_design_system_rules`, which writes CLAUDE.md, AGENTS.md or Cursor rules. Code Connect maps Figma components to real code; Figma reports a 19.6% reduction in median task time. [44][45]
  - shadcn's registry and MCP server. [20]
  - Claude Code skills. [1][2]

## 7. Survey data

- **State of React 2025** (3,760 respondents, Nov 2025–Jan 2026, not representative): MUI is still first in usage with shadcn/ui "on the verge of overtaking". shadcn reportedly rose from 20% to 56% in two years, and Base UI is at 22%. The percentages are from secondary coverage; satisfaction figures are **[unverified]**. [24][46][47]
- **State of CSS 2025:** see section 3. No Tailwind satisfaction figure found. [26]
- **npm:** Base UI passed 6M weekly downloads, per shadcn's changelog. [19]

## What this implies for a personal design language

1. Write it as a DESIGN.md in the ten-section order with front-matter tokens, and run `lint` in CI. Pin to `alpha` and expect format churn.
2. Lead with prose anchored to a specific reference, then tokens. Keep the do's and don'ts short and list *your* banned defaults.
3. Ban both generations of tells: Inter plus purple gradient plus three cards, and cream plus serif plus terracotta, eyebrow caps, `01/02/03` and mono micro-labels.
4. Own the tokens: OKLCH colours, your own radius, shadow and spacing scales, exported to DTCG and Tailwind from one source.
5. Prefer primitives over styled kits. Base UI is the momentum default; choose React Aria Components where accessibility and internationalisation dominate. If you use shadcn, treat it as scaffolding and restyle everything.
6. Treat animated collections as a single accent, never a kit.
7. Use native CSS (layers, nesting, container queries, `light-dark()`, `@scope`) for the system layer; Tailwind v4 is optional.
8. Re-audit the ban list every six months or so, because defaults shift.

## Sources

1. https://claude.com/blog/improving-frontend-design-through-skills
2. https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
3. https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
4. https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p
5. https://dev.to/rams901/hallmark-stop-ai-generated-ui-slop-in-one-command-in-2026-3p9n
6. https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
7. https://matthewblode.com/blog/you-dont-have-to-make-ai-slop
8. https://base-ui.com/react/overview/releases/v1-0-0
9. https://www.infoq.com/news/2026/02/baseui-v1-accessible
10. https://designrevision.com/alternatives/radix-ui
11. https://dev.to/mashuktamim/is-your-shadcn-ui-project-at-risk-a-deep-dive-into-radixs-future-45ei
12. https://ui.shadcn.com/docs/changelog/2026-02-radix-ui
13. https://www.untitledui.com/blog/base-ui-vs-react-aria
14. https://heroui.com/blog/best-react-ui-component-libraries
15. https://next.shoelace.style/resources/changelog
16. https://github.com/shoelace-style/webawesome/releases
17. https://github.com/adobe/spectrum-web-components
18. https://www.disabilityworld.org/articles/accessible-component-libraries-survey/
19. https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/content/docs/changelog/2026-07-base-ui-default.mdx
20. https://ui.shadcn.com/docs/mcp and https://ui.shadcn.com/docs/registry/namespace
21. https://www.untitledui.com/blog/shadcn-alternatives
22. https://www.designsystemscollective.com/is-anyone-else-tired-of-every-tailwind-shadcn-app-looking-the-same-69c545e73114
23. https://designrevision.com/alternatives/chakra-ui
24. https://2025.stateofreact.com/en-US/libraries/component-libraries/
25. https://www.devclass.com/ai-ml/2026/01/08/tailwind-labs-lays-off-75-percent-of-its-engineers-thanks-to-brutal-impact-of-ai/4079571
26. https://2025.stateofcss.com/en-US/usage/
27. https://smashingmagazine.com/2026/02/css-scope-alternative-naming-conventions/
28. https://una.im/modern-css-theming
29. https://dev.to/zny10289/css-in-2026-container-queries-cascade-layers-and-the-end-of-utility-class-bloat-6k5
30. https://jeangalea.com/ai-ui-looks-generic/
31. https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026
32. https://vantaui.vercel.app/blog/7-modern-alternatives-to-aceternity-ui-for-next-js-16-in-2026
33. https://dev.to/0xgosu/performative-ui-when-startup-design-tropes-become-react-components-28if
34. https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
35. https://www.designtokens.org/tr/2025.10/
36. https://unpkg.com/style-dictionary@5.5.0/README.md
37. https://tokensstudio.featurebase.app/changelog
38. https://github.com/google-labs-code/design.md
39. https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md
40. https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/
41. https://raw.githubusercontent.com/google-labs-code/design.md/main/PHILOSOPHY.md
42. https://www.designsystemscollective.com/the-design-system-behind-design-md-and-why-its-harder-than-it-looks-d4df94897ed8
43. https://blog.brightcoding.dev/2026/09/16/voltagentawesome-design-md-designmd-files-for-ai-ui-generation
44. https://developers.figma.com/docs/figma-mcp-server/skill-create-design-system-rules
45. https://figma.com/blog/the-benefits-of-code-connect-in-mcp
46. https://heise.de/-11197819
47. https://www.ithome.com.tw/news/174034
