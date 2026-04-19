import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Folder } from "@/models/Folder";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    const parentRaw = url.searchParams.get("parentId")?.trim() ?? "";
    const parentFilter =
      parentRaw && mongoose.isValidObjectId(parentRaw)
        ? { parentFolderId: new mongoose.Types.ObjectId(parentRaw) }
        : { $or: [{ parentFolderId: null }, { parentFolderId: { $exists: false } }] };

    await connectDB();
    const items = await Folder.find({ phone, deletedAt: null, ...parentFilter })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: { phone?: string; name?: string; createdBy?: string; parentFolderId?: string | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const createdBy =
      typeof body.createdBy === "string" ? body.createdBy.trim() : "";

    const parentRaw =
      body.parentFolderId === null || body.parentFolderId === ""
        ? null
        : typeof body.parentFolderId === "string"
          ? body.parentFolderId.trim()
          : undefined;
    const parentFolderId =
      parentRaw && mongoose.isValidObjectId(parentRaw)
        ? new mongoose.Types.ObjectId(parentRaw)
        : null;

    if (!phone || !name || !mongoose.isValidObjectId(createdBy)) {
      return NextResponse.json(
        { ok: false, error: "phone, name, createdBy(ObjectId)가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(createdBy).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "사용자 정보와 전화번호가 일치하지 않습니다." },
        { status: 403 },
      );
    }

    if (parentFolderId) {
      const parent = await Folder.findById(parentFolderId).exec();
      if (!parent || parent.phone !== phone) {
        return NextResponse.json(
          { ok: false, error: "상위 폴더를 찾을 수 없거나 권한이 없습니다." },
          { status: 403 },
        );
      }
    }

    const doc = await Folder.create({
      phone,
      name,
      createdBy: new mongoose.Types.ObjectId(createdBy),
      ...(parentFolderId ? { parentFolderId } : { parentFolderId: null }),
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
