// The bell's poll: `{count}` unread; with latest=1 also the newest unread ones (desktop alerts).
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { requireViewer } from "@/lib/auth/viewer";
import { notificationsPage, unreadNotifications } from "@/lib/services";

export async function GET(req: NextRequest) {
  await connection();
  const viewer = await requireViewer();
  const count = await unreadNotifications(viewer.id);
  if (!req.nextUrl.searchParams.get("latest")) return NextResponse.json({ count });
  const latest = count ? (await notificationsPage(viewer.id)).items.filter((n) => n.unread) : [];
  return NextResponse.json({ count, latest: latest.slice(0, 20) });
}
