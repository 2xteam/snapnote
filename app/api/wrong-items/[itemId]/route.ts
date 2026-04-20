import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { WrongNote } from "@/models/WrongNote";
import { WrongItem } from "@/models/WrongItem";
import { getR2Client, getR2Bucket, getR2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

async function assertItemAccess(itemId: string, phone: string) {
  const p = normalizePhone(phone);
  if (!mongoose.isValidObjectId(itemId) || !p) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "itemId, phone이 필요합니다." }, { status: 400 }) };
  }
  await connectDB();
  const item = await WrongItem.findById(itemId).exec();
  if (!item) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "항목을 찾을 수 없습니다." }, { status: 404 }) };
  }
  const note = await WrongNote.findById(item.noteId).exec();
  if (!note || note.phone !== p) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true as const, item };
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await ctx.params;
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone") ?? "";

    const access = await assertItemAccess(itemId, phone);
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
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
