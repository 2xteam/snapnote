import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { Folder } from "@/models/Folder";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";

/* 소유자는 `viewer.uid` 하나다. 쿼리·본문의 `phone` 은 읽지 않는다 → lib/auth.ts */

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ folderId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { folderId } = await ctx.params;
    const body = (await req.json()) as { name?: string };
    const name = (body.name ?? "").trim();

    if (!mongoose.isValidObjectId(folderId) || !name) {
      return badRequest("folderId, name이 필요합니다.");
    }

    await connectDB();
    const result = await Folder.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(folderId), createdBy: viewer.uid },
      { $set: { name } },
      { new: true },
    )
      .lean()
      .exec();

    if (!result) return notFound("폴더를 찾을 수 없습니다.");

    return NextResponse.json({ ok: true, item: result });
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ folderId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { folderId } = await ctx.params;
    if (!mongoose.isValidObjectId(folderId)) return badRequest("folderId가 필요합니다.");

    await connectDB();
    const item = await Folder.findOne({
      _id: new mongoose.Types.ObjectId(folderId),
      createdBy: viewer.uid,
    })
      .lean()
      .exec();

    if (!item) return notFound("폴더를 찾을 수 없습니다.");

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ folderId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { folderId } = await ctx.params;
    if (!mongoose.isValidObjectId(folderId)) return badRequest("folderId가 필요합니다.");

    await connectDB();
    const now = new Date();
    const oid = new mongoose.Types.ObjectId(folderId);
    const owner = viewer.uid;

    const folder = await Folder.findOneAndUpdate(
      { _id: oid, createdBy: owner, deletedAt: null },
      { $set: { deletedAt: now } },
    ).exec();

    if (!folder) return notFound("폴더를 찾을 수 없습니다.");

    async function softDeleteChildren(parentId: mongoose.Types.ObjectId) {
      const children = await Folder.find({ parentFolderId: parentId, createdBy: owner, deletedAt: null }).exec();
      for (const child of children) {
        await Folder.updateOne({ _id: child._id }, { $set: { deletedAt: now } }).exec();
        await WrongNote.updateMany({ folderId: child._id, deletedAt: null }, { $set: { deletedAt: now } }).exec();
        await softDeleteChildren(child._id);
      }
    }

    await WrongNote.updateMany({ folderId: oid, deletedAt: null }, { $set: { deletedAt: now } }).exec();
    await softDeleteChildren(oid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
