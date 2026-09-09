import { NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { getR2Client, getR2Bucket, getR2PublicUrl } from "@/lib/r2";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * R2 키에 넣을 확장자. 업로드된 파일의 MIME 으로 정한다 — 파일 이름은
 * 클라이언트가 마음대로 붙이는 값이라 믿지 않는다. 모르면 png.
 */
function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "png";
  }
}

/**
 * 오답 사진을 R2 에 올린다.
 *
 * 키는 `snapnote/{회원 _id}/{noteId}/{uuid}.{ext}` 다. 예전 키(`{phone}/{noteId}/…`)는
 * **전화번호가 공개 URL 에 그대로 드러났고**, 이메일만 있는 회원은 버킷 루트에
 * 파일명만으로 놓여 누구 것인지 알 수 없었다. 회원 `_id` 는 그 자체로 개인정보가
 * 아니고, 접두사로 한 사람 것을 통째로 지울 수 있다 → lib/purgeR2.ts
 *
 * 폼의 `phone` 은 옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
 * 이미 올라간 예전 키는 나중 단계에서 옮긴다.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: "multipart/form-data만 지원합니다." }, { status: 415 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return badRequest("file 필드가 필요합니다.");
    if (!file.type.startsWith("image/")) return badRequest("이미지 파일만 업로드 가능합니다.");

    const noteId = (formData.get("noteId") as string | null)?.trim() ?? "";
    if (!mongoose.isValidObjectId(noteId)) return badRequest("noteId가 필요합니다.");

    // Vercel Functions는 본문 4.5MB를 넘으면 함수에 닿기도 전에 잘린다.
    // 클라이언트가 업로드 전에 해상도를 제한한다(`lib/clientImage.ts`).
    const MAX = 4 * 1024 * 1024;
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX) {
      return NextResponse.json({
          ok: false,
          error:
            "이미지 용량이 너무 큽니다. (최대 4MB) 사진을 다시 촬영하거나 영역을 좁혀서 시도해 주세요.",
        }, { status: 413 });
    }

    // 남의 노트 경로에 올릴 수 없다 — 노트가 내 것인지 먼저 본다
    await connectDB();
    const note = await WrongNote.findOne({ _id: noteId, createdBy: viewer.uid }).exec();
    if (!note) return notFound("오답노트를 찾을 수 없습니다.");

    const ext = extFromMime(file.type);
    const key = `snapnote/${viewer.uid}/${String(note._id)}/${crypto.randomUUID()}.${ext}`;

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
    return serverError(err);
  }
}
