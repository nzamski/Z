import { describe, expect, test } from "vitest";
import { parser, schema, toMarkdown } from "@/lib/editor-markdown";
import { renderMarkdown } from "@/lib/markdown";

const roundTrip = (src: string) => toMarkdown(parser.parse(src));

// Opening a body in the editor and saving it unchanged must render exactly the same.
describe("editor markdown round trip", () => {
  test.each([
    ["plain Hebrew", "שלום עולם"],
    ["bold, italic, code, strike", "**מודגש** _נטוי_ `קוד` ~~מחוק~~"],
    ["single newlines are line breaks", "שורה אחת\nשורה שתיים\nשורה שלוש"],
    ["paragraphs", "פסקה אחת\n\nפסקה שתיים"],
    ["bullet list", "- אחד\n- שניים\n  - מקונן"],
    ["ordered list from 3", "3. שלוש\n4. ארבע"],
    ["code block keeps markdown chars", "```ts\nconst a = b * c_d; // **x**\n```"],
    ["link", "ראו [את המדריך](https://example.com/a_b?x=1) כאן"],
    ["bare URL stays a URL", "https://example.com/path_with_underscores"],
    ["mentions", "תודה @dana ו־@user_name!"],
    ["quote", "> ציטוט\n> שורה שנייה"],
    ["literal markdown characters", "2*3*4 ו־snake_case_word ו־[סוגריים]"],
    ["line that looks like a list", "שורה\n- לא רשימה? כן רשימה"],
    ["table stays text", "| a | b |\n|---|---|\n| 1 | 2 |"],
  ])("%s", (_, src) => {
    expect(renderMarkdown(roundTrip(src))).toBe(renderMarkdown(src));
  });

  test("a line break inside a list item stays in the item", () => {
    const src = "- אחד\n  המשך\n- שניים";
    expect(renderMarkdown(roundTrip(src))).toBe(renderMarkdown(src));
  });

  test("a list made in the editor is a tight '-' list", () => {
    const { nodes: n } = schema;
    const item = (t: string) => n.list_item.create(null, n.paragraph.create(null, schema.text(t)));
    const doc = n.doc.create(null, n.bullet_list.create(null, [item("א"), item("ב")]));
    expect(toMarkdown(doc)).toBe("- א\n- ב");
  });

  test("a loose list in a body stays loose", () => {
    const src = "- אחד\n\n- שניים";
    expect(renderMarkdown(roundTrip(src))).toBe(renderMarkdown(src));
  });

  test("an empty document is an empty body", () => {
    expect(toMarkdown(schema.node("doc", null, [schema.node("paragraph")]))).toBe("");
  });

  test("line breaks are plain newlines, not backslashes", () => {
    expect(roundTrip("א\nב")).toBe("א\nב");
  });
});
