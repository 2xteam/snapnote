import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { Folder } from "@/models/Folder";

export const runtime = "nodejs";

/*
  소유자는 쿠키의 서명 토큰에서만 읽는다(`viewer.uid`). 쿼리·본문의
  `phone`·`createdBy` 는 옛 화면이 아직 보내지만 **읽지 않는다** → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const parentRaw = url.searchParams.get("parentId")?.trim() ?? "";
    const parentFilter =
      parentRaw && mongoose.isValidObjectId(parentRaw)
        ? { parentFolderId: new mongoose.Types.ObjectId(parentRaw) }
        : { $or: [{ parentFolderId: null }, { parentFolderId: { $exists: false } }] };

    await connectDB();
    const items = await Folder.find({ createdBy: viewer.uid, deletedAt: null, ...parentFilter })
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

    let body: { name?: string; parentFolderId?: string | null };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";

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

    if (!name) return badRequest("name이 필요합니다.");

    await connectDB();

    if (parentFolderId) {
      // 상위 폴더도 내 것이어야 한다. 남의 폴더 아래에 끼워 넣을 수 없다
      const parent = await Folder.findOne({ _id: parentFolderId, createdBy: viewer.uid }).exec();
      if (!parent) return notFound("상위 폴더를 찾을 수 없습니다.");
    }

    const doc = await Folder.create({
      name,
      createdBy: new mongoose.Types.ObjectId(viewer.uid),
      ...(parentFolderId ? { parentFolderId } : { parentFolderId: null }),
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}
