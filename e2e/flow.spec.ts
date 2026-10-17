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
  await card.getByRole("link", { name: /תגובות/ }).click();
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
  await expect(article).toContainText("2 תגובות");

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
  await expect(article).toContainText("1 תגובות");

  // Like, unlike, like.
  const like = article.getByRole("button", { name: /לייק/ });
  for (const [pressed, count] of [
    ["true", "1"],
    ["false", "0"],
    ["true", "1"],
  ]) {
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", pressed);
    await expect(like).toContainText(count);
    await expect(like).toHaveAttribute("aria-busy", "false"); // saved on the server
  }
  await page.reload();
  await expect(page.locator("article").getByRole("button", { name: /לייק/ })).toContainText(
    "1 לייקים",
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

  // Hover card on an author's name.
  await page.goto("/");
  await page.locator("li a[href='/u/yossi']").first().hover();
  const hoverCard = page.getByRole("dialog", { name: /יוסי/ });
  await expect(hoverCard).toContainText("@yossi");
  await expect(hoverCard).toContainText("עוקבים");
  await expect(hoverCard.getByRole("button", { name: "הפסקת מעקב" })).toBeVisible();

  // Logout through Keycloak end-session; with no session the app goes straight back to login.
  await page.getByRole("button", { name: "התנתקות" }).click();
  await expect(page.locator("#username")).toBeVisible();
  await page.goto("/u/dana");
  await expect(page.locator("#username")).toBeVisible();
});
