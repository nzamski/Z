import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

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
  await page.getByRole("textbox", { name: "מה חדש?" }).fill(`פוסט בדיקה ${stamp}`);
  await page.getByRole("button", { name: "פרסום" }).click();
  const card = page.locator("li", { hasText: `פוסט בדיקה ${stamp}` });
  await expect(card).toBeVisible();

  // Open it and edit.
  await card.getByText(`פוסט בדיקה ${stamp}`).click(); // clicking the card opens the post
  await expect(page).toHaveURL(/\/p\//);
  const article = page.locator("article");
  await article.getByRole("button", { name: "עריכה" }).click();
  await article.getByRole("textbox").fill(`פוסט ערוך ${stamp}`);
  await article.getByRole("button", { name: "שמירה" }).click();
  await expect(article).toContainText(`פוסט ערוך ${stamp}`);
  await expect(article).toContainText("נערך");

  // Comment, then reply to it.
  await page.getByRole("textbox", { name: "כתבו תגובה…" }).fill("תגובת אב");
  await page.getByRole("button", { name: "שליחה" }).click();
  const parent = page.locator("li[id^=c-]", { hasText: "תגובת אב" });
  await expect(parent).toBeVisible();
  await parent.getByRole("button", { name: "תשובה" }).first().click();
  await parent.getByRole("textbox", { name: "כתבו תשובה…" }).fill("תשובת בן");
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

  // Back arrow: the previous page in the app (the post), not always home.
  await page.getByRole("link", { name: "חזרה" }).click();
  await expect(page).toHaveURL(/\/p\//);

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
  // There's no logout button; the route still exists. POST it from the page, like a form would.
  await page.evaluate(() => {
    const f = Object.assign(document.createElement("form"), {
      method: "post",
      action: "/auth/logout",
    });
    document.body.append(f);
    f.submit();
  });
  await expect(page.locator("#username")).toBeVisible(); // back at the Keycloak login
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
  const latest = page.getByRole("button", { name: "אחרונים" });
  await latest.click(); // Latest: seed has > 1 page
  await expect(latest).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL("http://localhost:3000/"); // the tab is a cookie, not the URL
  const cards = page.locator("main > ul > li");
  await expect(cards).toHaveCount(20);

  // Long posts expand in place.
  const longIds = await cards.evaluateAll((lis) =>
    lis.map((li, i) => (li.textContent?.includes("הצגת עוד") ? i : -1)).filter((i) => i >= 0),
  );
  const long = cards.nth(longIds[0]);
  const text = long.locator("p").first();
  const before = (await text.innerText()).replace(/…$/, "").length;
  await long.getByRole("link", { name: "הצגת עוד" }).click();
  await expect(long.getByRole("link", { name: "הצגת עוד" })).toHaveCount(0);
  expect((await text.innerText()).length).toBeGreaterThan(before);
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.mouse.wheel(0, 20_000);
  await expect.poll(() => cards.count()).toBeGreaterThan(20);

  const target = cards.nth(25);
  await target.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  const count = await cards.count();
  await target.locator("p").first().click();
  await expect(page).toHaveURL(/\/p\//);
  await page.goBack();
  await expect(latest).toHaveAttribute("aria-pressed", "true");
  // Nothing lost (infinite scroll may already be loading the next page near the bottom).
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(count);
  await expect(target).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y / 2); // not reset to the top
});

