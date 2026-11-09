import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:8081";
const BOARD_KEY = "jl-drive-board-v1";

// The drive view renders with WebGL; software rendering in CI-like
// environments is slow, so give it room and don't run these side by side.
test.describe.configure({ mode: "serial", timeout: 90_000 });

async function openDrive(page: Page, query = "") {
  await page.goto(BASE + "/" + query);
  await page.waitForFunction(
    () => document.documentElement.classList.contains("drive-ready") && !!(window as any).__drive,
    null,
    { timeout: 60_000 },
  );
}

/**
 * Advance the simulation without waiting on real frames. The game is
 * deterministic given inputs, so tests hold a key and step the engine.
 */
async function stepUntil(page: Page, state: string, maxFrames = 4000) {
  return page.evaluate(
    ([state, maxFrames]) => {
      const d = (window as any).__drive;
      let n = 0;
      while (d.game.state !== state && n < maxFrames) {
        d.engine.step(1 / 60);
        n++;
      }
      return d.game.state as string;
    },
    [state, maxFrames] as const,
  );
}

test.describe("drive view", () => {
  test("is the default: 3D canvas behind, hero content on the windshield HUD", async ({ page }) => {
    await openDrive(page);
    await expect(page.locator("html")).toHaveAttribute("data-view", "drive");
    await expect(page.locator("canvas.drive-canvas")).toBeVisible();
    await expect(page.locator("#hero")).toHaveClass(/is-active/);
    await expect(page.locator(".hud__title")).toHaveText("DRIVER");
    await expect(page.locator(".hud__idx")).toHaveText("01/06");
    await expect(page.getByRole("heading", { level: 1, name: "Jordan Liebling" })).toBeVisible();

    // The scene is actually drawing: the centre of the canvas isn't one flat colour.
    const varied = await page.evaluate(() => {
      const d = (window as any).__drive;
      d.engine.render();
      const gl = d.engine.renderer.getContext() as WebGL2RenderingContext;
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const px = new Uint8Array(4 * 64);
      const seen = new Set<string>();
      for (let i = 0; i < 8; i++) {
        gl.readPixels(Math.floor((w * (i + 1)) / 9), Math.floor(h * 0.6), 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let j = 0; j < px.length; j += 4) seen.add(`${px[j] >> 3},${px[j + 1] >> 3},${px[j + 2] >> 3}`);
      }
      return seen.size;
    });
    expect(varied).toBeGreaterThan(12);
  });

  test("scrolling drives through the sections, one HUD panel at a time", async ({ page }) => {
    await openDrive(page);
    const title = page.locator(".hud__title");
    const expected = ["DRIVER", "ABOUT ME", "TECH STACK", "WHAT I DO", "SIDE PROJECTS", "CONTACT"];
    const sections = ["#hero", "#bio", "#stack", "#about", "#projects", "footer.footer"];

    for (let i = 0; i < expected.length; i++) {
      await page.evaluate((i) => {
        const p = (window as any).__drive.hud.panels[i];
        window.scrollTo({ top: Math.ceil(p.start + p.lead + 2), behavior: "instant" });
      }, i);
      await expect(title).toHaveText(expected[i]);
      await expect(page.locator(sections[i])).toHaveClass(/is-active/);
      // exactly one panel is showing at a time
      await expect(page.locator(".hud-panel.is-active")).toHaveCount(1);
    }

    // Scrolling is also what moves the car: a wheel flick raises the cruise target.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.mouse.move(400, 300);
    await page.mouse.wheel(0, 300);
    await expect
      .poll(() => page.evaluate(() => (window as any).__drive.engine.cruise.boost), { timeout: 10_000 })
      .toBeGreaterThan(1);
  });

  test("a panel taller than the glass scrolls inside the HUD before moving on", async ({ page }) => {
    await openDrive(page);
    const info = await page.evaluate(() => {
      const p = (window as any).__drive.hud.panels[1];
      return { start: p.start, lead: p.lead, overflow: p.overflow };
    });
    expect(info.overflow).toBeGreaterThan(100); // the About Me prose doesn't fit in one go

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), info.start + info.lead + info.overflow);
    await expect(page.locator("#bio")).toHaveClass(/is-active/);
    // the last paragraph has been brought up into view
    const last = page.locator("#bio .bio__content > p").last();
    await expect(last).toBeInViewport();
    const box = await last.boundingBox();
    const panel = await page.locator("#bio").boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(panel!.y + panel!.height + 1);
  });

  test("the theme toggle switches the drive between day and night", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openDrive(page);
    const night = () => page.evaluate(() => (window as any).__drive.engine.nightTarget);
    expect(await night()).toBe(0);
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(night).toBe(1);
  });

  test("classic view is one click away and is remembered", async ({ page }) => {
    await openDrive(page);
    await page.getByRole("button", { name: /classic page layout/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-view", "classic");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("#hero")).toHaveCSS("position", "relative");
    expect(await page.evaluate(() => localStorage.getItem("jl-view"))).toBe("classic");
    await expect(page.getByRole("button", { name: /3D driving view/i })).toBeVisible();
  });

  test("visitors who prefer reduced motion get the classic page by default", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE);
    await expect(page.locator("html")).toHaveAttribute("data-view", "classic");
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

test.describe("push-to-start game", () => {
  test("the start button on the dash starts the game; Escape hands the site back", async ({ page }) => {
    await openDrive(page);
    const start = page.getByRole("button", { name: /engine start/i });
    await expect(start).toBeVisible();
    await start.click();
    await expect(page.locator("html")).toHaveClass(/is-gaming/);
    expect(await stepUntil(page, "ready")).toBe("ready");
    await expect(page.locator(".game__speed b")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Accelerate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Brake" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("html")).not.toHaveClass(/is-gaming/);
    await expect(page.locator(".game")).toBeHidden();
    await expect(page.locator(".hud-panel.is-active")).toHaveCount(1);
  });

  test("throttle and brake are the only controls, and they work", async ({ page }) => {
    await openDrive(page);
    await page.getByRole("button", { name: /engine start/i }).click();
    await stepUntil(page, "ready");
    const speed = () => page.evaluate(() => (window as any).__drive.game.sim.v as number);
    const step = (n: number) =>
      page.evaluate((n) => {
        const d = (window as any).__drive;
        for (let i = 0; i < n; i++) d.engine.step(1 / 60);
      }, n);

    await page.keyboard.down("ArrowUp");
    await step(120); // two seconds of throttle
    const fast = await speed();
    expect(fast).toBeGreaterThan(8);
    await page.keyboard.up("ArrowUp");

    await page.keyboard.down("ArrowDown");
    await step(60); // one second of brake
    await page.keyboard.up("ArrowDown");
    expect(await speed()).toBeLessThan(fast - 5);
    expect(await page.evaluate(() => (window as any).__drive.game.state)).toBe("run");
  });

  test("falling off the road ends the run with a quote, and the run is cached on the leaderboard", async ({ page }) => {
    await openDrive(page);
    await page.evaluate((k) => localStorage.removeItem(k), BOARD_KEY);
    await page.getByRole("button", { name: /engine start/i }).click();
    await stepUntil(page, "ready");

    // Flat out with no braking: the first real bend throws the car off.
    await page.keyboard.down("KeyW");
    expect(await stepUntil(page, "over")).toBe("over");
    await page.keyboard.up("KeyW");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".game__kicker")).toHaveText("OFF THE ROAD");
    const firstQuote = (await dialog.locator(".game__quote").textContent())!.trim();
    expect(firstQuote.length).toBeGreaterThan(10);
    await expect(dialog.locator(".game__summary")).toContainText("You made it");
    await expect(dialog.locator(".game__record")).toHaveText(/new personal best/i);
    await expect(dialog.locator(".game__board tbody tr")).toHaveCount(1);

    const board = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), BOARD_KEY);
    expect(board).toHaveLength(1);
    expect(board[0].d).toBeGreaterThan(50); // metres
    expect(board[0].t).toBeGreaterThan(1); // seconds
    expect(board[0].top).toBeGreaterThan(20); // m/s

    // "Drive again" resets to the start line, and the next loss gets a different line.
    await dialog.getByRole("button", { name: /drive again/i }).click();
    expect(await stepUntil(page, "ready")).toBe("ready");
    expect(await page.evaluate(() => (window as any).__drive.game.sim.distance)).toBe(0);
    await page.keyboard.down("KeyW");
    await stepUntil(page, "over");
    await page.keyboard.up("KeyW");
    await expect(dialog).toBeVisible();
    const secondQuote = (await dialog.locator(".game__quote").textContent())!.trim();
    expect(secondQuote).not.toBe(firstQuote);
    await expect(dialog.locator(".game__board tbody tr")).toHaveCount(2);

    // The record survives a reload.
    await page.reload();
    const again = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), BOARD_KEY);
    expect(again).toHaveLength(2);
  });

  test("a driver who brakes for the bends gets well past the first one", async ({ page }) => {
    await openDrive(page);
    await page.getByRole("button", { name: /engine start/i }).click();
    await stepUntil(page, "ready");
    // Follow the HUD's own pace note: brake when it says so, otherwise go.
    const result = await page.evaluate(() => {
      const d = (window as any).__drive;
      const g = d.game;
      let frames = 0;
      while (frames < 60 * 45 && (g.state === "ready" || g.state === "run")) {
        const la = g.sim.lookahead();
        const brake = g.sim.v > la.allow * 0.97;
        g.keys.clear();
        g.keys.add(brake ? "brake" : "gas");
        d.engine.step(1 / 60);
        frames++;
      }
      g.keys.clear();
      return { state: g.state as string, metres: g.sim.distance as number, checkpoints: g.sim.checkpoints as number };
    });
    expect(result.state).toBe("run"); // still on the road after 45 simulated seconds
    expect(result.metres).toBeGreaterThan(1000);
    expect(result.checkpoints).toBeGreaterThanOrEqual(2);
  });
});
