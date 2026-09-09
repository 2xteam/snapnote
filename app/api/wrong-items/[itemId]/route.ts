import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { WrongNote } from "@/models/WrongNote";
import { WrongItem } from "@/models/WrongItem";
import { getR2Client, getR2Bucket, getR2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * 오답 항목은 소유자를 직접 갖지 않는다. 부모 오답노트의 `createdBy` 가 요청자인지로
 * 가른다. 남의 항목이면 403 이 아니라 **404** — 있는지조차 알려주지 않는다.
 * 쿼리의 `phone` 은 옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
 */
async function assertItemAccess(itemId: string, uid: string) {
  if (!mongoose.isValidObjectId(itemId)) {
    return { ok: false as const, response: badRequest("itemId가 필요합니다.") };
  }
  await connectDB();
  const item = await WrongItem.findById(itemId).exec();
  if (!item) {
    return { ok: false as const, response: notFound("항목을 찾을 수 없습니다.") };
  }
  const note = await WrongNote.findOne({ _id: item.noteId, createdBy: uid }).exec();
  if (!note) {
    return { ok: false as const, response: notFound("항목을 찾을 수 없습니다.") };
  }
  return { ok: true as const, item };
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { itemId } = await ctx.params;
    const access = await assertItemAccess(itemId, viewer.uid);
    if (!access.ok) return access.response;

    const imageUrl = access.item.imageUrl as string | undefined;
    await WrongItem.deleteOne({ _id: access.item._id }).exec();

    if (imageUrl) {
      try {
        const publicUrl = getR2PublicUrl();
        if (imageUrl.startsWith(publicUrl)) {
          const key = imageUrl.slice(publicUrl.length + 1);
          await getR2Client().send(
            new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }),
          );
        }
      } catch {
        /* R2 삭제 실패해도 DB 삭제는 이미 완료 */
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
