import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8081";

test.describe("About Me section demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test("bio section sits between the hero and tech stack", async ({ page }) => {
    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll("body > section")).map((s) => s.id),
    );
    expect(order.indexOf("bio")).toBe(order.indexOf("hero") + 1);
    expect(order.indexOf("stack")).toBe(order.indexOf("bio") + 1);
  });

  test("renders the full prose: title, five paragraphs, four enablement bullets", async ({ page }) => {
    const bio = page.locator("#bio");
    await expect(bio.getByRole("heading", { name: "About Me" })).toBeVisible();
    await expect(bio.locator(".bio__content > p")).toHaveCount(5);
    await expect(bio.locator(".bio__list li")).toHaveCount(4);
    await expect(bio).toContainText("MCP registry");
    await expect(bio).toContainText("idea to MVP");
  });

  test("links to votehound.com and endorsements.app open in a new tab", async ({ page }) => {
    const bio = page.locator("#bio");
    const votehound = bio.getByRole("link", { name: "votehound.com" });
    const endorsements = bio.getByRole("link", { name: "endorsements.app" });
    await expect(votehound).toHaveAttribute("href", "https://votehound.com");
    await expect(endorsements).toHaveAttribute("href", "https://endorsements.app");
    for (const link of [votehound, endorsements]) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener");
    }
  });

  test("content fades in when scrolled into view", async ({ page }) => {
    const content = page.locator(".bio__content");
    // Above the fold the observer hasn't fired yet.
    await expect(content).not.toHaveClass(/visible/);
    await content.scrollIntoViewIfNeeded();
    await expect(content).toHaveClass(/visible/);
    const opacity = await content.evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
  });

  test("section follows the active theme in light and dark mode", async ({ page }) => {
    const bg = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(BASE);
    const lightBg = await bg();

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(BASE);
    const darkBg = await bg();

    expect(lightBg).toBe("rgb(244, 241, 234)"); // --bg light
    expect(darkBg).toBe("rgb(22, 19, 15)"); // --bg dark
  });
});
