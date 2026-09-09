import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * 이메일 등록·변경.
 *
 * 본인 확인은 HttpOnly 세션 토큰으로 한다 — 본문의 `phone`·`userId` 는 더 받지 않는다.
 * 세션 쿠키에 전화번호가 없어져 클라이언트가 보낼 수도 없다 → lib/session.ts
 */
export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const user = auth.viewer.doc;

    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }

    user.email = email;
    await user.save();

    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
