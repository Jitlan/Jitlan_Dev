# Jitlan_Dev

Personal portfolio site for Jordan Liebling — [jordanliebling.dev](https://jordanliebling.dev).

Static site (plain HTML/CSS/JS, no build step). Everything served lives in `dist/`.

## Two views of the same page

**Drive view (default).** The background is a real-time 3D drive: driver's seat of a
sports car with a chocolate-leather cabin, a wet mountain road in autumn, rain on the
windshield. The page's own sections (`#hero`, `#bio`, `#stack`, `#about`, `#projects`,
footer) are shown one at a time as a HUD on the glass. Scrolling moves between them —
and pushes the car along. The light/dark toggle switches the drive between an overcast
afternoon and night.

**Classic view.** The original stacked page, untouched. It is used automatically when
WebGL2 is unavailable, when the visitor prefers reduced motion, or if the 3D scene fails
to start; anyone can switch with the *Classic view* / *Take the drive* button (remembered
in `localStorage`), or force one with `?view=classic` / `?view=drive`.

The HTML is identical in both views; the drive view is CSS scoped to
`<html data-view="drive">` plus the modules below. Three.js is only downloaded in the
drive view.

### The easter egg

Click the **ENGINE START** button on the dash (left of the wheel) to play. The car steers
itself; you have a throttle (`W` / `↑` / `Space`, or the on-screen pedal) and a brake
(`S` / `↓`). Carry too much speed into a bend and the car slides wide and leaves the
road, which ends the run with a quote that changes every time. Checkpoints every 500 m
add time to the clock. Each run's distance, time, average and top speed are cached in
`localStorage` (`jl-drive-board-v1`) and shown as a personal top-five leaderboard.

## Layout

```
dist/
  index.html            page content (shared by both views)
  css/main.css          classic layout
  css/drive.css         drive view: HUD panels, game UI
  js/main.js            theme toggle, typing, ticker, fade-ins
  js/drive/
    main.js             picks the view, boots the scene, falls back on failure
    engine.js           renderer + frame loop (world → wet glass → cabin)
    road.js             endless deterministic road: curvature, hills, hillside
    world.js            terrain, trees, rails, signs, sky, rain, leaves
    interior.js         cabin, gauges, wheel, wipers, bonnet
    glass.js            rain-on-windshield shader, wiper timing
    hud.js              scroll → HUD panels, speed cluster, waypoint nav
    game.js             push-to-start game: UI, quotes, leaderboard
    sim.js              game physics (no DOM; can be run headlessly)
    util.js             math, noise, units
  js/vendor/            three.js r185 (MIT), vendored as-is from npm
```

To update three.js, copy `build/three.module.min.js` and `build/three.core.min.js`
from the `three` npm package into `dist/js/vendor/`.

Things you're most likely to tweak:

- **HUD copy** comes straight from `index.html`; panel titles are in `TITLES` in `hud.js`.
- **Loss quotes** are `FALL_QUOTES` / `TIME_QUOTES` at the top of `game.js`.
- **Game feel** (grip, braking, clock, checkpoint spacing) is `TUNE` in `sim.js`.
- **Colours and time of day** are `PALETTE` in `world.js`; the cabin's materials are at
  the top of `Interior` in `interior.js`.

## Local development

```sh
npm install
node server.js   # serves dist/ at http://localhost:8081
```

## Deployment

Pushing to `master` deploys automatically via GitHub Actions
(`.github/workflows/deploy.yml`), which publishes `dist/` to GitHub Pages.
There is no manual deploy step.

## Tests

Playwright demo/regression specs live in `e2e/demos/`. The content specs run against
the classic view; `drive-view.spec.ts` covers the 3D view and the game (it needs
WebGL — software rendering works, just slowly).

```sh
npm i -D @playwright/test && npx playwright install chromium   # one-time setup
npx playwright test                                            # requires server on :8081
```
