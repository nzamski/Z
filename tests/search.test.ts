import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@/db/client";
import { chatLink } from "@/lib/chat";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";
import { toTsQuery, variants } from "@/lib/search";

afterAll(() => sql.end());

describe("toTsQuery", () => {
  test("ANDs terms, each a prefix match", () => {
    expect(toTsQuery("Kafka  Redis")).toBe("(kafka:*) & (redis:*)");
  });

  test("Hebrew terms of 4+ letters also match without one prefix letter", () => {
    expect(variants("השרת")).toEqual(["השרת", "שרת"]);
    expect(variants("שרת")).toEqual(["שרת"]); // too short to strip
    expect(variants("קוד")).toEqual(["קוד"]);
    expect(variants("רשת")).toEqual(["רשת"]); // ר is not a prefix letter
    expect(toTsQuery("השרת נפל")).toBe("(השרת:* | שרת:*) & (נפל:*)");
  });

  test("strips punctuation, quotes, operators and niqqud; drops 1-char terms", () => {
    expect(toTsQuery(`"a" & | ! :* ( ) 'x'`)).toBeNull();
    expect(toTsQuery("שָׁלוֹם")).toBe("(שלום:* | לום:*)"); // ש is also a prefix letter
    expect(toTsQuery("c++ k8s")).toBe("(k8s:*)");
  });

  test("dedupes and caps the number of terms", () => {
    expect(toTsQuery("abc abc")).toBe("(abc:*)");
    expect(toTsQuery("aa bb cc dd ee ff gg hh ii jj")!.split(" & ")).toHaveLength(8);
  });
});

describe("chatLink", () => {
  test("fills the handle, URL-encoded", () => {
    expect(chatLink("dana", "chat://user/{handle}")).toBe("chat://user/dana");
    expect(chatLink("a b", "https://c.example/dm/{handle}")).toBe("https://c.example/dm/a%20b");
  });

  test("no template, no placeholder, or a script scheme: no button", () => {
    expect(chatLink("dana", "")).toBeNull();
    expect(chatLink("dana", "chat://user")).toBeNull();
    expect(chatLink("dana", " JavaScript:alert('{handle}')")).toBeNull();
  });
});

describe("similarPosts (pg_trgm fallback)", () => {
  test("finds live posts despite a typo, best match first; deleted posts never", async () => {
    const t = randomUUID()
      .replace(/[^a-z]/g, "")
      .slice(0, 5);
    const a = await makeUser();
    const close = await s.createPost(a.id, `עברנו ל-${t}kubernetes השבוע`);
    const gone = await s.createPost(a.id, `${t}kubernetes נמחק`);
    await s.deletePost(a.id, gone.id);
    await s.createPost(a.id, "משהו אחר לגמרי");

    const exact = await s.feedPage(a.id, { view: "latest", query: `${t}kubernetis` });
    expect(exact.items).toEqual([]); // full-text: no match, so the page falls back
    const ids = (await s.similarPosts(a.id, `${t}kubernetis`)).map((p) => p.id);
    expect(ids).toEqual([close.id]);
    expect(await s.similarPosts(a.id, "ab")).toEqual([]); // too short to be fuzzy
  });
});
