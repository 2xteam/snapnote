import { NextResponse } from "next/server";
import { normalizeRequestInstructions } from "@/lib/openaiInstructions";

const MAX_BYTES = 8 * 1024 * 1024;

export type ReadMultipartImageResult =
  | { ok: true; buffer: Buffer; mimeType: string; instructions?: string }
  | { ok: false; response: NextResponse };

export async function readMultipartImage(
  req: Request,
): Promise<ReadMultipartImageResult> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "multipart/form-data만 지원합니다." },
        { status: 415 },
      ),
    };
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "file 필드에 이미지를 첨부하세요." },
        { status: 400 },
      ),
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "이미지 파일만 업로드할 수 있습니다." },
        { status: 400 },
      ),
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "파일이 너무 큽니다. (최대 8MB)" },
        { status: 413 },
      ),
    };
  }

  const instructions = normalizeRequestInstructions(formData.get("instructions"));

  return {
    ok: true,
    buffer: Buffer.from(arrayBuffer),
    mimeType: file.type?.trim() || "image/jpeg",
    ...(instructions ? { instructions } : {}),
  };
}
