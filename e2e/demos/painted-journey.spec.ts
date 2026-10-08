import { test, expect, devices, type Page } from "@playwright/test";

const BASE = "http://localhost:8081";

/** Scroll to a fraction of the page and wait for the journey driver to settle. */
async function scrollTo(page: Page, fraction: number) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.round(f * max), behavior: "instant" as ScrollBehavior });
  }, fraction);
  // journey.js damps progress over a few hundred milliseconds; wait for it to settle.
  await expect
    .poll(() => page.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue("--journey"))), { timeout: 15_000 })
    .toBeCloseTo(fraction, 2);
}

function cssVar(page: Page, name: string) {
  return page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
}

/** WCAG relative luminance contrast between two hex colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Headless SwiftShader logs harmless GL driver performance notes; everything else counts.
    if (m.type() === "error" && !/GL Driver Message/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test.describe("painted journey", () => {
  test("content structure is unchanged for recruiters: sections, headings, links, summary", async ({ page }) => {
    await page.goto(BASE);
    const order = await page.evaluate(() => Array.from(document.querySelectorAll("body > section")).map((s) => s.id));
    expect(order).toEqual(["hero", "bio", "stack", "about", "projects", ""]);
    const headings = await page.evaluate(() => Array.from(document.querySelectorAll("h2.section-title")).map((h) => h.textContent?.trim()));
    expect(headings).toEqual(["About Me", "Tech Stack & Skills", "What I Do", "Side Projects"]);
    await expect(page.locator(".hero__name")).toHaveText("Jordan Liebling");
    const ctas = await page.locator(".hero__ctas a").evaluateAll((els) => els.map((a) => (a as HTMLAnchorElement).href));
    expect(ctas).toEqual([
      "https://github.com/Jitlan",
      "https://www.linkedin.com/in/jordan-liebling-480763120/",
      "https://news.ycombinator.com/user?id=jliebling",
      "https://endorsements.app/u/jordanliebling",
    ]);
    await expect(page.locator(".stack__item")).toHaveCount(41);
    await expect(page.locator(".about__card")).toHaveCount(3);
    await expect(page.locator(".project-card")).toHaveCount(3);
    await expect(page.locator("section.sr-only")).toContainText("Jordan Liebling is a Senior Software Engineer");
    // Decorative layers never reach assistive tech.
    await expect(page.locator(".scene")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".leaves")).toHaveAttribute("aria-hidden", "true");
  });

  test("loads and scrolls to the bottom without console or page errors", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await scrollTo(page, 1);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test("time of day follows scroll: dawn at the top, sunset at the bottom", async ({ page }) => {
    test.slow(); // several damped scroll positions while the WebGL scene renders
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(BASE);
    await scrollTo(page, 0);
    const top = { sky: await cssVar(page, "--sky-top"), sunY: Number(await cssVar(page, "--sun-y")) };
    await scrollTo(page, 1);
    const bottom = { sky: await cssVar(page, "--sky-top"), sunY: Number(await cssVar(page, "--sun-y")) };
    expect(top.sky).not.toBe(bottom.sky);
    expect(bottom.sunY).toBeLessThan(top.sunY); // the sun has set
    expect(Number(await cssVar(page, "--journey"))).toBeGreaterThanOrEqual(0.99);
  });

  test("night journey is darker and the toggle blends the sky over time", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(BASE);
    const daySky = await cssVar(page, "--sky-top");
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => cssVar(page, "--night").then(Number), { timeout: 15_000 }).toBe(1);
    const nightSky = await cssVar(page, "--sky-top");
    expect(contrast(daySky, "#000000")).toBeGreaterThan(contrast(nightSky, "#000000"));
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`body text keeps AA contrast on panels at every keyframe (${scheme})`, async ({ page }) => {
      test.slow(); // five damped scroll positions while the WebGL scene renders
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(BASE);
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        await scrollTo(page, f);
        const panel = await cssVar(page, "--panel");
        const ink = await cssVar(page, "--ink");
        const muted = await cssVar(page, "--ink-muted");
        const accent = await cssVar(page, "--accent-j");
        expect(contrast(ink, panel), `ink on panel at ${f}`).toBeGreaterThanOrEqual(7);
        expect(contrast(muted, panel), `muted on panel at ${f}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accent, panel), `accent on panel at ${f}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test("WebGL scene renders when available", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(BASE, { waitUntil: "networkidle" });
    const available = await page.evaluate(() => {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    });
    test.skip(!available, "headless browser has no WebGL");
    await expect(page.locator("html")).toHaveClass(/has-webgl/, { timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-scene", "webgl");
    await expect.poll(() => page.evaluate(() => (window as any).JL?.scene?.frames ?? 0), { timeout: 15_000 }).toBeGreaterThan(3);
    const counts = await page.evaluate(() => (window as any).JL.scene.counts);
    expect(counts.trees).toBeGreaterThan(50);
    expect(counts.leaves).toBeGreaterThan(50);
    expect(errors).toEqual([]);
  });

  test("without WebGL the painted CSS fallback takes over", async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: any[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as any).call(this, type, ...rest);
      } as any;
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveClass(/no-webgl/);
    await expect(page.locator("html")).toHaveAttribute("data-scene", "css");
    await expect(page.locator(".scene__fallback")).toHaveCSS("opacity", "1");
    await expect(page.locator(".leaf")).toHaveCount(10);
    await scrollTo(page, 1);
    expect(errors).toEqual([]);
  });

  test("reduced motion: no WebGL, no leaves, colours still follow scroll", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveClass(/no-webgl/);
    await expect(page.locator(".leaf")).toHaveCount(0);
    const top = await cssVar(page, "--sky-top");
    await scrollTo(page, 1);
    expect(await cssVar(page, "--sky-top")).not.toBe(top);
    // Reveal-only transitions: the stack chips must be readable immediately.
    await expect(page.locator(".stack__item").first()).toHaveCSS("opacity", "1");
  });

  test("tech-stack chips tumble in once the section is reached", async ({ page }) => {
    await page.goto(BASE);
    await page.locator("#stack").scrollIntoViewIfNeeded();
    await expect(page.locator(".stack__items")).toHaveClass(/stack__items--in/);
    await expect.poll(() => page.locator(".stack__item").last().evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  });
});

test.describe("painted journey on a phone", () => {
  // Keep the project's Chromium; only borrow the phone's viewport, touch and user agent.
  const { defaultBrowserType: _ignored, ...phone } = devices["iPhone 13"];
  test.use(phone);

  test("renders the full journey on a small screen without errors", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await expect(page.locator(".hero__name")).toBeVisible();
    await expect(page.locator(".theme-toggle")).toBeVisible();
    await scrollTo(page, 1);
    await expect(page.locator(".footer__copy")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
