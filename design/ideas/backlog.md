# Ideas backlog

Not decided, not promised. Roughly ordered by how much I want them. When one is built,
move what was learned into `../docs/` and delete it from here.

## Core and spread

- **The living core.** The closed core is a metal bead whose highlight leans a few
  degrees toward the pointer, and whose outline wobbles once when something new
  arrives. Still under reduced motion.
- **Split on select.** Selecting several rows pulls a bead out of each and merges them
  into one action bar; deselecting sends them back.
- **Drag to gather.** Drag a drop back toward the core and it is absorbed, with real
  velocity. Needs a true spring, not a fixed-duration curve.
- **Liquid bridge.** For the few hundred milliseconds a drop is leaving the core, a
  goo or SDF layer shows the neck between them stretching and snapping. Decoration
  only, behind the real elements. Measure it on Safari before committing.
- **Route as spread.** Navigating to a record is that record's card spreading to fill
  the screen (view transition with `match-element`); Back gathers it.
- **Search as core.** A variant where the core is a search field and results are
  drops. Try it on VoteHound's desktop home.
- **Core position memory.** Let the user drag the core to another corner; remember it.

## Materials

- **Material casts per app.** Each app picks a signature non-solid material: VoteHound
  paper, the portfolio wet glass, a finance tool brushed metal.
- **Texture tokens.** Grain, ruling, brushed, frosted as tiny tiled SVGs with an
  opacity token, so "texture" is as easy to change as colour.
- **A material slider**, not a two-stop dial, following what Apple ended up shipping.
- **Mercury colour.** The metal gradient takes a tint from pen A at low chroma, so
  each app's mercury is recognisably its own.
- **Time-of-day cast.** Paper warms slightly in the evening. Subtle, and off with
  Playfulness.

## Typography

- **Voice arrival.** A fancy heading lands with `SOFT` 100 → 0 and `WONK` 0 → 1 over
  the ceremony duration; a fun aside bounces once on `BNCE`.
- **Reading-font setting as a component**, shared across apps, with the choice stored
  once per user.
- **A fourth "machine" voice** for anything an AI wrote in the app, so generated text
  is always visibly distinct. Probably the mono, set larger. Worth a real think: it is
  an honesty feature, not a style one.
- **Type specimen page** generated from the tokens, as the first screen of any new
  project.

## Ceremony motifs

- **A motif library.** The kit has one: a ship for "Shipped". Worth collecting more as
  apps need them (paw for tracked, stamp for approved, envelope for sent, key for
  unlocked), each a single small silhouette that crosses once.
- **Motif from the word.** Let the plugin suggest a motif when it writes a ceremony,
  and fall back to the plain bead when nothing fits.

## Tours

- **The tour as a bead.** The step is a metal bead that rolls from target to target
  and opens into a card at each stop.
- **"Show me" over "tell me".** A step can offer to perform the action in slow motion
  on sample data, then hand control back.
- **Tour coverage report.** A script that lists features with no tour step and no
  empty state, as a nudge, not a gate.
- **What's-new mini-tours** generated from the changelog at release time.
- **Tour replay with real data.** After first use, the tour points at the user's own
  items instead of samples.

## Easter eggs

- **Shake the mercury.** Shake the phone, or wiggle the core with the pointer, and
  the interface's drops jiggle and resettle. Reduced motion: nothing.
- **Hidden material.** A sequence unlocks a material that is not in Settings (gold
  leaf, lava lamp, graph paper). It then appears in Settings, so it is not lost.
- **The maker's mark.** Every app prints the same small signature in the console and
  carries a `/humans.txt`, with a different one-line clue per app.
- **Konami, carefully.** Arrow keys only for the trigger, ignored in text fields,
  disabled with Playfulness off; the classic B, A ending collides with screen-reader
  quick keys.
- **Cross-app egg.** Something found in one app gives a word that does something in
  another.
- **Anniversary.** On the day the project's first commit was made, the fun voice says
  so.
- **The thousandth.** Milestone ceremonies drawn from a pool so the hundredth and the
  thousandth are different.

## Tooling

- **A living kit page** per project: every token, voice, material, mark and the core,
  rendered from the real CSS. The Working Copy kit board is the model.
- **Screenshot diff of the kit** in CI, in both schemes and with reduced motion.
- **A "slop check"** in the audit skill: flags the listed tells, and is re-read every
  six months because the tells move.
- **DESIGN.md lint in CI** with Google's CLI once it is past alpha.
- **Eval prompts for the skill**: the same ten UI requests, run after each change to
  the plugin, outputs kept side by side.
