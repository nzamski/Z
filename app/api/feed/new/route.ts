// Posts by others since the feed snapshot: `{count}` for the pill, or `{items}` with list=1.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { parseView } from "@/lib/feed";
import { countNewPosts, newPosts } from "@/lib/services";

export async function GET(req: NextRequest) {
  const viewer = await requireViewer();
  const q = req.nextUrl.searchParams;
  const since = z.iso.datetime().safeParse(q.get("since"));
  if (!since.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const view = parseView(q.get("view"));
  const from = new Date(since.data);
  if (q.get("list")) return NextResponse.json({ items: await newPosts(viewer.id, view, from) });
  return NextResponse.json({ count: await countNewPosts(viewer.id, view, from) });
}
