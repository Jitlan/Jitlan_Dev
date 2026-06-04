# Jitlan_Dev

Personal portfolio site for Jordan Liebling — [jordanliebling.dev](https://jordanliebling.dev).

Static site (plain HTML/CSS/JS, no build step). Everything served lives in `dist/`.

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
