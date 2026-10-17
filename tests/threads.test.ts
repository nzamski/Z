import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@/db/client";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

describe("getThread", () => {
  test("deleted parent with live reply is a placeholder; deleted leaf is hidden", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const parent = await s.createComment(b.id, p.id, "אב");
    await s.createComment(a.id, p.id, "בן", parent.id);
    const leaf = await s.createComment(b.id, p.id, "עלה");
    await s.deleteComment(b.id, parent.id);
    await s.deleteComment(b.id, leaf.id);

    const { nodes, total } = await s.getThread(p.id, null);
    expect(total).toBe(1);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: parent.id, deleted: true, body: null, author: null });
    expect(nodes[0].children.map((c) => c.body)).toEqual(["בן"]);
  });

  test("stops at THREAD_DEPTH and reports the hidden children", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "פוסט");
    let parent: string | undefined;
    const ids: string[] = [];
    for (let d = 0; d < s.THREAD_DEPTH + 3; d++) {
      parent = (await s.createComment(a.id, p.id, `עומק ${d + 1}`, parent)).id;
      ids.push(parent);
    }
    let node = (await s.getThread(p.id, null)).nodes[0];
    for (let d = 1; d < s.THREAD_DEPTH; d++) node = node.children[0];
    expect(node.depth).toBe(s.THREAD_DEPTH);
    expect(node.children).toHaveLength(0);
    expect(node.childCount).toBe(1); // UI shows "continue thread"

    // Continuing from the capped comment loads the rest.
    const rest = await s.getThread(p.id, ids[s.THREAD_DEPTH - 1]);
    expect(rest.nodes[0].body).toBe(`עומק ${s.THREAD_DEPTH + 1}`);
  });

  test("pages replies: first REPLIES_PAGE loaded, the rest via offset", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "פוסט");
    const root = await s.createComment(a.id, p.id, "שורש");
    for (let i = 0; i < s.REPLIES_PAGE + 5; i++)
      await s.createComment(a.id, p.id, `תשובה ${i}`, root.id);

    const [r] = (await s.getThread(p.id, null)).nodes;
    expect(r.children).toHaveLength(s.REPLIES_PAGE);
    expect(r.childCount).toBe(s.REPLIES_PAGE + 5);
    expect(r.children[0].body).toBe("תשובה 0"); // oldest first

    const more = await s.getThread(p.id, root.id, s.REPLIES_PAGE);
    expect(more.nodes.map((n) => n.body)).toEqual(
      [0, 1, 2, 3, 4].map((i) => `תשובה ${s.REPLIES_PAGE + i}`),
    );
    expect(more.total).toBe(s.REPLIES_PAGE + 5);
  });
});
