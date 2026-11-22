---
version: alpha
name: Quicksilver
description: >
  A personal design language for apps built with Claude Code. One core element per
  screen; everything else spreads out of it and gathers back into it, like mercury.
  Three typographic voices, materials that are not always glass, a tour in every app,
  and at least one thing hidden for the curious.

colors:
  # Light scheme. This is the default cast, taken from the VoteHound Working Copy kit.
  # An app may recast every value; the roles and the contrast floors do not change.
  primary: "#2563EB"        # pen A: links, primary action, "for"
  secondary: "#C70011"      # pen B: the opposing mark, "against", destructive
  tertiary: "#E8C97A"       # highlighter: a fill behind ink text, never text itself
  neutral: "#5E6773"        # muted text
  surface: "#F1F5F9"        # paper: the page
  surface-raised: "#FFFFFF" # card: anything that sits on paper
  on-surface: "#0B1220"     # ink
  outline: "#E2E8F0"        # hairline between cards and paper (decorative)
  edge: "#7C8798"           # boundary of a control or a material (3:1 on paper and card)
  success: "#00712E"
  warning: "#A55800"
  error: "#C70011"
  # Dark scheme
  dark-primary: "#4D8DF7"
  dark-secondary: "#F87171"
  dark-tertiary: "#E8C97A"
  dark-neutral: "#9AA4B2"
  dark-surface: "#020617"
  dark-surface-raised: "#0F172A"
  dark-on-surface: "#F1F5F9"
  dark-outline: "#334155"
  dark-edge: "#6B7A90"
  dark-success: "#10B981"
  dark-warning: "#FBBF24"
  dark-error: "#F87171"

typography:
  # Professional voice: Atkinson Hyperlegible Next. Carries every word the app needs.
  body-md:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.45
  label-md:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.25
  headline-md:
    fontFamily: "Atkinson Hyperlegible Next"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  code-md:
    fontFamily: "Atkinson Hyperlegible Mono"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.5
  # Fancy voice: Fraunces. Ceremony only.
  headline-fancy:
    fontFamily: "Fraunces"
    fontSize: 3rem
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontVariation: "'opsz' 144, 'SOFT' 0, 'WONK' 1"
  body-fancy:
    fontFamily: "Fraunces"
    fontSize: 1.1875rem
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "'opsz' 14, 'SOFT' 50, 'WONK' 0"
  # Fun voice: Shantell Sans. Asides, empty states, eggs, celebration.
  note-fun:
    fontFamily: "Shantell Sans"
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.2
    fontVariation: "'BNCE' 0, 'INFM' 40, 'SPAC' 0"

rounded:
  none: 0px
  sm: 8px
  md: 10px
  lg: 20px
  core: 28px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  target: 44px

motion:
  feedback:
    duration: 100ms
    timingFunction: ease-out
  fade:
    duration: 180ms
    timingFunction: ease
  settle:
    duration: 280ms
    timingFunction: cubic-bezier(.5, 0, .2, 1)
  spread:
    duration: 460ms
    timingFunction: cubic-bezier(.5, -0.15, .2, 1.25)
  gather:
    duration: 380ms
    timingFunction: cubic-bezier(.5, 0, .2, 1)
  ceremony:
    duration: 800ms
    timingFunction: cubic-bezier(.3, 1.3, .4, 1)
  beat:
    duration: 300ms
    timingFunction: linear

components:
  core:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.core}"
    size: 56px
  core-open:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  drop:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: "{spacing.target}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: "{spacing.target}"
  nav-item-current:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: "{spacing.target}"
  tour-step:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    width: 320px
---

# Quicksilver

A personal design language for the apps I build with Claude Code. This file is the
contract an agent reads before it writes any interface. The longer reasoning, the
research and the open ideas live in `@design/README.md`.

"Quicksilver" is a working name. Rename it freely; nothing depends on the word.

## Overview

The interfaces this replaces all look like they came from the same prompt: a neutral
sans, a gradient, three rounded cards, a fade-up on scroll. Quicksilver is the opposite
of a default. It has a point of view about four things.

**One core, and everything comes from it.** Every screen has one core element: a puck,
a wordmark, a search field, a record. Menus, sheets, toasts, tour steps and results do
not appear from nowhere. They *spread* out of the core and *gather* back into it, the
way a bead of mercury splits and rejoins. Nothing teleports. If you cannot say where a
component came from, it does not belong on the screen yet.

**Three voices, each with a job.** A professional face carries every word the app
needs. A fancy face marks ceremony. A fun face is the app talking out of turn. Bold,
italic and underline are separate tools with separate meanings, and switching voice is
a fourth one.

