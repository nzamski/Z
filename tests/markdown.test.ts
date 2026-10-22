import { describe, expect, test } from "vitest";
import { hasContent, md, renderMarkdown } from "@/lib/markdown";
import { computePreview } from "@/lib/preview";
import { DIR_MARK, textDir } from "@/lib/direction";

// Valid = re-parsing yields balanced open/close tokens and no fence runs to end of input unclosed.
function assertValid(preview: string) {
  let depth = 0;
  for (const t of md.parse(preview, {})) depth += t.nesting;
  expect(depth).toBe(0);
  const fences = preview.split("\n").filter((l) => /^\s*(`{3,}|~{3,})/.test(l));
  expect(fences.length % 2).toBe(0);
}

const word = "מילה ";

describe("computePreview", () => {
  test("short post is kept whole", () => {
    const body = "# כותרת\n\nפסקה קצרה.";
    expect(computePreview(body)).toEqual({ preview: body, hasMore: false });
  });

  test("keeps whole blocks up to the limit", () => {
    const para = word.repeat(40).trim(); // ~200 chars
    const { preview, hasMore } = computePreview([para, para, para, para].join("\n\n"));
    expect(preview).toBe([para, para].join("\n\n"));
    expect(hasMore).toBe(true);
    assertValid(preview);
  });

  test("long first paragraph is cut at a word boundary", () => {
    const body = word.repeat(300).trim();
    const { preview, hasMore } = computePreview(body);
    expect(hasMore).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(500);
    expect(body.startsWith(preview)).toBe(true);
    expect(preview.endsWith("מילה")).toBe(true);
    assertValid(preview);
  });

  test("long first code fence is cut on a line and re-closed", () => {
    const code = Array.from({ length: 100 }, (_, i) => `const x${i} = ${i};`).join("\n");
    const body = "```ts\n" + code + "\n```\n\nאחרי";
    const { preview, hasMore } = computePreview(body);
    expect(hasMore).toBe(true);
    expect(preview.startsWith("```ts\n")).toBe(true);
    expect(preview.endsWith("\n```")).toBe(true);
    const fence = md.parse(preview, {}).filter((t) => t.type === "fence");
    expect(fence).toHaveLength(1);
    expect(
      fence[0].content.split("\n").every((l) => l === "" || /^const x\d+ = \d+;$/.test(l)),
    ).toBe(true);
    assertValid(preview);
  });

  test("tilde fence with longer marker is re-closed with the same marker", () => {
    const body = "~~~~\n" + "line\n".repeat(200) + "~~~~";
    const { preview } = computePreview(body);
    expect(preview.endsWith("\n~~~~")).toBe(true);
    assertValid(preview);
  });

  test("long nested list is cut on a line and stays a valid list", () => {
    const items = Array.from(
      { length: 40 },
      (_, i) => `- פריט ${i}\n  - תת פריט ${i}\n    - עמוק ${i}`,
    );
    const { preview, hasMore } = computePreview(items.join("\n"));
    expect(hasMore).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(500);
    expect(md.parse(preview, {}).some((t) => t.type === "bullet_list_open" && t.level > 0)).toBe(
      true,
    );
    assertValid(preview);
  });

  test("code fence inside a long list item is re-closed", () => {
    const body = "- פריט\n\n  ```\n" + "  code line\n".repeat(100) + "  ```";
    const { preview } = computePreview(body);
    assertValid(preview);
  });
});

