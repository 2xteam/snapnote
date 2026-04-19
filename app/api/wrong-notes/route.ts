import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Folder } from "@/models/Folder";
import { getUserModel } from "@/models/User";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId") ?? "";
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    await connectDB();

    if (phone && !folderId) {
      const items = await WrongNote.find({ phone, deletedAt: null })
        .sort({ createdAt: -1 }).limit(500).lean().exec();
      return NextResponse.json({ ok: true, items });
    }

    if (!mongoose.isValidObjectId(folderId)) {
      return NextResponse.json(
        { ok: false, error: "folderId 또는 phone 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    const items = await WrongNote.find({ folderId, deletedAt: null })
      .sort({ createdAt: -1 }).limit(200).lean().exec();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: { folderId?: string; phone?: string; name?: string; description?: string; createdBy?: string };
    try { body = await req.json(); } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const folderId = typeof body.folderId === "string" ? body.folderId.trim() : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const createdBy = typeof body.createdBy === "string" ? body.createdBy.trim() : "";

    if (!mongoose.isValidObjectId(folderId) || !phone || !name || !mongoose.isValidObjectId(createdBy)) {
      return NextResponse.json({ ok: false, error: "folderId, phone, name, createdBy가 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const folder = await Folder.findById(folderId).exec();
    if (!folder || folder.phone !== phone) {
      return NextResponse.json({ ok: false, error: "폴더를 찾을 수 없거나 phone이 일치하지 않습니다." }, { status: 403 });
    }

    const user = await getUserModel().findById(createdBy).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "사용자 정보와 전화번호가 일치하지 않습니다." }, { status: 403 });
    }

    const doc = await WrongNote.create({
      folderId: new mongoose.Types.ObjectId(folderId),
      phone, name, description,
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
