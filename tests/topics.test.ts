import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@/db/client";
import { extractTags, renderMarkdown } from "@/lib/markdown";
import * as s from "@/lib/services";
import { isTag, splitTags } from "@/lib/tags";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

// A topic no other test (or earlier run: the test DB keeps rows) uses.
const fresh = () =>
  `t${Array.from(randomBytes(8), (b) => String.fromCharCode(97 + (b % 26))).join("")}`;
const tagsOf = (text: string) => splitTags(text).flatMap((p) => ("tag" in p ? [p.tag] : []));

describe("#tags in text", () => {
  test.each([
    ["at the start", "#kubernetes is great", ["kubernetes"]],
    ["Hebrew", "שדרגנו את #תשתיות היום", ["תשתיות"]],
    ["one spelling per topic", "#K8s and #k8s", ["k8s", "k8s"]],
    ["trailing punctuation is not part of it", "ראו #postgres.", ["postgres"]],
    ["inner hyphens", "#ci-cd pipelines", ["ci-cd"]],
    ["not a URL fragment", "page#section", []],
    ["not an issue number", "fixes #123", []],
    ["not too long", `#${"a".repeat(31)}`, []],
  ])("%s", (_, text, tags) => {
    expect(tagsOf(text)).toEqual(tags);
  });

  test("valid tags (URLs, search)", () => {
    expect(isTag("k8s")).toBe(true);
    expect(isTag("תשתיות")).toBe(true);
    expect(isTag("1abc")).toBe(false);
    expect(isTag("a b")).toBe(false);
  });

  test("rendered as topic links, not inside code or links", () => {
    const html = renderMarkdown("#k8s ו־`#notatag` ו־[#alsonot](https://example.com)");
    expect(html).toMatch(/<a href="\/t\/k8s" class="tag"[^>]*>#k8s<\/a>/);
    expect(html).not.toContain("/t/notatag");
    expect(html).not.toContain("/t/alsonot");
  });

  test("extractTags: normalized, unique, Hebrew decoded", () => {
    expect(extractTags("#K8s #k8s #תשתיות `#code`")).toEqual(["k8s", "תשתיות"]);
  });
});

describe("topics", () => {
  test("a post is filed under its tags; an edit moves it; deleted posts drop out", async () => {
    const [a, b] = [fresh(), fresh()];
    const u = await makeUser();
    const post = await s.createPost(u.id, `שאלה על #${a}`);
    const inTopic = async (tag: string) =>
      (await s.feedPage(u.id, { view: "latest", tag })).items.map((x) => x.id);
    expect(await inTopic(a)).toEqual([post.id]);
    expect((await s.topicInfo(u.id, a)).posts).toBe(1);

    await s.editPost(u.id, post.id, `בעצם על #${b}`);
    expect(await inTopic(a)).toEqual([]);
    expect(await inTopic(b)).toEqual([post.id]);

    await s.deletePost(u.id, post.id);
    expect(await inTopic(b)).toEqual([]);
    expect((await s.topicInfo(u.id, b)).posts).toBe(0);
  });

  test("most liked sort", async () => {
    const tag = fresh();
    const [u, fan] = [await makeUser(), await makeUser()];
    const quiet = await s.createPost(u.id, `#${tag} שקט`);
    const liked = await s.createPost(u.id, `#${tag} אהוב`);
    await s.likePost(fan.id, liked.id);
    const top = (await s.feedPage(u.id, { view: "top", tag })).items.map((x) => x.id);
    expect(top).toEqual([liked.id, quiet.id]);
  });

  test("follow / unfollow, followed list", async () => {
    const tag = fresh();
    const u = await makeUser();
    await s.followTopic(u.id, tag.toUpperCase()); // normalized
    await s.followTopic(u.id, tag); // twice: still one
    await s.createPost(u.id, `#${tag}`);
    await s.createPost(u.id, `#${fresh()}`); // another topic: not counted under this one
    expect((await s.topicInfo(u.id, tag)).following).toBe(true);
    expect(await s.followedTopics(u.id)).toEqual([{ tag, posts: 1 }]);
    await s.unfollowTopic(u.id, tag);
    expect((await s.topicInfo(u.id, tag)).following).toBe(false);
    expect(await s.followedTopics(u.id)).toEqual([]);
  });

  test("an invalid topic is refused", async () => {
    const u = await makeUser();
    await expect(s.followTopic(u.id, "1nope")).rejects.toThrow("invalid");
    await expect(s.feedPage(u.id, { view: "latest", tag: "a b" })).rejects.toThrow("invalid");
  });

  test("For You: posts under a followed topic get the topic boost", async () => {
    const tag = fresh();
    const [viewer, author] = [await makeUser(), await makeUser()];
    const plain = await s.createPost(author.id, "פוסט רגיל");
    const tagged = await s.createPost(author.id, `פוסט על #${tag}`);
    await s.followTopic(viewer.id, tag);
    // Other test files post at the same time (some with likes), so either post can land past the
    // first page: page through until both are found.
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await s.feedPage(viewer.id, { view: "forYou", cursor });
      ids.push(...page.items.map((x) => x.id));
      cursor = page.next;
    } while (cursor && !(ids.includes(tagged.id) && ids.includes(plain.id)));
    expect(ids).toContain(plain.id);
    expect(ids.indexOf(tagged.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(tagged.id)).toBeLessThan(ids.indexOf(plain.id));
  });

  test("suggestions by prefix, most used first; popular this week", async () => {
    const base = fresh();
    const [big, small] = [`${base}big`, `${base}small`];
    const u = await makeUser();
    await s.createPost(u.id, `#${big}`);
    await s.createPost(u.id, `#${big} שוב`);
    await s.createPost(u.id, `#${small}`);
    expect(await s.topicSuggestions(base)).toEqual([
      { tag: big, posts: 2 },
      { tag: small, posts: 1 },
    ]);
    const popular = (await s.popularTopics(7, 1000)).map((t) => t.tag);
    expect(popular).toContain(big);
  });
});