describe("renderMarkdown", () => {
  test("escapes raw HTML, drops images, blocks javascript: links, adds rel", () => {
    const html = renderMarkdown(
      "<script>x</script> ![a](http://evil/x.png) [bad](javascript:alert(1)) https://ok.example",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("other dangerous link forms are not links", () => {
    for (const src of [
      "[x](JAVASCRIPT:alert(1))",
      "[x](  javascript:alert(1))",
      "[x](data:text/html;base64,PHNjcmlwdD4=)",
      "[x](vbscript:msgbox)",
      "<javascript:alert(1)>",
      '[x](https://ok.example "a\" onmouseover=\"alert(1))',
    ]) {
      const html = renderMarkdown(src);
      expect(html, src).not.toMatch(/href="\s*(javascript|data|vbscript):/i);
      expect(html, src).not.toMatch(/<a [^>]*onmouseover=/i);
    }
  });

  test("single newlines are line breaks (posts used to be plain text)", () => {
    expect(renderMarkdown("א\nב")).toBe('<p dir="rtl">א<br>\nב</p>\n');
  });

  test("deep nesting and very long input don't blow up", () => {
    expect(() => renderMarkdown(">".repeat(5000) + " x")).not.toThrow();
    expect(() => renderMarkdown("[".repeat(20000))).not.toThrow();
  });
});

describe("direction (Hebrew and English in one post)", () => {
  test.each([
    ["Hebrew", "שלום לכולם", "rtl"],
    ["the first word decides: English", "PR קטן עדיף על PR מושלם.", "ltr"],
    [
      "Hebrew full of long tech terms",
      "מחפשת מישהו שכבר הריץ Keycloak מאחורי OpenShift router עם X-Forwarded headers. נתקענו על redirect URI.",
      "rtl",
    ],
    ["a mention is skipped", "@dana תודה רבה על העזרה", "rtl"],
    ["a tag is skipped", "#kubernetes שדרגנו היום", "rtl"],
    ["English", "Hello everyone, this is English", "ltr"],
    ["English ending in a Hebrew word", "We migrated the logs to JSON, יופי", "ltr"],
    ["the writer chose RTL (a leading RLM)", `${DIR_MARK.rtl}PR קטן עדיף`, "rtl"],
    ["the writer chose LTR (a leading LRM)", `${DIR_MARK.ltr}שלום world`, "ltr"],
    ["a leading URL is skipped", "https://example.com/path ראו כאן", "rtl"],
    ["no letters", "1234 !?", null],
  ])("%s", (_, text, dir) => {
    expect(textDir(text)).toBe(dir);
  });

  test("each block gets its own direction; lists and quotes too", () => {
    const html = renderMarkdown("English paragraph here\n\nפסקה בעברית\n\n- item one\n- item two");
    expect(html).toContain('<p dir="ltr">English paragraph here</p>');
    expect(html).toContain('<p dir="rtl">פסקה בעברית</p>');
    expect(html).toContain('<ul dir="ltr">');
    expect(html).toContain('<li dir="ltr">item one</li>');
  });

  test("a writer's mark wins in rendered posts too", () => {
    expect(renderMarkdown(`${DIR_MARK.rtl}PR קטן`)).toContain('<p dir="rtl">');
  });
});

describe("hasContent (no empty posts)", () => {
  test.each([
    ["an empty code block", "```\n```"],
    ["only a direction mark", "‏"],
    ["only invisible characters and spaces", " ​ ‎ \n\n "],
    ["empty bold", "****"],
    ["only a rule", "---"],
  ])("nothing: %s", (_, src) => {
    expect(hasContent(src)).toBe(false);
  });

  test.each([
    ["text", "שלום"],
    ["an emoji", "🎉"],
    ["a code block with code", "```\nconst a = 1\n```"],
    ["inline code", "`x`"],
    ["text after a direction mark", "‏PR קטן"],
  ])("something: %s", (_, src) => {
    expect(hasContent(src)).toBe(true);
  });
});

describe("code highlighting", () => {
  test("a fence's language; a confident guess without one; plain otherwise; still escaped", () => {
    const named = renderMarkdown("```python\ndef f(x):\n    return x  # done\n```");
    expect(named).toContain('<span class="hljs-keyword">def</span>');
    expect(named).toContain('<span class="hljs-comment"># done</span>');

    const guessed = renderMarkdown(
      "```\nSELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC;\n```",
    );
    expect(guessed).toContain("hljs-keyword");

    expect(renderMarkdown("```\nhello there\n```")).not.toContain("hljs"); // nothing to guess
    expect(renderMarkdown("```cobol\nMOVE A TO B\n```")).not.toContain("hljs"); // not ours: plain

    const xss = renderMarkdown('```js\nconst s = "<img src=x onerror=alert(1)>";\n```');
    expect(xss).not.toContain("<img");
  });
});
