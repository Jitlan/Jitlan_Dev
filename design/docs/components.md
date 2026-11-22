# Components

Each component is defined by three things: where it comes from, what it is made of, and
what it says. If a new component cannot answer all three it is not ready.

Build on native elements first (`<button>`, `<dialog>`, Popover API, anchor
positioning), then on headless primitives (Base UI; React Aria Components where
accessibility and internationalisation dominate). Style from `tokens.css`. Nothing
ships with a library's stock look.

## Core

- **Is:** the one element the screen belongs to. A real `<button>` inside a `<nav>` or
  `<search>` landmark.
- **Made of:** ink when closed, solid or glass when open. 56px, radius 28px.
- **States:** closed, open, busy (a metal bead circulates its edge), has-news (a bead
  sits on it).
- **A11y:** `aria-expanded`, `aria-controls`; an accessible name that changes with
  state ("Open menu" / "Close menu"); early in the DOM order; one documented shortcut.
  Never fully covers a focused element (WCAG 2.4.11).
- **Holds:** navigation, the "Take the tour" launcher, and Settings (Theme, Material,
  Playfulness, Reading font).

## Core menu and rail

- **Comes from:** the core. The core *is* the menu, grown.
- **Phone:** 56px puck → 292×364px, two columns of 44px items. The current item sits on
  highlighter.
- **Desktop:** a rail, 56px ↔ 248px, icons always visible, labels arriving after the
  width settles.
- **Closes on:** the toggle, Escape, outside press, scroll past 48px, choosing an item.
- **A11y:** items are `inert` while closed; focus moves to the first item on open and
  back to the toggle on close; `aria-current="page"` on the current item.

## Drop

- **Is:** a card, popover or chip that came out of the core or another drop.
- **Made of:** solid; glass only if it floats over content.
- **Rule:** carries `data-origin`. Enters from its origin's position and scale; exits
  back to it.
- Cards resting in a list are not drops. They are content on paper and do not animate
  on scroll.

## Pool (dialog, drawer, sheet)

- **Comes from:** the drop or control that opened it.
- **Is:** a real `<dialog>` (`showModal()` for modal, `popover` for non-modal).
- **Made of:** solid, radius 20px. Glass is allowed for a non-modal sheet only.
- **A11y:** labelled by its heading; Escape closes; focus returns to the opener; the
  page behind is inert for modal pools.

## Bead (toast, status, progress)

- **Comes from:** the core. It leaves, rests near it, and rejoins it.
- **Made of:** ink or metal.
- **A11y:** `role="status"` (polite). Never the only record of an outcome: whatever it
  says is also visible in the page. Stays until dismissed if it has an action; otherwise
  at least five seconds, pausable on hover and focus.

## Mark

Pen marks on top of content. Decorative SVG is `aria-hidden`; the meaning is always in
text as well.

| Mark | Use | Limit |
|---|---|---|
| Highlight | A phrase inside running text | Pen-A or pen-B wash for sides, highlighter otherwise |
| Strike and insert | A value that changed; the old one stays readable | Use `<del>` and `<ins>` |
| Circle | A standalone figure: a count, a stat, a date | Never inside prose |
| Margin note | Context beside a value, fun voice, rotated −3° | One per card |
| Tick / cross | A yes or no outcome | Pen A tick, pen B cross, plus the word |
| Title swipe | Behind the screen title | One per screen |

## Ceremony

- **Is:** the screen's single fancy moment: the headline value in the fancy voice, plus
  one mark, on the `ceremony` curve. On the VoteHound boards it is the verdict: the
  letters gather, the highlighter swipes, the count is circled, a note is written.
- **Limit:** once per screen, once per visit. On return it is simply set.
- **A11y:** the text is real text, present from the start for assistive technology;
  the animation is visual only.

## Tour step

See `guided-tours.md`. In short: a drop from the core, `role="dialog"`, title, one
sentence, "Step n of m", Back, Next, Close; never covers its target.

## Resting controls

Buttons, fields, selects, tables, tabs. Professional voice, solid material, `--qs-edge`
borders, 44px targets, a 3px focus ring offset 2px.

- **Primary button:** ink fill. One per view.
- **Secondary button:** card fill, edge border.
- **Destructive:** pen B text or fill, and a confirmation that states what will be
  lost. No fun voice.
- **Toggle with a result** (Follow → Following): the label changes, and a tick draws
  in 450ms. `aria-pressed` carries the state.
- **Field:** a visible `<label>`; hint text below in muted; errors in the professional
  voice below the field, linked with `aria-describedby`.
- **Table:** scrolls inside its own box at narrow widths; numbers in mono with
  tabular figures.

## Empty state

The most important teaching surface in the app. One line in the professional voice
saying what goes here, one primary action that creates the first thing, and optionally
one fun-voice aside. An empty state replaces a tour step wherever it can.
