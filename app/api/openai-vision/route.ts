import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { isOpenAiApiKeyAuthError, isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { wrongItemsFromImage } from "@/lib/wrongNoteVision";
import { requireConsents } from "@/lib/requireConsent";
import { readMultipartImage } from "@/lib/readMultipartImage";
import { deductTokens } from "@/lib/useToken";

export const runtime = "nodejs";
// Hobby 플랜 상한이 60초다. Pro로 올린 뒤에는 늘려도 된다.
export const maxDuration = 60;

/**
 * 요청자는 `viewer.uid` 하나다. 폼의 `userId` 필드는 옛 화면이 아직 보내지만
 * 읽지 않는다 — 남의 id 를 넣어 남의 토큰을 깎을 수 있었다 → lib/auth.ts
 */
export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY가 필요합니다. `.env.local`에 `sk-...` 키를 설정한 뒤 서버를 재시작하세요." },
        { status: 503 },
      );
    }

    /*
      국외 이전 동의를 **서버에서** 본다. 이 라우트는 사진을 OpenAI(미국)로
      보낸다. 화면에서만 막으면 직접 부르는 쪽이 그대로 통과한다.
      없으면 412 → lib/requireConsent.ts
    */
    const consentDenied = await requireConsents(viewer.uid, ["overseas"]);
    if (consentDenied) return consentDenied;

    const parsed = await readMultipartImage(req);
    if (!parsed.ok) return parsed.response;

    const tokenResult = await deductTokens(viewer.uid, 10);
    if (!tokenResult.ok) {
      return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 402 });
    }

    const problems = await wrongItemsFromImage(
      parsed.buffer,
      parsed.mimeType,
      { extraInstructions: parsed.instructions },
    );

    return NextResponse.json({ ok: true, source: "openai-vision", problems });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    if (isOpenAiApiKeyAuthError(err)) {
      return NextResponse.json({ ok: false, error: "OpenAI API 키가 거부되었습니다." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
