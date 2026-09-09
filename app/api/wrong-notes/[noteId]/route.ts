import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";

/* 소유자는 `viewer.uid` 하나다. 쿼리·본문의 `phone` 은 읽지 않는다 → lib/auth.ts */

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ noteId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { noteId } = await ctx.params;
    const body = (await req.json()) as { name?: string };
    const name = (body.name ?? "").trim();

    if (!mongoose.isValidObjectId(noteId) || !name) {
      return badRequest("noteId, name이 필요합니다.");
    }

    await connectDB();
    const result = await WrongNote.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(noteId), createdBy: viewer.uid },
      { $set: { name } },
      { new: true },
    )
      .lean()
      .exec();

    if (!result) return notFound("오답노트를 찾을 수 없습니다.");

    return NextResponse.json({ ok: true, item: result });
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ noteId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { noteId } = await ctx.params;
    if (!mongoose.isValidObjectId(noteId)) return badRequest("noteId가 필요합니다.");

    await connectDB();
    const note = await WrongNote.findOne({ _id: noteId, createdBy: viewer.uid }).lean().exec();
    if (!note) return notFound("오답노트를 찾을 수 없습니다.");

    return NextResponse.json({ ok: true, item: note });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ noteId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { noteId } = await ctx.params;
    if (!mongoose.isValidObjectId(noteId)) return badRequest("noteId가 필요합니다.");

    await connectDB();
    const result = await WrongNote.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(noteId), createdBy: viewer.uid, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    ).exec();

    if (!result) return notFound("오답노트를 찾을 수 없습니다.");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
