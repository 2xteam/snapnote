import { NextResponse } from "next/server";
import { requireViewer, serverError } from "@/lib/auth";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";

export const runtime = "nodejs";

/*
  "나"는 `viewer.uid` 하나다. 쿼리의 `phone`·`userId` 는 옛 화면이
  아직 보내지만 읽지 않는다 → lib/auth.ts
*/
export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    return NextResponse.json({
      ok: true,
      email: viewer.doc.email ?? "",
      tokens: IS_TOKEN_SYSTEM_ENABLED ? viewer.doc.tokens ?? 0 : 0,
      stats: {},
    });
  } catch (err) {
    return serverError(err);
  }
}
