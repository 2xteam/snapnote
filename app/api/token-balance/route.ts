import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { getTokenBalance } from "@/lib/useToken";

export const runtime = "nodejs";

/* 잔액은 요청자 본인 것만. 쿼리의 `userId` 는 옛 화면이 아직 보내지만 읽지 않는다 */
export async function GET(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  const tokens = await getTokenBalance(auth.viewer.uid);
  return NextResponse.json({ ok: true, tokens });
}
