import { NextResponse } from "next/server";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket, getR2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: "multipart/form-data만 지원합니다." }, { status: 415 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file 필드가 필요합니다." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
    }

    const MAX = 10 * 1024 * 1024;
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX) {
      return NextResponse.json({ ok: false, error: "파일이 너무 큽니다. (최대 10MB)" }, { status: 413 });
    }

    const phone = (formData.get("phone") as string | null)?.trim() ?? "";
    const noteId = (formData.get("noteId") as string | null)?.trim() ?? "";
    const ext = file.name.split(".").pop() ?? "jpg";
    const hash = crypto.randomBytes(12).toString("hex");
    const filename = `${Date.now()}-${hash}.${ext}`;
    const key = phone && noteId
      ? `${phone}/${noteId}/${filename}`
      : filename;

    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: file.type,
      }),
    );

    const publicUrl = `${getR2PublicUrl()}/${key}`;
    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
