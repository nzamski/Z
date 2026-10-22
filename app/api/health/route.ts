// Probes. `/api/health?live`: the process answers (liveness).
// `/api/health`: and the database answers within 2 s (readiness). No auth, no data in the body.
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/db/client";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("live")) return NextResponse.json({ ok: true });
  try {
    await Promise.race([
      sql`select 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
