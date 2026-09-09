import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { Folder } from "@/models/Folder";
import { WrongNote } from "@/models/WrongNote";

export const runtime = "nodejs";

/*
  소유자는 `viewer.uid` 하나다. 쿼리·본문의 `phone`·`createdBy` 는 옛 화면이
  아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const folderId = url.searchParams.get("folderId") ?? "";

    await connectDB();

    // folderId 가 없으면 내 오답노트 전부
    if (!folderId) {
      const items = await WrongNote.find({ createdBy: viewer.uid, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
        .exec();
      return NextResponse.json({ ok: true, items });
    }

    if (!mongoose.isValidObjectId(folderId)) {
      return badRequest("folderId 쿼리가 올바르지 않습니다.");
    }

    // 남의 폴더 id 를 넣어도 내 것만 나온다
    const items = await WrongNote.find({ folderId, createdBy: viewer.uid, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: { folderId?: string; name?: string; description?: string };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const folderId = typeof body.folderId === "string" ? body.folderId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!mongoose.isValidObjectId(folderId) || !name) {
      return badRequest("folderId, name이 필요합니다.");
    }

    await connectDB();
    const folder = await Folder.findOne({ _id: folderId, createdBy: viewer.uid }).exec();
    if (!folder) return notFound("폴더를 찾을 수 없습니다.");

    const doc = await WrongNote.create({
      folderId: new mongoose.Types.ObjectId(folderId),
      name,
      description,
      createdBy: new mongoose.Types.ObjectId(viewer.uid),
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}
