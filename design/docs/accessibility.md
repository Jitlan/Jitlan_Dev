# Accessibility

Expressive and accessible are not in tension here because of one build rule: **the
solid, static, keyboard-complete version is built first, and everything expressive is
an enhancement of it.** The mercury, the glass and the ceremony are layers on something
that already works without them.

The target is WCAG 2.2 AA, plus 2.3.3 (Animation from Interactions, AAA), which this
language can meet cheaply because reduced motion is designed in. APCA is used as a
second opinion on contrast, not as the conformance measure; WCAG 3 is still a draft.

## Definition of done

A screen is done when all of these pass.

**Structure**
- [ ] Real elements: `<button>`, `<a href>`, `<input>` with `<label>`, `<dialog>`,
      landmarks. No click handlers on `<div>` or `<span>`.
- [ ] One `<h1>`; headings in order; the core is early in the DOM.
- [ ] Reading order, focus order and animation order agree.

**Keyboard**
- [ ] Everything is operable by keyboard, including the core menu, tour and eggs.
- [ ] Visible focus: 3px ring, 2px offset, 3:1 against its surroundings.
- [ ] Focus is never fully hidden behind a floating element (2.4.11).
- [ ] Escape closes the topmost spread and returns focus to its origin.
- [ ] No keyboard trap. Closed drops are `inert`.

**Perception**
- [ ] Text 4.5:1 (3:1 at 24px or 18.66px bold and up); control boundaries and
      meaningful graphics 3:1; in both schemes.
- [ ] Text on glass passes over white, black and a busy image.
- [ ] Nothing is conveyed by colour alone. The two pens differ in lightness; states
      also change a label, icon or mark.
- [ ] Links are underlined. Nothing else is solid-underlined.
- [ ] 200% zoom, 320px width and the 1.4.12 text-spacing overrides lose nothing.

**Motion and material**
- [ ] Reduced motion: spreads cross-fade, marks are drawn, nothing travels.
- [ ] Nothing loops; nothing flashes above 3 Hz; nothing auto-moves beyond 5 seconds.
- [ ] Reduced transparency and increased contrast both give Solid.
- [ ] Forced colours: every surface still has a visible border; icons use
      `currentColor`.
- [ ] Input is never blocked during an animation.

**Targets and timing**
- [ ] Targets are 44px; never under 24px; still hittable mid-spread.
- [ ] Toasts persist at least 5 seconds, pause on hover and focus, and are not the only
      record.

**Announcements**
- [ ] Results, beads and tour steps use polite live regions.
- [ ] Decorative marks, the liquid layer and metal highlights are `aria-hidden`.
- [ ] A ceremony's text exists in the DOM from the start.

## Preference matrix

| Preference | What changes |
|---|---|
| `prefers-color-scheme` | Light and dark casts via `light-dark()`; overridable with `data-theme` |
| `prefers-reduced-motion` | Spatial channel collapses to 150ms fades; marks pre-drawn; liquid layer and specular off |
| `prefers-reduced-transparency` | Material forced to Solid (Chromium only today, hence the in-app dial) |
| `prefers-contrast: more` | Material Solid; outline becomes edge; muted becomes ink |
| `forced-colors: active` | System colours; borders on every surface; no reliance on fills or shadows |
| In-app **Material** | Solid ↔ Clear |
| In-app **Playfulness** | Eggs and fun-voice animation off |
| In-app **Reading font** | App default, system, Atkinson |

Every OS preference that matters also has an in-app control, because not everyone
knows the OS setting exists and support is uneven.

## Contrast script

Re-run after recasting colours. It is the script the table in `/DESIGN.md` came from.

```python
def lum(h):
    h = h.lstrip('#'); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)

def contrast(a, b):
    hi, lo = sorted([lum(a), lum(b)], reverse=True)
    return (hi + .05) / (lo + .05)

cast = dict(ink='#0B1220', paper='#F1F5F9', card='#FFFFFF', muted='#5E6773',
            edge='#7C8798', pen_a='#2563EB', pen_b='#C70011', highlighter='#E8C97A')
for role in ('ink', 'muted', 'pen_a', 'pen_b'):
    assert contrast(cast[role], cast['paper']) >= 4.5, role
    assert contrast(cast[role], cast['card']) >= 4.5, role
assert contrast(cast['edge'], cast['paper']) >= 3
assert contrast(cast['ink'], cast['highlighter']) >= 4.5
```

## Testing

- Automated: axe (or equivalent) in the end-to-end suite, run in both schemes and with
  `reducedMotion: 'reduce'` and `forcedColors: 'active'` emulated in Playwright.
- Manual, per release: keyboard-only pass; one screen reader pass (VoiceOver or NVDA);
  200% zoom; the tour end to end with a keyboard.
- Automated checks find a minority of real problems. They are a floor.
