import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Folder } from "@/models/Folder";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ folderId: string }> },
) {
  try {
    const { folderId } = await ctx.params;
    const body = (await req.json()) as { phone?: string; name?: string };
    const phone = normalizePhone(body.phone ?? "");
    const name = (body.name ?? "").trim();

    if (!mongoose.isValidObjectId(folderId) || !phone || !name) {
      return NextResponse.json(
        { ok: false, error: "folderId, phone, name이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const result = await Folder.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(folderId), phone },
      { $set: { name } },
      { new: true },
    ).lean().exec();

    if (!result) {
      return NextResponse.json({ ok: false, error: "폴더를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ folderId: string }> },
) {
  try {
    const { folderId } = await ctx.params;
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    if (!mongoose.isValidObjectId(folderId) || !phone) {
      return NextResponse.json(
        { ok: false, error: "folderId, phone 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const item = await Folder.findOne({
      _id: new mongoose.Types.ObjectId(folderId),
      phone,
    }).lean().exec();

    if (!item) {
      return NextResponse.json({ ok: false, error: "폴더를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ folderId: string }> },
) {
  try {
    const { folderId } = await ctx.params;
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    if (!mongoose.isValidObjectId(folderId) || !phone) {
      return NextResponse.json(
        { ok: false, error: "folderId, phone이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const now = new Date();
    const oid = new mongoose.Types.ObjectId(folderId);

    const folder = await Folder.findOneAndUpdate(
      { _id: oid, phone, deletedAt: null },
      { $set: { deletedAt: now } },
    ).exec();

    if (!folder) {
      return NextResponse.json({ ok: false, error: "폴더를 찾을 수 없습니다." }, { status: 404 });
    }

    async function softDeleteChildren(parentId: mongoose.Types.ObjectId) {
      const children = await Folder.find({ parentFolderId: parentId, phone, deletedAt: null }).exec();
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
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