**Material is a choice.** A surface can be solid, paper, glass, metal or ink. Solid is
the baseline and is never a fallback. Glass is one option among five, used on the layer
that floats over content and never on content itself.

**Easy first, then guided, then hidden.** An app must be usable with no instructions.
It also ships a short tour anyone can start at any time, and at least one thing hidden
for the curious. In that order: the tour never excuses a confusing screen, and the
easter egg never sits on the path to getting something done.

The reference implementation of this thinking is the VoteHound Working Copy redesign:
pen marks drawn once in reading order, a menu that opens from one button and gathers
back, and a single verdict moment per screen. See
`@design/references/votehound-working-copy.md`.

### How to use this file

1. Read this file fully before writing any UI. Load `@design/docs/tokens.css` as the
   token source; do not hand-type colour, radius, duration or font values.
2. Before the first component, name three things in one line each: the **core** of this
   screen, the **one ceremony** it is allowed, and the **material** of its floating
   layer.
3. Build the solid, static, reduced-motion version first. Add spread, material and
   ceremony on top of something that already works.
4. Finish with the checks in "Do's and Don'ts". A screen that fails one is not done.

## Colors

Colour is described as writing tools on paper, because that is what the roles do.

- **Ink** (`on-surface`) and **paper** (`surface`) carry the page. **Card**
  (`surface-raised`) is anything that sits on paper.
- **Pen A** (`primary`) and **pen B** (`secondary`) are the two marking colours. Pen A
  is links and the primary action. Pen B is the opposing mark and anything
  destructive. Two pens always differ in lightness as well as hue, so they survive
  colour blindness and greyscale.
- **Highlighter** (`tertiary`) is a fill behind ink text: the current nav item, a
  marked phrase, the active drop. It is never used as text or as a border.
- **Muted** (`neutral`) is secondary text. **Outline** is the hairline between card and
  paper and is decorative. **Edge** is the boundary of any control or any non-solid
  material, and it must reach 3:1 against what it sits on.

Floors, measured for the default cast (script in `@design/docs/accessibility.md`):

| Pair | Light | Dark | Floor |
|---|---|---|---|
| ink on paper / card | 17.1 / 18.7 | 18.4 / 16.3 | 4.5 |
| muted on paper / card | 5.2 / 5.7 | 8.0 / 7.1 | 4.5 |
| pen A on paper / card | 4.7 / 5.2 | 6.2 / 5.5 | 4.5 |
| pen B on paper / card | 5.6 / 6.1 | 7.3 / 6.5 | 4.5 |
| ink on highlighter | 11.7 | 11.7 | 4.5 |
| edge on paper / card | 3.3 / 3.6 | 4.6 / 4.1 | 3.0 |

**Recasting.** Mercury takes the colour of the room. Each app chooses its own ink,
paper, two pens and one highlighter, then re-runs the floors. What an app may not do is
add a third pen, use a gradient as a surface, or let colour be the only thing that
separates two states.

## Typography

Three voices and one utility. The default cast is all OFL, all variable, all
self-hosted. Full rationale, the bench of approved alternates and loading rules are in
`@design/docs/typography.md`.

| Voice | Default cast | Says | Used for |
|---|---|---|---|
| **Professional** | Atkinson Hyperlegible Next | "Here is the thing." | Every label, control, paragraph, table and error. If the other two voices vanished, the app would still work. |
| **Fancy** | Fraunces (`opsz`, `SOFT`, `WONK`) | "This matters." | The screen's one ceremony: a title, a verdict, a total, a pull quote. Long-form reading may use its text cut. |
| **Fun** | Shantell Sans (`BNCE`, `INFM`) | "Between us…" | Margin notes, empty states, tour copy, celebration, easter eggs. Never an instruction the user must follow. |
| Utility | Atkinson Hyperlegible Mono | | Code, identifiers, tabular figures. Not a micro-label style. |

**Emphasis is a grammar, not decoration.** One device per span; two at most.

| Device | Meaning | Markup |
|---|---|---|
| **Bold** | Importance. Read this even if you skim. | `<strong>` |
| *Italic* | Stress, a title, a term in another voice. Short phrases only. | `<em>`, `<cite>`, `<i>` |
| Solid underline | A link. Nothing else is ever solid-underlined. | `<a>` |
| Wavy or dotted underline | "There is more here": a defined term, an abbreviation, a hint. | `<dfn>`, `<abbr>` |
| Highlighter | The phrase the screen is about. | `<mark>` |
| Voice switch | Fancy for ceremony, fun for an aside. | a class on a real element |

Rules that hold everywhere:

- Body text is at least `1.0625rem`, line-height 1.5, measure 55–75 characters. Sizes
  are in `rem`; nothing sets a pixel root size.
