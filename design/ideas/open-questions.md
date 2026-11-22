# Open questions

Decisions that are not made. Each has a current lean so work is not blocked.

## 1. The name

"Quicksilver" is a working name (the old word for mercury). It is also the name of an
old Mac launcher and other products, which matters little for a personal language.
Alternatives considered: Amalgam (mercury merged with another metal), Bead, Meniscus.
**Lean:** keep Quicksilver until something better turns up; the token prefix `--qs-`
is the only thing that would need renaming.

## 2. Is the default cast right?

The three default faces were chosen from research, not from seeing them together on a
real screen.

- Atkinson Hyperlegible Next has the accessibility story but a plain personality.
  Instrument Sans or Figtree may suit better.
- Fraunces is expressive and animatable, and is also drifting onto "tasteful AI
  default" lists. Playfair or Bodoni Moda are less exposed.
- Shantell Sans is built to bounce; Caveat is what VoteHound already uses as a pen.

**Lean:** build one kit page with all three, look at it, then decide. Do this before
writing the plugin skill.

## 3. Does VoteHound recast its interface face?

The Working Copy boards set interface text in Geist, which this language keeps off the
bench as a stock default. Options: (a) recast VoteHound to Atkinson or Instrument
Sans; (b) allow Geist as a VoteHound-only exception; (c) drop the ban.
**Lean:** (a), tried on one board first. Bricolage, Newsreader and Caveat stay.

## 4. One palette or a cast per app?

The spec ships VoteHound's colours as the default cast and lets each app recast. That
keeps apps distinct but means there is no single recognisable "my apps" colour.
**Lean:** recast per app; let the core, the voices and the motion be the signature.

## 5. How literal is the mercury?

At one end, "mercury" is only a rule about origins, implemented with ordinary
transitions (what VoteHound does). At the other, there is a visible liquid layer with
metaballs. The literal version is the memorable one and also the expensive and
fragile one.
**Lean:** the rule everywhere; the liquid layer on the core only, as an enhancement,
after measuring it on Safari and a mid-range phone.

## 6. Where does the core sit on desktop?

VoteHound uses a left rail. A bottom-centre puck is more distinctive and closer to the
phone, but fights with content on wide screens.
**Lean:** rail by default; try the puck on a tool-style app.

## 7. Framework stance

The docs are written framework-neutral with CSS-first examples. The plugin has to
choose what it generates by default: plain HTML and CSS, React with Base UI, or
whatever the project already uses.
**Lean:** follow the project; for new projects, native elements and CSS until a
component genuinely needs a primitive.

## 8. Tailwind or not

Tokens are plain custom properties. Tailwind v4 can consume them through `@theme`.
**Lean:** tokens stay framework-free; provide an optional `@theme` mapping in the
plugin, generated, never hand-edited.

## 9. Should the spec stay in the portfolio after the plugin exists?

Options: move everything and leave a pointer; or keep a rendered copy as a portfolio
piece (a public page showing the language, built with itself).
**Lean:** move the source to the plugin repository; build a showcase page for the
portfolio later, as its own project.

## 10. Cloud sessions

Installed plugins do not load in Claude Code on the web. The working answer is that
`init` copies the files into each project. If cloud sessions gain plugin support, the
copies become redundant and should turn into a single pointer.
**Lean:** copy for now; revisit when the platform changes.

## 11. Unverified research worth settling

- Exact WCAG 2.2 wording for the criteria the definition of done cites.
- Current Firefox and Safari status of `prefers-reduced-transparency`, cross-document
  view transitions and `shape()`.
- Whether animating `SOFT` / `WONK` / `BNCE` is as cheap as assumed.
- The Nielsen Norman Group Liquid Glass findings, read in full.
