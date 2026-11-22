# Easter eggs

Every app hides at least one thing for the curious. The portfolio site's version is the
ENGINE START button: press it and the background drive becomes a time trial that ends
with pulling an espresso shot. That is the standard to aim at: found by someone who
pokes at things, worth finding, and free to ignore.

Background: `../references/tours-and-delight-research.md`.

## Why, and the order it comes in

Delight is the top of a pyramid: functional, reliable, usable, *then* pleasurable
(Aarron Walter). NN/g makes the same cut between surface delight (a nice animation,
which fades) and deep delight (which only arrives when everything underneath works).
An egg on a shaky app reads as misplaced effort. So eggs are built last, and a bug
always outranks one.

Delighters also decay: what surprises today is expected next year (Kano). Design for
the thousandth exposure, not the first.

## The contract

An egg ships only if all of these hold.

1. **Off the critical path.** No feature, setting or piece of information is reachable
   only through an egg.
2. **Earned or opt-in.** It follows a real accomplishment, or a deliberate act of
   curiosity. It never interrupts.
3. **Free to ignore.** It costs no time, blocks no input, steals no focus, and
   dismisses on Escape.
4. **Rare and varied.** Not every time; not the same every time. A pool of outcomes,
   and a cooldown.
5. **Never in a serious moment.** No whimsy in errors, destructive actions, payments,
   security, privacy, or anything involving data loss.
6. **Accessible.**
   - Reachable without a pointer.
   - Key-sequence triggers are ignored while focus is in a text field, and can be
     turned off (WCAG 2.1.4; single-letter sequences collide with screen-reader quick
     keys and speech input).
   - Safe under reduced motion: a still or a cross-fade, not confetti.
   - No sound unless the user started it.
   - Decorative output is `aria-hidden`; anything meaningful is announced once,
     politely.
   - No flashing above three times a second.
7. **Switchable off.** A **Playfulness** setting (on / off), stored per user, applied
   as `data-play="off"` on `<html>`. Off silences eggs and fun-voice animation; it
   does not remove features.
8. **Cheap.** Lazy-loaded. An egg adds nothing to the first load.
9. **Logged.** Every egg has an entry in the project's `EGGS.md`.

## Kinds of egg

| Kind | Example | Good when |
|---|---|---|
| **Curiosity** | A control that does more than it says; a long-press; typing a word into search | The app has an exploratory audience |
| **Milestone** | The hundredth item, a streak, a perfect score gets a one-off ceremony | There is a real accomplishment to mark |
| **Calendar** | One day a year the fun voice says something different | The app is used over long periods |
| **Maker's mark** | A console message, `/humans.txt`, a credits screen, a signature in an SVG | Always. It is also the discovery trail |
| **Material** | A hidden material or colour cast unlocked by an act | The app already has a Material setting |
| **Toy** | A small game or instrument inside a loading or empty state | There is dead time worth filling |

Quicksilver-specific ideas are in `../ideas/backlog.md`.

## The discovery trail

Eggs should be findable without being advertised. Leave quiet clues: a line in the
console, a `/humans.txt`, an odd detail in the About screen, a tour step that ends with
"…and there is one more thing we are not going to tell you about."

## `EGGS.md`

Kept in each project (private if the repository is public), so eggs survive
refactors and nobody ships one into an error state by accident.

```markdown
## Engine start
- **Trigger:** press ENGINE START on the dash (keyboard: focus + Enter)
- **What happens:** the drive becomes a timed run; finishing opens the café mini-game
- **Kind:** toy
- **Where:** js/drive/game.js
- **Reduced motion:** unavailable; classic view is used instead
- **Off switch:** Classic view / Playfulness off
- **Never fires during:** n/a (no forms or destructive actions on this site)
- **Clue:** the button is visible on the dash; README documents it
```

## Review questions

Before shipping an egg, answer these in the pull request:

- What did the user do to earn or ask for this?
- What is it like the tenth time? The hundredth?
- What happens with a screen reader, with a keyboard only, with reduced motion?
- Could it ever fire next to an error or a loss?
- Is it in `EGGS.md`?
