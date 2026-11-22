# Motion

What the evidence supports, briefly (details in
`../references/motion-materials-research.md`): animation reliably helps people keep
track of *what became what* (continuity, object constancy). It does not reliably help
them understand more. So Quicksilver animates to show origin and change, and never to
decorate arrival.

## Two channels

| Channel | Properties | Character | Tokens |
|---|---|---|---|
| **Spatial** | position, size, shape | Springs. May overshoot. | `settle` 280ms, `gather` 380ms, `spread` 460ms, `ceremony` 800ms |
| **Effects** | colour, opacity, material | Never bounces. | `feedback` 100ms, `fade` 180ms |

A **beat** is 300ms: the gap between staged events.

The spatial curves ship twice in `tokens.css`: as `cubic-bezier()` (the exact curves on
the VoteHound boards) and, where `linear()` is supported, as sampled damped springs
(`spread` overshoots 8%, `ceremony` 16%). Both are fixed-duration. For gestures that
need velocity (drag-to-dismiss), use a real spring from Motion or the Web Animations
API and match the feel.

Durations sit inside the 100–500ms range NN/g recommends for UI; `ceremony` is the one
deliberate exception and is allowed once per screen.

## Liquid character

Liquid is how spatial motion looks by default, not a special effect reserved for the
core. Five moves cover almost everything, and none of them needs a filter:

| Move | What happens | Used by |
|---|---|---|
| **Bead** | A thing travels as a small round bead and widens when it lands; it pulls back in to a bead to leave. | Toasts, button follow-ups, tour steps |
| **Stretch** | It elongates in the direction of travel and recovers on arrival. | A falling toast, a rising bead |
| **Squash** | It flattens under pressure and springs back past its rest size. | Button press, the puck when touched |
| **Reach, then let go** | A sliding part grows to span both positions, then releases the old one. | Switch thumb, selected-option indicator, progress head |
| **Soft in flight** | Corners go organic and uneven while a body is changing size, and firm up at rest. | Card to dialog, the puck wobble |

A goo filter (blur plus alpha threshold) adds the visible neck between two bodies. Use
it only on a decorative layer that holds no text and no focus ring: a progress fill and
its head, a paw's toes, the ceremony word while it forms, the liquid-layer demo.

Volume does not have to be realistic. A bead may become a panel.

The frequency budget below still applies. Liquid changes how a thing moves, not how
often it is allowed to.

## The frequency budget

| How often the user triggers it | Motion allowed |
|---|---|
| Many times a minute (typing, keyboard shortcuts, list navigation, tab switching) | None. State changes instantly. |
| Many times a session (open menu, toggle, select) | `feedback` and `fade`; a spread only for the core. |
| A few times a session (open a record, complete a task) | `spread` / `gather`, staged. |
| Once (first run, a result, a milestone) | `ceremony`. |

Rarer things earn more motion. This is the rule that keeps an expressive interface from
becoming a tiring one.

## Staging

1. The body moves (spatial).
2. One beat or less later, contents arrive, nearest the origin first, 25–40ms apart.
3. Marks draw last, in reading order, a beat apart.
4. Exits run the same sequence backwards and about 20% faster.

One staged sequence at a time. Starting a second one finishes or reverses the first.

## Marks

Hand-drawn marks (circle, tick, cross, strike, swipe, arrow) are single SVG paths drawn
with `stroke-dasharray` / `stroke-dashoffset`:

- tick or cross: 450ms ease-out
- circle around a figure: 600ms ease-out
- highlighter swipe: 450ms ease-out, `scaleX` from the left
- strike: 350ms ease-out

They draw once. `vector-effect: non-scaling-stroke` keeps stroke width honest when the
SVG is stretched over text.

## Reduced motion

`prefers-reduced-motion: reduce` means reduce, not remove.

| Normal | Reduced |
|---|---|
| Spread, gather, morph | 150ms cross-fade between the two states |
| Staggered arrival | Everything arrives together |
| Marks draw in | Marks are already drawn |
| Axis animation on type | Final values |
| Pointer-tracked specular, parallax, liquid layer | Off |
| Colour and opacity feedback | Unchanged |

`tokens.css` does this by collapsing the spatial durations and curves. Do not add a
global `* { animation-duration: 0.01ms }` reset; it breaks fades that reduced-motion
users still benefit from. Also provide the switch in-app (the Playfulness setting
covers decorative motion; see `easter-eggs.md`).

## Looking at motion

Every curve on the kit page plays on its own and at three speeds: normal, half and
slow (a quarter). Judge a curve at slow, where overshoot and settle are visible, then
confirm it at normal, where it has to feel right.

## Hard limits

- Nothing flashes more than three times a second.
- Nothing moves for more than five seconds without a way to stop it.
- Motion never carries the only copy of information: a result that animates in is also
  announced and remains on screen.
- Input is never blocked for the duration of an animation.
- `transition: all` is banned. Name the properties.
