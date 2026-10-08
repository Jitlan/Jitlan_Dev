# Jitlan_Dev

Personal portfolio site for Jordan Liebling — [jordanliebling.dev](https://jordanliebling.dev).

Static site (plain HTML/CSS/JS, no build step). Everything served lives in `dist/`.

## The painted journey

The site is an oil-painted autumn hike: dawn at the top of the page, a sunset
over a lake at the bottom (blue hour to a starry night in the dark theme). The
content is unchanged; the painting is a decorative layer behind it.

| File | Role |
| --- | --- |
| `dist/js/timeline.js` | Day and night palette keyframes. The single source of truth for every colour, the sun/moon position and star density. Edit this to change the look. |
| `dist/js/journey.js` | Maps scroll position to time of day, writes the `--sky-top`, `--panel`, `--ink`… custom properties, blends day/night when the toggle is clicked, drives the 3-D card tilt and the chip tumble-in, and decides whether to load WebGL. |
| `dist/js/scene.js` | ES module: the Three.js valley (sky, sun/moon, stars, terrain, trees, leaves, lake) with a painterly post-process. Loaded only when WebGL is available and motion is allowed. |
| `dist/js/vendor/` | Vendored Three.js r180 (`three.module.min.js` + `three.core.min.js`, MIT). No CDN dependency. |
| `dist/js/main.js` | Unchanged: ticker, typing effect, theme toggle, scroll reveals. |

Without WebGL (or with `prefers-reduced-motion`) the CSS/SVG fallback in
`index.html` paints the same sky, hills and sun from the same custom properties.

## Local development

```sh
node server.js   # serves dist/ at http://localhost:8081
```

## Deployment

Pushing to `master` deploys automatically via GitHub Actions
(`.github/workflows/deploy.yml`), which publishes `dist/` to GitHub Pages.
There is no manual deploy step.

## Tests

Playwright demo/regression specs live in `e2e/demos/`.

```sh
npm i -D @playwright/test && npx playwright install chromium   # one-time setup
npx playwright test                                            # requires server on :8081
```

`e2e/demos/painted-journey.spec.ts` covers the redesign: content structure,
scroll-driven colours, day/night blend, contrast at every keyframe, the WebGL
scene, the no-WebGL and reduced-motion fallbacks, and the phone layout.
