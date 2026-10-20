// Next page of a feed for infinite scroll (PLAN.md §6.1). Previews only, never full bodies.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { parseView } from "@/lib/feed";
import { allowSearch } from "@/lib/rate-limit";
import { feedPage, ServiceError } from "@/lib/services";

export async function GET(req: NextRequest) {
  const viewer = await requireViewer();
  const q = req.nextUrl.searchParams;
  const author = q.get("author");
  if (author && !z.uuid().safeParse(author).success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (q.has("q") && !allowSearch(viewer.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const page = await feedPage(viewer.id, {
      view: parseView(q.get("view")),
      authorId: author ?? undefined,
      query: q.get("q") ?? undefined,
      cursor: q.get("cursor"),
    });
    return NextResponse.json(page);
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.code }, { status: 400 });
    throw e;
  }
}