test("tab survives a new session; logo on home reloads to the top", async ({ browser }) => {
  const first = await browser.newContext();
  const page = await first.newPage();
  await login(page, "noa");
  await page.getByRole("button", { name: "נעקבים" }).click();
  await expect(page.getByRole("button", { name: "נעקבים" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const state = await first.storageState(); // persistent cookies, like a browser restart
  await first.close();

  const second = await browser.newContext({ storageState: state });
  const again = await second.newPage();
  await again.goto("/");
  await expect(again.getByRole("button", { name: "נעקבים" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await again.getByRole("button", { name: "בשבילך" }).click();
  await expect(again.getByRole("button", { name: "בשבילך" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await again.mouse.wheel(0, 3000);
  await expect.poll(() => again.evaluate(() => scrollY)).toBeGreaterThan(500);
  await again.getByRole("link", { name: "לדף הבית" }).click();
  await again.waitForLoadState("load");
  await expect.poll(() => again.evaluate(() => scrollY)).toBe(0);
  await second.close();
});

test("new posts by others show a pill that refreshes the feed", async ({ browser }) => {
  const reader = await (await browser.newContext()).newPage();
  const writer = await (await browser.newContext()).newPage();
  await login(reader, "dana");
  await login(writer, "yossi");
  const stamp = `חדש ${Date.now()}`;
  await writer.getByRole("textbox", { name: "מה חדש?" }).fill(stamp);
  await writer.getByRole("button", { name: "פרסום" }).click();
  await expect(writer.locator("li", { hasText: stamp })).toBeVisible();

  await expect(reader.locator("li", { hasText: stamp })).toHaveCount(0);
  await reader.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); // skip the 60s poll
  const pill = reader.getByRole("button", { name: /פוסט חדש|פוסטים חדשים/ });
  await pill.click();
  await expect(pill).toHaveCount(0);
  await expect(reader.locator("main > ul > li").first()).toContainText(stamp);
});

test("edit your own bio in the profile popup", async ({ page }) => {
  await login(page, "dana");
  await page.goto("/u/dana");
  await expect(page.getByText(/^מאז /)).toBeVisible();
  await page.getByRole("button", { name: "עריכת פרופיל" }).click();
  const dialog = page.getByRole("dialog", { name: "עריכת פרופיל" });
  await expect(dialog).toBeVisible();
  const bio = `ביו ${Date.now()}`;
  await dialog.getByLabel("ביו").fill(bio);
  await dialog.getByRole("button", { name: "שמירה" }).click();
  await expect(dialog).toBeHidden(); // saved and closed
  await expect(page.locator("section p", { hasText: bio })).toBeVisible();
  await page.reload();
  await expect(page.locator("section p", { hasText: bio })).toBeVisible();
  // Esc closes without saving.
  await page.getByRole("button", { name: "עריכת פרופיל" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.goto("/u/yossi");
  await expect(page.getByRole("button", { name: "עריכת פרופיל" })).toHaveCount(0);
});

test("search finds posts by Hebrew word forms; profiles link to the chat", async ({ page }) => {
  await login(page, "noa");
  await page.getByRole("link", { name: "חיפוש" }).click();
  const box = page.getByRole("searchbox", { name: "חיפוש" });
  await expect(box).toBeFocused();
  await box.fill("הלוגים"); // seed has "העברנו את הלוגים ל-JSON..."; prefix ה is stripped too
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  const hit = page.locator("main > ul > li", { hasText: "JSON" }).first();
  await expect(hit).toBeVisible();
  await hit.locator("p").first().click();
  await expect(page).toHaveURL(/\/p\//);

  await page.goto("/search?q=zzzzqqq");
  await expect(page.getByText(/לא נמצאו תוצאות/)).toBeVisible();

  // People: by @handle prefix, shown above the posts.
  await page.goto("/search?q=%40yos");
  const people = page.locator("section", { has: page.getByRole("heading", { name: "אנשים" }) });
  await expect(people.getByRole("link", { name: /יוסי/ })).toBeVisible();

  await page.goto("/u/yossi");
  await expect(page.getByRole("link", { name: "הודעה פרטית" })).toHaveAttribute(
    "href",
    "chat://user/yossi",
  );
  await page.goto("/u/noa");
  await expect(page.getByRole("link", { name: "הודעה פרטית" })).toHaveCount(0);
});

test("first login: welcome, profile with a live handle check, follow suggestions", async ({
  page,
}) => {
  // Make noa a first-time user again: no handle, welcome not done (the seed sets both).
  try {
    process.loadEnvFile();
  } catch {}
  const NOA = "33333333-3333-4333-8333-333333333333"; // keycloak_sub, dev/keycloak/realm-z.json
  const sql = postgres(process.env.DATABASE_URL!);
  await sql`update users set onboarded_at = null, handle = null where keycloak_sub = ${NOA}`;

  await page.goto("/");
  await page.locator("#username").fill("noa");
  await page.locator("#password").fill("noa");
  await page.locator("#kc-login").click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("heading", { name: "ברוכים הבאים ל־Z" })).toBeVisible();
  // Mandatory: no skip, and nothing else is reachable yet.
  await expect(page.getByRole("button", { name: "דילוג" })).toHaveCount(0);
  await page.goto("/u/yossi");
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("button", { name: "המשך" })).toBeDisabled(); // no handle yet

  const handle = page.getByLabel("שם משתמש");
  await expect(page.getByLabel("שם תצוגה")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("שם תצוגה")).toHaveValue("נועה מזרחי");
  const next = page.getByRole("button", { name: "המשך" });
  await handle.fill("dana");
  await expect(page.getByText("שם המשתמש הזה כבר תפוס")).toBeVisible();
  await expect(next).toBeDisabled();
  await handle.fill("1abc");
  await expect(page.getByText(/3–15 תווים/)).toBeVisible();
  const fresh = `noa_${Date.now().toString(36).slice(-6)}`;
  await handle.fill(fresh);
  await expect(page.getByText("שם המשתמש פנוי")).toBeVisible();
  await next.click();

  await expect(page.getByRole("heading", { name: "אחרי מי לעקוב?" })).toBeVisible();
  // Follow, then unfollow the same person: the row stays put.
  const first = page.locator("main li").first();
  const name = await first.locator("span").first().innerText();
  await first.getByRole("button", { name: "מעקב", exact: true }).click();
  await expect(first.getByRole("button", { name: "הפסקת מעקב" })).toBeVisible();
  await page.waitForTimeout(800); // the follow's refresh lands
  await expect(page.locator("main li").first()).toContainText(name);
  await first.getByRole("button", { name: "הפסקת מעקב" }).click();
  await expect(first.getByRole("button", { name: "מעקב", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "בואו נתחיל" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("link", { name: `@${fresh}` })).toBeVisible();

  // Change it again from the profile popup; the page follows the new handle.
  await page.goto(`/u/${fresh}`);
  await page.getByRole("button", { name: "עריכת פרופיל" }).click();
  const dialog = page.getByRole("dialog", { name: "עריכת פרופיל" });
  const again = `${fresh}x`;
  await dialog.getByLabel("שם משתמש").fill(again);
  await expect(dialog.getByText("שם המשתמש פנוי")).toBeVisible();
  await dialog.getByRole("button", { name: "שמירה" }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${again}$`));
  // Back to "noa" for the other tests.
  await sql`update users set handle = 'noa' where keycloak_sub = ${NOA}`;
  await sql.end();

  // Done: the welcome doesn't come back.
  await page.goto("/welcome");
  await expect(page).toHaveURL("http://localhost:3000/");
});

test("followers and following lists", async ({ page }) => {
  await login(page, "dana");
  // From the hover card...
  await page.locator("li a[href='/u/yossi']").first().hover();
  const card = page.getByRole("dialog", { name: /יוסי/ });
  await card.getByRole("link", { name: /נעקבים/ }).click();
  await expect(page).toHaveURL(/\/u\/yossi\/following$/);
  // ...and from the profile.
  await page.goto("/u/yossi");
  await page.getByRole("link", { name: /עוקבים/ }).click();
  await expect(page).toHaveURL(/\/u\/yossi\/followers$/);
  // Back to the feed: the card that led here must not come back open.
  await page.goto("/");
  await page.locator("li a[href='/u/yossi']").first().hover();
  await page.getByRole("dialog", { name: /יוסי/ }).getByRole("link", { name: /יוסי/ }).click();
  await expect(page).toHaveURL(/\/u\/yossi$/);
  await page.mouse.move(5, 5);
  await page.goBack();
  await expect(page).toHaveURL("http://localhost:3000/");
  await page.waitForTimeout(600);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/u/yossi");
  await expect(page.locator("main li").first()).toBeVisible();
  await page.getByRole("link", { name: "נעקבים" }).click();
  await expect(page).toHaveURL(/\/u\/yossi\/following$/);
  await expect(page.getByRole("link", { name: "נעקבים" })).toHaveAttribute("aria-current", "page");
});

test("tab titles follow the page, X-style", async ({ page }) => {
  await login(page, "dana");
  await expect(page).toHaveTitle("בית / Z");
  await page.goto("/u/yossi");
  await expect(page).toHaveTitle(/^יוסי \S+ \(@yossi\) \/ Z$/);
  await page.goto("/u/yossi/followers");
  await expect(page).toHaveTitle(/^העוקבים של יוסי \S+ \(@yossi\) \/ Z$/);
  await page.goto("/search?q=Postgres");
  await expect(page).toHaveTitle("Postgres – חיפוש / Z");
  await page.goto("/");
  await page.locator("main > ul > li").first().locator("p").first().click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page).toHaveTitle(/^.+ ב־Z: ".+" \/ Z$/);
  await page.goto("/no/such/page");
  await expect(page).toHaveTitle("העמוד לא נמצא / Z");
});
