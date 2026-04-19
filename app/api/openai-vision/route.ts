import { NextResponse } from "next/server";
import { isOpenAiApiKeyAuthError, isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { wrongItemsFromImage } from "@/lib/wrongNoteVision";
import { readMultipartImage } from "@/lib/readMultipartImage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY가 필요합니다. `.env.local`에 `sk-...` 키를 설정한 뒤 서버를 재시작하세요." },
        { status: 503 },
      );
    }

    const parsed = await readMultipartImage(req);
    if (!parsed.ok) return parsed.response;

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
