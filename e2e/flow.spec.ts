import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// PLAN.md M2: login → post → edit → comment → reply → delete parent → like/unlike/like → follow → logout.

async function login(page: Page, user: string) {
  await page.goto("/"); // no session: the proxy sends us straight to Keycloak
  await page.locator("#username").fill(user);
  await page.locator("#password").fill(user);
  await page.locator("#kc-login").click();
  await expect(page.getByRole("link", { name: `@${user}` })).toBeVisible();
}

test("full M2 flow through Keycloak", async ({ page }) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await login(page, "dana");

  // Post.
  await page.getByPlaceholder("מה חדש?").fill(`פוסט בדיקה ${stamp}`);
  await page.getByRole("button", { name: "פרסום" }).click();
  const card = page.locator("li", { hasText: `פוסט בדיקה ${stamp}` });
  await expect(card).toBeVisible();

  // Open it and edit.
  await card.getByText(`פוסט בדיקה ${stamp}`).click(); // clicking the card opens the post
  await expect(page).toHaveURL(/\/p\//);
  const article = page.locator("article");
  await article.getByRole("button", { name: "עריכה" }).click();
  await article.locator("textarea").fill(`פוסט ערוך ${stamp}`);
  await article.getByRole("button", { name: "שמירה" }).click();
  await expect(article).toContainText(`פוסט ערוך ${stamp}`);
  await expect(article).toContainText("נערך");

  // Comment, then reply to it.
  await page.getByPlaceholder("כתבו תגובה…").fill("תגובת אב");
  await page.getByRole("button", { name: "שליחה" }).click();
  const parent = page.locator("li[id^=c-]", { hasText: "תגובת אב" });
  await expect(parent).toBeVisible();
  await parent.getByRole("button", { name: "תשובה" }).first().click();
  await parent.getByPlaceholder("כתבו תשובה…").fill("תשובת בן");
  await parent.getByRole("button", { name: "שליחה" }).click();
  await expect(parent.locator("li[id^=c-]", { hasText: "תשובת בן" })).toBeVisible();
  await expect(article.getByRole("link", { name: "2 תגובות" })).toBeVisible();

  // Delete the parent: placeholder stays, reply survives, count drops by one.
  const parentId = await parent.getAttribute("id");
  const parentActions = page
    .locator(`#${parentId} > div`)
    .filter({ has: page.getByRole("button", { name: "תשובה" }) })
    .first();
  await parentActions.getByRole("button", { name: "מחיקה" }).click();
  await parentActions.getByRole("button", { name: "מחיקה" }).click();
  const placeholder = page.locator(`#${parentId}`);
  await expect(placeholder).toContainText("[נמחק]");
  await expect(placeholder).not.toContainText("תגובת אב");
  await expect(placeholder).toContainText("תשובת בן");
  await expect(article.getByRole("link", { name: "1 תגובות" })).toBeVisible();

  // Like, unlike, like.
  const like = article.getByRole("button", { name: /לייק/ });
  for (const [pressed, count] of [
    ["true", "1"],
    ["false", "0"],
    ["true", "1"],
  ]) {
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", pressed);
    await expect(like).toHaveAccessibleName(new RegExp(` ${count} לייקים`));
    await expect(like).toHaveAttribute("aria-busy", "false"); // saved on the server
  }
  await page.reload();
  await expect(page.locator("article").getByRole("button", { name: /לייק/ })).toHaveAccessibleName(
    /ביטול לייק · 1 לייקים/,
  );

  // Follow, persisted across reload.
  await page.goto("/u/yossi");
  const unfollow = page.getByRole("button", { name: "הפסקת מעקב" });
  const follow = page.getByRole("button", { name: "מעקב", exact: true });
  await expect(follow.or(unfollow)).toBeVisible();
  if (await unfollow.isVisible()) {
    await unfollow.click(); // left over from an earlier run
    await expect(follow).toBeVisible();
    await page.reload();
  }
  await follow.click();
  await expect(page.getByRole("button", { name: "הפסקת מעקב" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "הפסקת מעקב" })).toBeVisible();

  // Back-to-home arrow on every non-home page.
  await page.getByRole("link", { name: "לדף הבית" }).first().click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // Hover card on an author's name.
  await page.goto("/");
  await page.locator("li a[href='/u/yossi']").first().hover();
  const hoverCard = page.getByRole("dialog", { name: /יוסי/ });
  await expect(hoverCard).toContainText("@yossi");
  await expect(hoverCard).toContainText("עוקבים");
  // Unfollow and re-follow from the card; the state must stick (card used to revert on re-hover).
  await hoverCard.getByRole("button", { name: "הפסקת מעקב" }).click();
  await page.waitForTimeout(1000);
  await expect(hoverCard.getByRole("button", { name: "מעקב", exact: true })).toBeVisible();
  await hoverCard.getByRole("button", { name: "מעקב", exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(hoverCard.getByRole("button", { name: "הפסקת מעקב" })).toBeVisible();

  // Logout through Keycloak end-session; with no session the app goes straight back to login.
  // There's no logout button; the route still exists. The request shares the browser's cookies.
  await page.request.post("/auth/logout");
  await page.goto("/");
  await expect(page.locator("#username")).toBeVisible();
  await page.goto("/u/dana");
  await expect(page.locator("#username")).toBeVisible();
});

test("a session whose user vanished (dev reseed) re-logs in instead of failing writes", async ({
  page,
}) => {
  await login(page, "noa");
  execSync("npm run seed", { stdio: "ignore" }); // new user ids; noa's cookie now points nowhere
  await page.goto("/u/yossi"); // bounces through Keycloak (SSO still active) and back in
  await expect(page.getByRole("link", { name: "@noa" })).toBeVisible();
  await page.goto("/u/yossi");
  const follow = page.getByRole("button", { name: "מעקב", exact: true });
  const unfollow = page.getByRole("button", { name: "הפסקת מעקב" });
  await expect(follow.or(unfollow)).toBeVisible();
  const wasFollowing = await unfollow.isVisible();
  await (wasFollowing ? unfollow : follow).click();
  await expect(wasFollowing ? follow : unfollow).toBeVisible();
  await page.reload();
  await expect(wasFollowing ? follow : unfollow).toBeVisible(); // saved, not a 500
});

test("feed: infinite scroll, then back from a post restores the list and position", async ({
  page,
}) => {
  await login(page, "yossi");
  await page.getByRole("link", { name: "אחרונים" }).click(); // Latest: seed has > 1 page
  await expect(page).toHaveURL(/view=latest/);
  const cards = page.locator("main > ul > li");
  await expect(cards).toHaveCount(20);
  await page.mouse.wheel(0, 20_000);
  await expect.poll(() => cards.count()).toBeGreaterThan(20);

  const target = cards.nth(25);
  await target.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  const count = await cards.count();
  await target.locator(".md").click();
  await expect(page).toHaveURL(/\/p\//);
  await page.goBack();
  await expect(page).toHaveURL(/view=latest/);
  await expect(cards).toHaveCount(count);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y - 50);
});
