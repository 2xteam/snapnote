import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await ctx.params;
    const body = (await req.json()) as { phone?: string; name?: string };
    const phone = normalizePhone(body.phone ?? "");
    const name = (body.name ?? "").trim();

    if (!mongoose.isValidObjectId(noteId) || !phone || !name) {
      return NextResponse.json({ ok: false, error: "noteId, phone, name이 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const result = await WrongNote.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(noteId), phone },
      { $set: { name } },
      { new: true },
    ).lean().exec();

    if (!result) {
      return NextResponse.json({ ok: false, error: "오답노트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await ctx.params;
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    if (!mongoose.isValidObjectId(noteId) || !phone) {
      return NextResponse.json({ ok: false, error: "noteId, phone 쿼리가 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const item = await WrongNote.findById(noteId).lean().exec();
    if (!item || item.phone !== phone) {
      return NextResponse.json({ ok: false, error: "오답노트를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await ctx.params;
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    if (!mongoose.isValidObjectId(noteId) || !phone) {
      return NextResponse.json({ ok: false, error: "noteId, phone이 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const result = await WrongNote.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(noteId), phone, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    ).exec();

    if (!result) {
      return NextResponse.json({ ok: false, error: "오답노트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
