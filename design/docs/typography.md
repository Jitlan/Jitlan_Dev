# Typography: three voices

Most design systems pick fonts by category (display, body, mono). Quicksilver picks
them by *who is speaking*. That is the difference between "we used three fonts" and
"the interface has a voice, and it changes register on purpose."

Evidence and font metadata: `../references/typography-research.md`.

## The voices

### Professional — "Here is the thing."

**Default cast: Atkinson Hyperlegible Next** (OFL; `wght` 200–800, italics) with
**Atkinson Hyperlegible Mono** for code and figures.

It carries every label, control, paragraph, table and error. The test: delete the other
two voices and the app must still be completely usable.

Why this face: it was designed by the Braille Institute for letterform distinction
(`I l 1`, `O 0`), it has a real italic and a mono companion, and it is not anyone's
default. Honest caveat: there is no independent controlled study showing it beats Arial
or Verdana. It is well-reasoned, not proven.

### Fancy — "This matters."

**Default cast: Fraunces** (OFL; `opsz` 9–144, `wght` 100–900, `SOFT` 0–100, `WONK`
0–1, italics).

It marks ceremony: a screen title, a verdict, a total, a pull quote. One fancy moment
per screen. Its text cut (`opsz` 14, `SOFT` 50, `WONK` 0) may set long-form reading.

Use its extremes. Fraunces at a polite middle setting is turning into a default of its
own; at `opsz` 144 with `WONK` on, or fully `SOFT`, it is unmistakable. The axes also
animate, which is the point: a verdict can sharpen from `SOFT` 100 to 0 as it lands.

### Fun — "Between us…"

**Default cast: Shantell Sans** (OFL; `wght` 300–800, `BNCE` −100–100, `INFM` 0–100,
`SPAC` 0–100, italics).

It is the app talking out of turn: margin notes, empty states, tour copy, celebration,
easter eggs. It never carries an instruction the user must follow. `BNCE` and `INFM`
exist to be animated; a word can bounce once when it arrives.

## The bench

An app may recast a voice from the bench. It may not cast from outside it without
adding the font here first, with its licence and axes checked.

| Voice | Bench | When to reach for it |
|---|---|---|
| Professional | Instrument Sans, Figtree, Hanken Grotesk, Public Sans | More character, or a width axis (Instrument Sans). |
| Professional, loud | Bricolage Grotesque (no italic) | Headlines and figures when the fancy voice would be too formal. VoteHound's headline face. |
| Fancy | Playfair (`opsz` to 1200), Bodoni Moda, Kalnia, Newsreader, Literata | Newsreader or Literata when the app is mostly documents. |
| Fun | Caveat, Gluten, Playpen Sans, Recursive at `CASL` 1 | Caveat when the fun voice is literally a pen (VoteHound). |
| One-file budget | Recursive (`CASL`, `MONO`, `CRSV`) | Professional, fun and mono from one variable file; add one fancy face. |

**Not on the bench:** Inter, Geist, Space Grotesk, Roboto, Arial as a design choice,
Instrument Serif. The complaint is ubiquity, not quality. Re-audit this list every six
months; defaults move. (The VoteHound Working Copy boards currently set interface text
in Geist. See `../ideas/open-questions.md`.)

## Emphasis grammar

Six devices, each with one meaning. One per span; two at most; never three.

| Device | Means | Markup | Notes |
|---|---|---|---|
| **Bold** | Importance | `<strong>` | The device to prefer. Readers with dyslexia are advised bold over italic or underline. |
| *Italic* | Stress, titles, a foreign or defined phrase | `<em>`, `<cite>`, `<i>` | Short phrases only. Never a paragraph. |
| Solid underline | A link | `<a>` | Links are never distinguished by colour alone (WCAG 1.4.1). |
| Wavy / dotted underline | More here: a term, an abbreviation, a hint | `<dfn>`, `<abbr>` | Muted colour, `cursor: help`, so it cannot be mistaken for a link. |
| Highlighter | The phrase this screen is about | `<mark>` | Ink on the highlighter fill. One or two per screen. |
| Voice switch | Ceremony (fancy) or an aside (fun) | class on a semantic element | Budgeted per screen. |

Screen readers usually ignore visual bold and italic, so emphasis that changes meaning
must also be in the words. Short all-caps labels are fine with added tracking; all-caps
sentences are not.

## Reading rules

- Body at least `1.0625rem`; the largest study found comprehension improving with size
  up to 18pt and suffering at 10–12pt.
- Line-height 1.5 for body. Measure 55–75 characters: a comfort choice (readers prefer
  it), not a speed one.
- `rem` everywhere; no pixel root size; survive 200% zoom and the WCAG 1.4.12 spacing
  overrides without clipping.
- A **reading-font setting** on any screen people read for more than a minute: app
  default, system, Atkinson. Readers were 35% faster in their best font than their
  worst, and the best font differed per person and was not the one they said they
  preferred. It is implemented by overriding `--qs-voice-reading`.
- Do not ship a "dyslexia font" as an accessibility feature. The studies show no
  measurable benefit; spacing is the active ingredient, and the 1.4.12 overrides cover
  it.

## Animating type

- Animate width-neutral axes (`SOFT`, `WONK`, `BNCE`, `INFM`, `GRAD`), not `wght` or
  `wdth`, which reflow the line. This is inference, not a sourced benchmark; measure it.
- Short headings only. Once, on arrival. Never per-character on body text.
- Under reduced motion, type is simply set at its final values.

## Loading

- Self-host WOFF2 through Fontsource (`@fontsource-variable/…`); no third-party font
  CDN. Subset with `unicode-range`.
- Preload the professional face only (`crossorigin` is required even same-origin).
  `font-display: swap` for it; `font-display: optional` or lazy loading for fancy and
  fun, which are non-critical by definition.
- Give every face a metric-matched fallback (`size-adjust`, `ascent-override`,
  `descent-override`) so nothing shifts when it arrives. Fontaine or Capsize generate
  these.
