# Materials

Apple's Liquid Glass is the best-known attempt at a material-led interface, and its
first year is the best available lesson in how one goes wrong. It shipped in iOS 26 as
the single material; reviewers and Nielsen Norman Group reported legibility problems
where content scrolled under translucent chrome; Apple added a Clear/Tinted toggle in
26.1 and a continuous opacity slider in iOS 27. Sources:
`../references/motion-materials-research.md`.

Quicksilver takes the idea (a surface has a physical character) and the lessons:

1. Material is a variable. Give the user the dial on day one.
2. Opaque is a first-class material, not a fallback.
3. Guarantee contrast against the worst backdrop a surface can meet.
4. Glass is for the layer that floats over content. Never for content.
5. Honour the OS transparency and contrast preferences automatically.

## The five materials

| Material | Recipe | Use | Avoid |
|---|---|---|---|
| **Solid** | `--qs-card` fill, 1px `--qs-outline` at rest or `--qs-edge` when floating | Everything, by default | — |
| **Paper** | Solid plus a faint grain or ruling (a tiny tiled SVG at ≤4% opacity) | Documents, notes, long reading | Behind small text if the texture is visible at 1× |
| **Glass** | Card colour at ≥78% opacity (`--qs-glass-scrim`), `backdrop-filter: blur(18px) saturate(1.4)`, 1px `--qs-edge` | The open core, tour steps, toasts, a floating toolbar | Content cards, tables, anything scrolled *as* content |
| **Metal** | A two-stop silver gradient with a radial specular highlight whose position follows the pointer by a few percent | The core, a progress bead, one accent object per screen | Large areas; text smaller than label size |
| **Ink** | `--qs-ink` fill, card-coloured text | The closed core, primary buttons, a dark bar | Large reading surfaces in light scheme |

Classes for all five are in `tokens.css`.

## Rules

- **Scrim.** Text on glass must reach 4.5:1 against the scrim colour composited over
  the *worst* backdrop: test over pure white, pure black, and a busy image. At 78%
  card opacity, ink text clears 4.5:1 over any backdrop in both schemes (10.9:1 light over black, 8.1:1 dark over
  white). Muted text does not (about 3.4:1 in the same worst cases), so text on glass
  is ink, never muted. Lower the scrim and you must re-measure.
- **Edge.** Every material other than resting solid has a real border in `--qs-edge`
  (3:1). In forced-colours mode backgrounds, shadows and blur are discarded; the
  border is what remains.
- **Dial.** A Material setting with two stops at minimum, Solid and Clear, stored per
  user and applied as `data-material` on `<html>`. A slider is better.
  `prefers-reduced-transparency: reduce` and `prefers-contrast: more` force Solid.
  `prefers-reduced-transparency` is reliably Chromium-only today, which is why the
  in-app dial is required and not optional.
- **One non-solid material per screen**, plus ink. Glass *and* metal *and* paper on one
  screen is a material sampler, not a design.
- **Cost.** `backdrop-filter` with a large radius over scrolling content is expensive.
  Do not nest glass in glass, do not animate the blur radius, and do not put glass on
  an element that changes size every frame; switch material at the end of a spread.

## Enhancements, gated

| Enhancement | Support | Fallback |
|---|---|---|
| Refraction (`backdrop-filter: url(#displace)` with `feDisplacementMap`) | Chromium only, out of spec | Plain blur |
| `corner-shape: squircle` | Chromium 139+ | `border-radius` |
| Pointer-tracked specular on metal | Everywhere, script | Static highlight; static under reduced motion |

## Material changes during a spread

A body may change material as it changes shape: the closed core is **ink**, and as it
spreads it becomes **solid** or **glass**. Cross-fade the fill on the effects channel
(180ms) while size moves on the spatial channel. Apply `backdrop-filter` only once the
size has settled.
