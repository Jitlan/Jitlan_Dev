# Guided tours

Every app ships an introduction that anyone can start at any time. The research says
to be careful about how. Sources and numbers:
`../references/tours-and-delight-research.md`.

## What the evidence says

- People start using software immediately and do not read instructions first
  (Carroll and Rosson's "paradox of the active user"). In NN/g's mobile study, people
  who went through tutorials did slightly *worse* (91% task success against 94%) and
  rated tasks harder.
- Tours the user starts are completed two to three times as often as tours that start
  themselves (vendor benchmarks: roughly 64–69% against 23–33%).
- Completion falls off quickly with length: roughly three in four people finish a
  one-or-two-step tour, about a third finish three to five steps, and under a tenth
  finish nine or more. These are vendor-reported figures; trust the direction, not the
  decimals.
- Completion is not learning. A finished tour proves someone pressed Next.

So: the tour is *available*, never *imposed*; it is short; and it is the third line of
teaching, behind a clear screen and good empty states.

## The rules

1. **Easy first.** A screen must be usable with no tour. If a step exists to explain
   something confusing, fix the screen and delete the step.
2. **Pull, not push.** A permanent **Take the tour** entry lives in the core. On first
   run the app shows one small, dismissible offer (a bead from the core). It never
   auto-starts, and never appears while the user is mid-task.
3. **Three to five steps, one idea each.** More than five becomes separate
   per-feature tours ("Tour: tracking", "Tour: the map"), each launchable where the
   feature lives.
4. **Do, don't tell.** Prefer steps that advance when the user performs the action
   over steps that advance on Next. Use safe sample data if the real action has
   consequences.
5. **Always escapable.** Close on every step, Escape ends the whole tour, and nothing
   is lost by leaving. Progress is remembered; reopening offers Resume or Start over.
6. **Never cover the target.** The step sits beside what it describes, and the target
   stays interactive.
7. **It is a drop.** A step spreads from the core, travels to its target, and gathers
   back into the core when the tour ends. That return shows the user where to find the
   tour again, which is the most useful thing a tour can teach.
8. **It stays true.** A tour is part of the feature. Changing a screen means updating
   its steps in the same change; a step whose target no longer exists fails the build.

## Step anatomy

```
┌──────────────────────────────┐
│ Title (professional, bold)   │  ← labels the dialog
│ One sentence. Two at most.   │  ← describes it
│ Step 2 of 4    Back  Next  ✕ │
└──────────────────────────────┘
```

- Copy may be in the fun voice for the sentence, never for the title or the buttons.
- Material: glass or solid, radius 20px, 320px wide, `--qs-edge` border.
- **Spotlight.** The step must make it obvious what it is talking about. Everything
  except the target fades back under a wash of the paper colour at about 80%, and a
  hand-drawn pen-A loop is drawn round the target once the spotlight arrives. The
  spotlight travels from target to target with the step.
- The wash is the page's own paper colour, not black, and it never takes pointer
  events: the target, the step and the rest of the page all stay usable.
- The loop is built in real pixels for the target's box, so its stroke weight and
  draw-in are the same for a small button and a full-width panel.

## Accessibility contract

- Each step is `role="dialog"` (non-modal), `aria-labelledby` its title,
  `aria-describedby` its sentence.
- Focus moves into the step when it opens. Tab reaches the target and the page; the
  tour does not trap focus.
- A polite live region announces "Step 2 of 4: *title*".
- Escape closes the tour and returns focus to the launcher in the core.
- Scrolling a target into view uses `scroll-behavior: auto` under reduced motion; the
  step cross-fades instead of travelling.
- Every step is reachable and operable by keyboard alone, at 200% zoom, at 320px wide.

## The manifest

Tours are data, kept next to the feature, so they can be reviewed, tested and updated
by an agent.

```jsonc
// tours/first-run.tour.json
{
  "id": "first-run",
  "title": "A quick look around",
  "launcher": "core",              // where "Take the tour" lives
  "offerOnFirstRun": true,         // one dismissible offer; never auto-start
  "steps": [
    {
      "id": "search",
      "target": "[data-tour='search']",   // stable hook, not a styling class
      "title": "Search everything",
      "body": "Bills, members and committees all live in this one box.",
      "advanceOn": { "event": "input", "selector": "[data-tour='search']" },
      "placement": "bottom"
    },
    {
      "id": "follow",
      "target": "[data-tour='follow']",
      "title": "Follow what you care about",
      "body": "Followed items show up on your Tracking page.",
      "advanceOn": "next"
    }
  ]
}
```

Rules for the manifest: targets use `data-tour` attributes; every `target` must exist
in the rendered app (checked by a test); 3–5 steps; each `body` is under 140
characters.

## Implementation

Prefer native building blocks:

- `<div popover="manual" role="dialog">` for the step (the Popover API puts it in the
  top layer without making the page inert).
- CSS anchor positioning to attach it to the target, with a `position-try` fallback
  and a plain fixed position where anchor positioning is partial.
- `@starting-style` for entry, a view transition or a transform for travel between
  targets.

If a library is wanted: **Driver.js** (MIT, vanilla, actively maintained). React
Joyride (MIT) is the React option. **Avoid Shepherd.js and Intro.js**: both are
AGPL-3.0 with a paid commercial licence.

## Beyond the tour

- **Empty states** teach the first action of every surface.
- **Contextual hints**: a wavy-underlined term or a small "?" drop beside a control,
  opened by the user.
- **A "What's new" bead** from the core after a release, linking to a one-to-three
  step mini-tour of the change.
