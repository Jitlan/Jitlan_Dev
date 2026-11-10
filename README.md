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

Click the **ENGINE START** button on the dash (left of the wheel) to play.

**The drive.** A winding mountain road against the stopwatch. By default it's a sprint:
the last three-quarters of a mile to the café, about a minute if you're tidy. The long way,
all three miles (about three minutes), is one click away on the start line or the result
card, or press `C`; the choice is remembered. The car steers itself; all you control is
speed:

- keyboard: `W` / `↑` / `Space` to accelerate, `S` / `↓` to brake
- touch (or mouse): hold anywhere on the screen to accelerate, let go to brake

Carry too much speed into a bend and the car slides wide and leaves the road, which ends
the run with a quote that changes every time and puts you back on the start line. The HUD
calls the next bend and flashes **BRAKE** when it's time.

**The café.** Cross the line and the car parks itself at Cortado Pass Café, where there's
a drink to make: grind 18 g, tamp, pull 36 g in about 27 seconds, steam the milk to 140°F,
then free-pour the latte art onto the cortado. Each station is "hold, then let go at the
right moment"; the pour is a small fluid simulation, so the art is whatever you drew.

Every run's distance or finish time, average speed and cortado score are cached in
`localStorage` (`jl-drive-board-v1`) and shown as a personal top-five leaderboard, one per
course. A café finish always outranks a crash; finishes rank by time, crashes by distance.

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
    textures.js         surface detail (rock, leaves, bark, asphalt, leather), drawn on the GPU at load
    glass.js            rain-on-windshield shader, wiper timing
    hud.js              scroll → HUD panels, speed cluster, waypoint nav
    game.js             push-to-start game: controls, arrival, quotes, leaderboard
    sim.js              driving physics (no DOM; can be run headlessly)
    cafe.js             espresso stations and the latte-art pour
    util.js             math, noise, units
  js/vendor/            three.js r185 (MIT), vendored as-is from npm
  assets/fonts/         "JL" in Italianno (OFL), for the badge on the steering wheel
```

To update three.js, copy `build/three.module.min.js` and `build/three.core.min.js`
from the `three` npm package into `dist/js/vendor/`.

Things you're most likely to tweak:

- **HUD copy** comes straight from `index.html`; panel titles are in `TITLES` in `hud.js`.
- **Loss quotes** are `FALL_QUOTES` / `TIME_QUOTES` at the top of `game.js`.
- **Game feel** (grip, braking, power) is `TUNE` in `sim.js`; the two courses are
  `COURSES` in `road.js` and where the café sits is `COURSE` there, and how twisty the road is lives in
  `Road._plan()` there.
- **Coffee targets** (dose, yield, shot time, milk temperature) are `TARGET` in `cafe.js`;
  the café's verdicts are `CUP_VERDICTS` in `game.js`.
- **Headlamps** (beam shape, cut-off, colour, high beam) are `GLSL_HEAD` and
  `makeHeadUniforms()` in `world.js`.
- **Wipers** (pivots, blade reach, sweep) are `WIPERS` in `interior.js`; the rain shader
  clears exactly those two fans, so the blades and the dry glass always agree.
- **Surface detail.** Nothing is downloaded: `textures.js` draws four small tiling textures
  at start-up. How strongly each is laid over the flat low-poly colours is `GLSL_DETAIL` in
  `world.js` (hillside, trees, timber), the top of the road shader there (asphalt), and the
  `hide` / `nap` / `blasted` settings at the top of `Interior` (cabin). Texture size and
  filtering per device are `detail` and `aniso` in `QUALITY` in `engine.js`.
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
