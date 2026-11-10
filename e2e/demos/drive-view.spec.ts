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

/**
 * The start button is a real <button> that rides on the 3D one, so it drifts
 * with the camera whenever the road bends. Click it where it is rather than
 * waiting for it to hold still.
 */
async function pressStart(page: Page) {
  const start = page.getByRole("button", { name: /engine start/i });
  await expect(start).toBeVisible();
  await start.click({ force: true });
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
    // no photo of the owner anywhere on the page
    await expect(page.locator("#hero img")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.innerHTML.includes("IMG_"))).toBe(false);

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
    await pressStart(page);
    await expect(page.locator("html")).toHaveClass(/is-gaming/);
    expect(await stepUntil(page, "ready")).toBe("ready");
    await expect(page.locator(".game__speed b")).toHaveText("0");
    await expect(page.locator(".game__stat--dist b")).toHaveText("3.00"); // three miles to the café
    await expect(page.locator(".game__pedal")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("html")).not.toHaveClass(/is-gaming/);
    await expect(page.locator(".game")).toBeHidden();
    await expect(page.locator(".hud-panel.is-active")).toHaveCount(1);
  });

  test("keyboard: throttle and brake are the only controls, and they work", async ({ page }) => {
    await openDrive(page);
    await pressStart(page);
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

  test("touch: holding anywhere on the screen accelerates, letting go brakes", async ({ page }) => {
    await openDrive(page);
    await pressStart(page);
    await stepUntil(page, "ready");
    const speed = () => page.evaluate(() => (window as any).__drive.game.sim.v as number);
    const step = (n: number) =>
      page.evaluate((n) => {
        const d = (window as any).__drive;
        for (let i = 0; i < n; i++) d.engine.step(1 / 60);
      }, n);

    // press and hold in the middle of the glass: no pedal to aim for
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await step(120);
    const fast = await speed();
    expect(fast).toBeGreaterThan(8);
    await expect(page.locator(".game__pedal")).toHaveAttribute("data-state", "gas");

    await page.mouse.up();
    await step(60);
    expect(await speed()).toBeLessThan(fast - 5);
    await expect(page.locator(".game__pedal")).toHaveAttribute("data-state", "brake");
  });

  test("falling off the road ends the run with a quote, and the run is cached on the leaderboard", async ({ page }) => {
    await openDrive(page);
    await page.evaluate((k) => localStorage.removeItem(k), BOARD_KEY);
    await pressStart(page);
    await stepUntil(page, "ready");

    // Flat out with no braking: the first real bend throws the car off.
    await page.keyboard.down("KeyW");
    expect(await stepUntil(page, "over")).toBe("over");
    await page.keyboard.up("KeyW");

    const dialog = page.locator(".game__over");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".game__kicker")).toHaveText("OFF THE ROAD");
    const firstQuote = (await dialog.locator(".game__quote").textContent())!.trim();
    expect(firstQuote.length).toBeGreaterThan(10);
    await expect(dialog.locator(".game__summary")).toContainText("You made it");
    await expect(dialog.locator(".game__record")).toHaveText(/new personal best/i);
    await expect(dialog.locator(".game__board tbody tr")).toHaveCount(1);

    const board = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), BOARD_KEY);
    expect(board).toHaveLength(1);
    expect(board[0].why).toBe("fell");
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

  test("three miles of braking for the bends ends parked at the café, with a cortado to make", async ({ page }) => {
    test.setTimeout(180_000);
    await openDrive(page);
    await page.evaluate((k) => localStorage.removeItem(k), BOARD_KEY);
    await pressStart(page);
    await stepUntil(page, "ready");

    // Drive by the HUD's own pace note: hold the throttle unless it says brake.
    const drive = await page.evaluate(() => {
      const d = (window as any).__drive;
      const g = d.game;
      let frames = 0;
      while (frames < 60 * 400 && (g.state === "ready" || g.state === "run")) {
        const la = g.sim.lookahead();
        g.keys.clear();
        g.keys.add(g.sim.v > la.allow * 0.93 ? "brake" : "gas");
        d.engine.step(1 / 60);
        frames++;
      }
      g.keys.clear();
      return { state: g.state as string, miles: g.sim.distance / 1609.344, seconds: g.sim.time as number };
    });
    expect(drive.state).toBe("arrive"); // crossed the line without leaving the road
    expect(drive.miles).toBeCloseTo(3, 2);
    expect(drive.seconds).toBeGreaterThan(150); // "about three minutes"
    expect(drive.seconds).toBeLessThan(240);

    // The car brings itself into the lot and stops nose-in at the building.
    expect(await stepUntil(page, "parked", 3000)).toBe("parked");
    const parked = await page.evaluate(() => {
      const c = (window as any).__drive.engine.car;
      return { v: c.v as number, off: c.off as number, yaw: c.yaw as number };
    });
    expect(parked.v).toBe(0);
    expect(parked.off).toBeGreaterThan(6); // well off the asphalt
    expect(parked.yaw).toBeGreaterThan(0.3); // turned in toward the café

    // Then the espresso bar: five stations, each "hold, then let go".
    expect(await stepUntil(page, "cafe", 600)).toBe("cafe");
    const cafe = page.locator(".cafe");
    await expect(cafe).toBeVisible();
    const hold = (seconds: number) =>
      page.evaluate((seconds) => {
        const d = (window as any).__drive;
        const c = d.game.cafe;
        const stage = c.stage;
        c.keyHold = true;
        for (let t = 0; t < seconds && c.stage === stage && c.phase === "play"; t += 1 / 60) d.engine.step(1 / 60);
        c.keyHold = false;
        for (let n = 0; n < 300 && c.active && c.stage === stage; n++) d.engine.step(1 / 60);
        return c.active ? (c.stage as number) : -1;
      }, seconds);
    await expect(cafe.locator(".cafe__title")).toHaveText("Grind");
    expect(await hold(3.33)).toBe(1); // 18 g
    await expect(cafe.locator(".cafe__title")).toHaveText("Tamp");
    expect(await hold(0.92)).toBe(2); // 30 lb
    await expect(cafe.locator(".cafe__title")).toHaveText("Pull the shot");
    expect(await hold(6.25)).toBe(3); // 36 g in ~27 s
    await expect(cafe.locator(".cafe__title")).toHaveText("Steam the milk");
    expect(await hold(4.2)).toBe(4); // just shy of 140°F
    await expect(cafe.locator(".cafe__title")).toHaveText("Pour the cortado");
    await expect(cafe.locator(".cafe__chips li")).toHaveCount(4);

    // The pour: milk into the middle of the glass until it's full leaves real latte art behind.
    const art = await page.evaluate(() => {
      const d = (window as any).__drive;
      const c = d.game.cafe;
      const cup = c._cup();
      c.pointer.x = cup.x;
      c.pointer.y = cup.y;
      c.pointer.seen = true;
      c.hold = true;
      for (let n = 0; n < 600 && c.stage === 4 && c.phase === "play"; n++) d.engine.step(1 / 60);
      c.hold = false;
      const foam: Float32Array = c.pour.foam;
      let white = 0;
      for (let i = 0; i < foam.length; i++) if (foam[i] > 0.5) white++;
      return { white: white / foam.length, score: c.scores.art as number };
    });
    expect(art.white).toBeGreaterThan(0.08); // a visible blob of microfoam…
    expect(art.white).toBeLessThan(0.7); // …sitting in crema, not a glass of milk
    expect(art.score).toBeGreaterThan(0.5);

    // Result: the arrival card, with the drive time and the cortado score, saved to the board.
    expect(await stepUntil(page, "over", 600)).toBe("over");
    const dialog = page.locator(".game__over");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".game__kicker")).toContainText("ARRIVED");
    await expect(dialog.locator(".game__cup")).toBeVisible();
    await expect(dialog.locator(".game__cup-img")).toHaveJSProperty("complete", true);
    await expect(dialog.locator(".game__board tbody tr").first()).toContainText("Café");
    const board = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), BOARD_KEY);
    expect(board).toHaveLength(1);
    expect(board[0].why).toBe("cafe");
    expect(board[0].t).toBeCloseTo(drive.seconds, 0);
    expect(board[0].cup).toBeGreaterThan(70);

    // Back to the site: the car pulls out of the lot and the HUD returns.
    await dialog.getByRole("button", { name: /back to the site/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/is-gaming/);
    await expect(page.locator(".hud-panel.is-active")).toHaveCount(1);
  });

  test("a café finish outranks any crash on the leaderboard, however far the crash got", async ({ page }) => {
    await openDrive(page);
    await page.evaluate((k) => {
      localStorage.setItem(
        k,
        JSON.stringify([
          { d: 4700, t: 150, top: 50, at: Date.now() - 1000, why: "fell" },
          { d: 4828, t: 230, top: 40, at: Date.now() - 500, why: "cafe", cup: 61 },
          { d: 4828, t: 195, top: 45, at: Date.now(), why: "cafe" },
        ]),
      );
    }, BOARD_KEY);
    const order = await page.evaluate(() => (window as any).__drive.game.board().map((r: any) => `${r.why}:${r.t}`));
    expect(order).toEqual(["cafe:195", "cafe:230", "fell:150"]);
  });
});