- Layout survives the WCAG 1.4.12 overrides (line-height 1.5, paragraph spacing 2×,
  letter-spacing 0.12em, word-spacing 0.16em) and 200% zoom.
- Fancy and fun are budgeted. One fancy moment per screen. Fun text never exceeds one
  short line per card.
- Variable axes may animate (`SOFT`, `WONK`, `BNCE`, `INFM`) on short headings only,
  once, and never under reduced motion.
- Offer a reading-font setting (app default, system, Atkinson) wherever people read for
  more than a minute. The fastest font differs per person.
- Not on the bench: Inter, Geist, Space Grotesk, Roboto, Instrument Serif. Nothing is
  wrong with them except that they are everyone's default.

## Layout

- **Start from the core.** Place the core first, then lay out what spreads from it.
  The core keeps a stable position across screens so the eye and the thumb can find it:
  bottom-centre or bottom-right on phones, top-left of a rail on desktop.
- **Reading order is drawing order.** The order things animate in is the order a
  screen reader meets them and the order the eye should take.
- A 4px base grid. Touch targets are 44px; 24px is the absolute minimum and only with
  spacing around it. A component mid-spread must still be hittable.
- Fluid by default: `max-width` containers, `rem`/`fr`/`%`, container queries for
  components. At phone width menus stack, toolbars wrap, wide tables scroll in a box.
- Density comes from content, not from shrinking type. No uniform grid of identical
  cards: if three things are equally important, question the screen.

## Elevation & Depth

Depth comes from material, not from a universal drop shadow. Details and recipes are in
`@design/docs/materials.md`.

| Material | What it is | Where |
|---|---|---|
| **Solid** | Opaque card with a hairline. The baseline. | Anywhere. Always the fallback for every other material. |
| **Paper** | Solid plus grain or a ruled texture. | Documents, long reading, notes. |
| **Glass** | Translucent, blurred backdrop, with a guaranteed scrim. | The floating layer only: the open core, tour steps, toasts. |
| **Metal** | Mercury itself. A specular gradient that moves a little with the pointer. | The core, progress, one accent object. |
| **Ink** | Solid `on-surface` with inverted text. | The closed core, primary buttons, dark bars. |

- Every non-solid material carries a real `edge` border, so it survives forced-colours
  mode, and a scrim strong enough to hold 4.5:1 for text against the worst backdrop it
  can ever sit on, not the nicest one.
- Glass is for chrome that floats over content. Content is never glass.
- A **material dial** (Solid ↔ Clear) is a user setting from day one.
  `prefers-reduced-transparency` and `prefers-contrast: more` both force Solid.
- Two shadows exist: a 1px ring plus a soft lift for anything spread from the core, and
  nothing for anything resting on paper.

## Shapes

- Radii: 8px controls, 10px cards, 20px for an open core or a sheet, 28px for the
  closed core, full for pills and avatars. `corner-shape: squircle` is an enhancement
  where supported.
- **Shape follows state.** A closed core is a circle; as it spreads, its radius relaxes
  toward 20px while width and height grow. The same element changes shape; a new one
  does not fade in beside it.
- Hand-drawn marks (circle, tick, cross, strike, swipe, arrow) are single SVG strokes
  with round caps, drawn with `stroke-dashoffset`. They annotate; they never replace a
  label.
- Icons are inline stroke SVG in `currentColor`. No emoji as icons.

## Motion

The full model, the implementation ladder and code are in
`@design/docs/core-and-spread.md` and `@design/docs/motion.md`.

**Vocabulary.** The **core** is the one element. A **drop** is anything that came out
of it. A **pool** is where drops have settled into a surface. To **spread** is to leave
the core; to **gather** is to return.

**Laws.**

1. *Origin.* Every drop has a source it visibly leaves and returns to. Nothing
   teleports.
2. *One body.* A spread is the same element changing size, shape and material, not one
   thing fading out while another fades in.
3. *One at a time.* Stage it: the body moves, then its contents arrive, a beat apart.
4. *Interruptible.* Any spread can be reversed mid-flight by the same control, by
   Escape, or by scrolling away.
5. *Once.* Marks draw in once, in reading order. Nothing loops in a product.
6. *Budgeted.* The more often an action happens, the less it moves. Keyboard-driven
   and high-frequency actions do not animate at all.

**Two channels.** *Spatial* motion (position, size, shape) uses springs and may
overshoot: `spread` 460ms, `gather` 380ms, `settle` 280ms. *Effects* (colour, opacity)
never bounce: `fade` 180ms, `feedback` 100ms. `ceremony` (800ms) is reserved for the
screen's one fancy moment. A `beat` is 300ms.

