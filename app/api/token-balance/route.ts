import { NextResponse } from "next/server";
import { getTokenBalance } from "@/lib/useToken";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }
  const tokens = await getTokenBalance(userId);
  return NextResponse.json({ ok: true, tokens });
}
