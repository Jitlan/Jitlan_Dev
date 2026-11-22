# VoteHound Working Copy: the precedent

Quicksilver generalises what was worked out on the VoteHound redesign canvas
("VoteHound Working Copy": phone and desktop screens in light and dark, plus a kit
board). This file records what was taken from it. Values were read from the canvas
source on 22 November 2026, not from the live site.

The canvas is a private design artifact; it is not linked from here.

## The idea

A bill is a working copy: printed text that people mark up. So the interface is ink on
paper, and everything expressive is a pen mark: a highlight, a strike and insert, a
circle round a count, a note in the margin, a tick or a cross.

The kit board states its own rules, and they became Quicksilver's:

- "Marks draw in once, in reading order, a beat apart."
- "Nothing loops in the product. The loops on these boards are only there so you can
  watch them."
- "With reduced motion on, every mark is simply already drawn."
- The menu "opens from one button. Gathers back on close or after scrolling."
- The verdict happens "once per screen, for the headline result."
- Budgets on every mark: a title swipe is "one per screen"; a margin note is "one per
  card at most"; a circle is for "standalone figures only … never inside prose."

## What Quicksilver inherits

| Working Copy | Became |
|---|---|
| The menu that opens from one 56px button and gathers back | The **core**, spread and gather, and the whole mercury model |
| Four typefaces with stated jobs | The **three voices** plus a utility face |
| Pen marks with per-screen limits | **Marks**, and the idea of budgets generally |
| The verdict moment | The **ceremony**: one per screen |
| "Already drawn" under reduced motion | Reduce, don't remove |
| Blue pen, red pen, highlighter | Colour roles named as writing tools: pen A, pen B, highlighter |
| Highlighter yellow on the current nav item | Highlighter as a fill behind ink, never as text |

## Colour (the default cast)

| Role | Light | Dark |
|---|---|---|
| Ink | `#0B1220` | `#F1F5F9` |
| Paper | `#F1F5F9` | `#020617` |
| Card | `#FFFFFF` | `#0F172A` |
| Muted | `#5E6773` | `#9AA4B2` |
| Hairline | `#E2E8F0` | `#334155` |
| Blue pen | `#2563EB` | `#4D8DF7` |
| Red pen | `#C70011` | `#F87171` |
| Highlighter | `#E8C97A` | `#E8C97A` |
| Blue highlight | `#C9DBFC` | `#1E3A8A` |
| Red highlight | `#F8CDD1` | `#7F1D1D` |
| Success | `#00712E` | `#10B981` |
| Warning | `#A55800` | `#FBBF24` |
| Brass | `#8A6420` | — |

Dark values are as used on the dark desktop boards (the kit board itself is light
only). The two dark highlight colours are the stroke colours of the highlight swipes
there.

Added by Quicksilver, not on the canvas: an **edge** colour (`#7C8798` light,
`#6B7A90` dark). The canvas hairline is 1.1:1 against paper, which is right for a
decorative divider and too faint to be the only boundary of a control.

## Type

| Face | Job on the canvas | Quicksilver voice |
|---|---|---|
| Bricolage Grotesque 700–800, tracking −0.02em | Headlines, verdicts, figures | Professional, loud (on the bench) |
| Newsreader 400/600 | Bill text and documents | Fancy, text cut (on the bench) |
| Caveat 600–700, rotated −3° | Pen marks and notes | Fun (on the bench) |
| Geist 400–600 | Interface | Professional. **Not on the bench**; see below |
| Permanent Marker | Loaded by every board, used by none | Dropped |

Sizes in use: interface 12–15px, card titles 15px semibold, pen notes 22–23px,
figures 24px, screen titles 30–34px, verdict up to 68px.

Geist is the one place the canvas and Quicksilver disagree: it reads as the stock
shadcn/Vercel face. Whether VoteHound recasts its interface voice is an open question
(`../ideas/open-questions.md`).

## Shape

Radius 8px for controls and nav items, 10px for cards, 20px for the open menu and the
rail, 28px for the closed menu button, full for pills and avatars. One shadow:
`0 0 0 1px` hairline plus `0 6px 16px rgba(11,18,32,.12)` (dark:
`0 6px 18px rgba(0,0,0,.5)`), used only on the floating menu.

## Motion, as measured

| Thing | Value |
|---|---|
| Menu body (phone) | 56×56 → 292×364px; width and height `460ms cubic-bezier(.5,-0.15,.2,1.25)`; radius 28 → 20px `460ms ease` |
| Menu items | From the button's centre at `scale(0.3)`; `transform 380ms cubic-bezier(.5,0,.2,1)`, `opacity 240ms ease`; open delay `100ms + 40ms × rows from the button`; close delay `35ms × row` |
| Menu auto-close | When the screen scrolls more than 48px |
| Rail (desktop) | 56 ↔ 248px wide, same curve; labels `opacity 220ms`, `translateX(-12px → 0) 300ms`, delay `80ms + 25ms × index` |
| Kit variant of the body curve | `480ms cubic-bezier(.5,-0.2,.2,1.3)` |
| Follow button | Background and colour `250ms ease`; tick draws `450ms ease-out` |
| Verdict letters | Gather from scattered positions: `transform 800ms cubic-bezier(.3,1.3,.4,1)`, `opacity 500ms`, 50ms apart |
| Verdict sequence | Strike at 200ms (350ms), highlighter swipe at 900ms (450ms), circle at 1400ms (600ms), margin note at 1900ms (300ms fade) |
| Marks on boards | `stroke-dashoffset` draw, staggered 0.3 / 0.6 / 0.9s |
| Reduced motion | Marks not animated; transitions off; verdict shown in its final state |

Quicksilver softens one thing: the boards switch every transition off under reduced
motion, where the language keeps a 150ms cross-fade.

## Accessibility already present

Real `<button>` and `<nav>` elements with `aria-expanded`, `aria-pressed` and labels
that change with state; decorative SVG marked `aria-hidden`; the five-step status line
exposed as `role="img"` with "Step 1 of 5"; 44px targets; yea and nay carried by a
word as well as a colour and a mark.