**Reduced motion means reduce, not remove.** Spatial motion becomes a 150ms cross-fade;
marks are simply already drawn; axis animation and metal specular are off. No blanket
`animation-duration: 0.01ms` reset.

## Voice & Content Strategy

- **Professional voice says it plainly.** Labels are verbs or nouns the user would say.
  Errors state what happened and what to do next, in the professional voice, with no
  joke.
- **Fun voice is an aside**, never an instruction. If removing the line would lose
  information, it was in the wrong voice.
- **No filler.** No invented statistics, no lorem ipsum, no eyebrow label above a
  heading that repeats the heading.
- **Every app introduces itself.** Rules, the step contract and the manifest format are
  in `@design/docs/guided-tours.md`:
  - Empty states and inline hints do the real teaching.
  - A permanent "Take the tour" entry lives in the core. First run shows one
    dismissible offer and never auto-starts.
  - Three to five steps, one idea each, preferably advancing when the user does the
    thing. More than five becomes separate per-feature tours.
  - A tour step is a drop: it spreads from the core, travels to its target, and gathers
    back when dismissed.
- **Every app hides something.** At least one easter egg per app, logged in the
  project's `EGGS.md`. The contract is in `@design/docs/easter-eggs.md`: earned or
  opt-in, free to ignore, never on the critical path, never in an error, payment,
  security or data-loss moment, safe under reduced motion, silent by default, and
  switchable off.

## Components

Each component is defined by where it comes from. Anatomy, states and accessibility
notes are in `@design/docs/components.md`.

| Component | Comes from | Notes |
|---|---|---|
| **Core** | Itself | One per screen. A real `<button>` with `aria-expanded`. 56px closed. Ink when closed; solid or glass when open. |
| **Core menu** | Core | The core grows into the menu as liquid (56px → 292px wide, radius 28 → 20); items then fade in quickly, in reading order. The puck stays an ink disc on top and becomes the Close control. Closes on Escape, outside press, or scroll. |
| **Rail** | Core | Desktop form of the same menu: 56px ↔ 248px wide. Labels slide in a beat after the width settles. |
| **Drop** | Core or another drop | A card, popover or chip. States its origin with `data-origin`. |
| **Pool / sheet** | Core or a drop | Several drops merged into one surface: a dialog, drawer, detail view. A real `<dialog>`. |
| **Bead** | Core | A toast or status. Leaves the core, rests, rejoins it. Polite live region. |
| **Mark** | Ink | Circle, tick, cross, strike-and-insert, swipe, margin note. One of each kind per card at most. |
| **Ceremony** | The screen's headline value | Fancy voice plus one mark. Once per screen. |
| **Tour step** | Core | A drop with a title, one sentence, "Step n of m", Back, Next, Close. `role="dialog"`. Never covers its target. The rest of the page fades back and a pen loop is drawn round the target. |
| **Buttons, fields, tables** | Rest on paper | Professional voice, solid material, `edge` borders, visible focus ring. They do not spread. A button may take a follow-up: it pulls in to an icon for what it just did, the icon moves once, and the button returns (with the opposite label if the action toggles). |

Build on headless primitives (Base UI, or React Aria Components where accessibility and
internationalisation dominate) or on native elements (`<dialog>`, Popover API, anchor
positioning) and style them from the tokens. Styled kits and animated component
collections are scaffolding at most; nothing ships with its stock look. See
`@design/references/component-libraries-research.md`.

## Do's and Don'ts

**Do**

- Name the core, the one ceremony and the floating material before writing a screen.
- Give every appearing element an origin, and make its exit the reverse of its entrance.
- Build solid, static and keyboard-complete first.
- Use the three voices for their jobs, and the emphasis table as written.
- Ship a launcher for the tour, an `EGGS.md` entry, and a Playfulness and Material
  setting with each app.
- Check both schemes, 200% zoom, reduced motion, reduced transparency, forced colours
  and keyboard-only before calling a screen done.

**Don't**

- Don't fade-and-slide-up content on scroll, or put a hover lift on every card.
- Don't use a gradient wash, a glow border, or a left-accent-border card.
- Don't ship the first-generation defaults (neutral sans, purple gradient, hero plus
  three cards) or the second-generation ones (cream, serif, terracotta; tracked
  all-caps eyebrows; `01 / 02 / 03` markers; mono micro-labels; arrows after links).
- Don't put text on glass without a scrim, or make content itself translucent.
- Don't loop anything, animate a keyboard action, or let motion carry the only copy of
  a piece of information.
- Don't underline anything that is not a link, set long passages in italic, or use the
  fun voice for something the user must act on.
- Don't auto-start a tour, cover the thing a step points at, or use a tour to explain a
  screen that should have been simpler.
- Don't hide a feature behind an easter egg, or joke in an error.
