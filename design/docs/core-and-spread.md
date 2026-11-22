# Core and spread: the mercury model

Spill mercury and it does two things other liquids don't: it holds itself together in
beads, and beads that touch become one. That is the whole interaction model. A screen
has one body of interface. Parts of it leave to do a job and come back when the job is
done.

It is also a discipline against a specific failure. Generated interfaces accumulate:
a modal here, a toast there, a floating button, each arriving from nowhere with its own
fade. Asking "where does this come from?" of every element removes most of them.

## Vocabulary

| Term | Meaning | Typical element |
|---|---|---|
| **Core** | The one element everything else belongs to. | A puck, a wordmark, a search field, the record being viewed. |
| **Drop** | Anything that came out of the core or out of another drop. | Menu item, popover, card, chip, tour step. |
| **Pool** | Drops settled into one surface. | Dialog, drawer, sheet, detail view. |
| **Bead** | A small drop that leaves, rests, and returns on its own. | Toast, status, badge, progress. |
| **Spread** | To leave the core. | Open, expand, reveal. |
| **Gather** | To return to the core. | Close, collapse, dismiss, complete. |
| **Merge / split** | Two bodies becoming one, or one becoming two. | Selecting several items into one action bar; a card opening into a detail view. |

## Choosing the core

One per screen, and the same one across screens wherever possible.

- A tool with navigation: the **puck** (menu button). Bottom-centre or bottom-right on
  phones; the top of a rail on desktop.
- A search-led app: the **search field**. Results spread from it.
- A single-record view: the **record's title**. Actions spread from it.
- A game or toy: the **start control**. (The portfolio's ENGINE START button is a core.)

If two elements both seem to be the core, the screen is two screens.

## The laws

1. **Origin.** Every drop has a source it visibly leaves and visibly returns to.
   Record it: `data-origin="core"` or the id of the parent drop. No origin, no
   component.
2. **One body.** A spread is the *same element* changing size, shape and material. Not
   one element fading out while a different one fades in next to it.
3. **Liquid, not literal.** Things do not appear at full size: a drop starts at the
   position of its origin, usually as a bead, and when it is dismissed it goes back
   where it came from, not off the nearest edge. But volume is not conserved. A 44px
   bead may widen into a 300px toast or grow into a whole panel. The liquid is a look,
   not a physics simulation.
4. **One at a time.** Stage it. The body moves first; its contents arrive a beat
   later, nearest the origin first. One spread at a time per screen.
5. **Interruptible.** A spread can be reversed mid-flight: by the control that started
   it, by Escape, by pressing outside, by scrolling away. Never lock input for the
   length of an animation.
6. **Once.** Marks draw once, in reading order. Nothing loops in a product. (Design
   boards may loop so you can watch; products may not.)
7. **Budgeted.** The more often something happens, the less it moves. See
   `motion.md`.
8. **The core is always reachable.** By pointer, by Tab order (it is early in the
   DOM), and by one documented key. A spread never covers the core without the core
   being the thing that grew.

## The reference spread

Measured from the VoteHound Working Copy menu, which is the pattern to copy. One rule
added on the kit page: the toggle is the top layer of the core, and when open its cross
sits on an ink disc.

```
closed:  56 × 56px, radius 28px, ink, shows a menu icon
open:    292 × 364px, radius 20px, card + lift shadow, shows a close icon
body:    width, height 460ms cubic-bezier(.5,-0.15,.2,1.25); border-radius 460ms ease
items:   start at the core's centre, scale(0.3), opacity 0
         transform 380ms cubic-bezier(.5,0,.2,1), opacity 240ms ease
         stagger: nearest row first, +40ms per row, after a 100ms head start
close:   items leave first (+35ms per row, farthest first), then the body gathers
also:    closes when the page scrolls more than 48px
```

Desktop rail, same core: 56px ↔ 248px wide on the same curve; labels fade and slide
12px, staggered 25ms, after an 80ms head start.

## The implementation ladder

Build from the bottom rung. Each rung is an enhancement of the one below, gated with
`@supports` or a feature check, so the bottom rung is what ships when nothing else is
available.

| Rung | Technique | Support (Nov 2026) | Use for |
|---|---|---|---|
| 0 | State change with a 150ms cross-fade | Everywhere | The reduced-motion experience, and the base everything else enhances. |
| 1 | CSS transitions on one element (size, radius, transform) with the spread curve; `@starting-style` and `transition-behavior: allow-discrete` for entry from `display: none` | Baseline | The core menu and rail. This is what the VoteHound boards do. |
| 2 | Same-document View Transitions with `view-transition-name: match-element` | Chromium 137, Safari 18.4, Firefox 144 | Drop → pool morphs across a state change or a route. |
| 3 | Element-scoped `element.startViewTransition()` | Chromium 147 only | Several independent spreads at once. Enhancement only. |
| 3′ | Motion layout animation (`layout`, `layoutId`) or GSAP Flip | Any, with a dependency | The same morphs where rung 2 is not enough. |
| 4 | A decorative liquid layer: SVG goo filter or an SDF canvas | Works; slow on Safari, inconsistent in Firefox | The visible "mercury" joining two bodies. Decoration only. |

Rules for rung 4, because it is the one that breaks things:

- The goo filter blurs and thresholds whatever is inside it, which destroys text and
  focus rings. The liquid layer is a separate, `aria-hidden`, pointer-events-none
  element *behind* the real controls. Real controls are never filtered.
- A canvas is invisible to assistive technology. Everything it draws is mirrored by
  real DOM that works without it.
- It is off under reduced motion and under `data-material="solid"`.
- Budget: one liquid layer per screen, and not on a scrolling surface.

## Minimal rung-1 skeleton

```html
<nav class="qs-core" data-open="false" aria-label="Sections">
  <button class="qs-core__toggle" aria-expanded="false" aria-controls="core-menu">
    <span class="visually-hidden">Open menu</span>
  </button>
  <ul id="core-menu" class="qs-core__items" inert>…</ul>
</nav>
```

```css
.qs-core {
  inline-size: var(--qs-core-size);
  block-size: var(--qs-core-size);
  border-radius: var(--qs-radius-core);
  overflow: clip;
  transition:
    inline-size var(--qs-dur-spread) var(--qs-ease-spread),
    block-size var(--qs-dur-spread) var(--qs-ease-spread),
    border-radius var(--qs-dur-spread) var(--qs-ease-effect);
}
.qs-core[data-open="true"] {
  inline-size: 292px;
  block-size: 364px;
  border-radius: var(--qs-radius-pool);
}
.qs-core__items > * {
  opacity: 0;
  transform: translate(var(--from-x), var(--from-y)) scale(0.3);
  transition:
    transform var(--qs-dur-gather) var(--qs-ease-gather) var(--delay, 0ms),
    opacity var(--qs-dur-fade) var(--qs-ease-effect) var(--delay, 0ms);
}
.qs-core[data-open="true"] .qs-core__items > * { opacity: 1; transform: none; }
```

The script toggles `data-open`, `aria-expanded` and `inert` together, closes on Escape
and outside press, and returns focus to the toggle. Animating `inline-size` costs
layout; that is acceptable for one small element and not for a list.

## What does not spread

Buttons, fields, tables and body text rest on paper. They respond (a 100ms feedback
change) but they do not travel. If everything moves, the core stops meaning anything.
