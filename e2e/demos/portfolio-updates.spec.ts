import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8081";

test.describe("portfolio updates demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      document
        .querySelectorAll(".about__card, .project-card")
        .forEach((el) => el.classList.add("visible"));
    });
  });

  test("no Capitol-Watch references remain anywhere on the page", async ({ page }) => {
    const hits = await page.evaluate(
      () => (document.documentElement.innerHTML.match(/Capitol/gi) || []).length,
    );
    expect(hits).toBe(0);
  });

  test("VoteHound side-project card uses the new preview screenshot", async ({ page }) => {
    const card = page.locator(".project-card", { hasText: "VoteHound" });
    const img = card.locator("img");
    await expect(img).toHaveAttribute("src", /votehound-preview\.png/);
    const natural = await img.evaluate((el: HTMLImageElement) => ({
      w: el.naturalWidth,
      h: el.naturalHeight,
    }));
    // The new screenshot is wider than the old retired preview; assert > 1000px
    // so this fails if someone reverts to a small/missing asset.
    expect(natural.w).toBeGreaterThan(1000);
    expect(natural.h).toBeGreaterThan(500);
  });

  test("VoteHound blurb no longer mentions Capitol-Watch", async ({ page }) => {
    const card = page.locator(".project-card", { hasText: "VoteHound" });
    await expect(card).toContainText("Real-time congressional activity tracker.");
    await expect(card).not.toContainText("formerly");
  });

  test("ticker contains the four new professional items, each flagged NEW", async ({ page }) => {
    const expectedNewTexts = [
      "Evaluating which Scrum ceremonies remain essential in an AI-assisted workflow",
      "Deploying coordinated agent teams via Claude Code remote-control mode",
      "Building agents and AI tooling for research and discovery workflows",
      "Deepening expertise in agent harness design, token management, and model selection",
    ];

    for (const text of expectedNewTexts) {
      const item = page.locator(".ticker__item--new", { hasText: text }).first();
      await expect(item).toBeVisible();
    }
  });

  test("retired ticker entries are gone", async ({ page }) => {
    // The "Capitol-Watch is now VoteHound" rename announcement was removed.
    await expect(page.locator(".ticker__item", { hasText: "Capitol-Watch is now VoteHound" })).toHaveCount(0);
    // The duplicate "votehound.com now live" entry was removed in favor of the current-state line.
    await expect(page.locator(".ticker__item", { hasText: "now live" })).toHaveCount(0);
  });

  test("ticker VoteHound + Endorsements entries are no longer flagged NEW", async ({ page }) => {
    const voteEntry = page.locator(".ticker__item", { hasText: "votehound.com — congressional activity tracker" }).first();
    const endorseEntry = page.locator(".ticker__item", { hasText: "endorsements.app — merit backed by real people" }).first();
    await expect(voteEntry).toBeVisible();
    await expect(endorseEntry).toBeVisible();
    await expect(voteEntry).not.toHaveClass(/ticker__item--new/);
    await expect(endorseEntry).not.toHaveClass(/ticker__item--new/);
  });
});
