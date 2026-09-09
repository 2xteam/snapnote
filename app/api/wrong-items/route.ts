import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { WrongNote } from "@/models/WrongNote";
import { WrongItem } from "@/models/WrongItem";

export const runtime = "nodejs";

/*
  오답 항목은 소유자를 직접 갖지 않는다. 부모 오답노트의 `createdBy` 가 `viewer.uid`
  인지로 가른다. 본문의 `phone` 은 옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

/** 내 오답노트인지 확인한다. 남의 것이거나 없으면 null */
async function findOwnedNote(noteId: string, uid: string) {
  return WrongNote.findOne({ _id: noteId, createdBy: uid }).exec();
}

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId") ?? "";
    if (!mongoose.isValidObjectId(noteId)) return badRequest("noteId 쿼리가 필요합니다.");

    await connectDB();
    const note = await findOwnedNote(noteId, viewer.uid);
    if (!note) return notFound("오답노트를 찾을 수 없습니다.");

    const items = await WrongItem.find({ noteId: note._id })
      .sort({ createdAt: -1 }).limit(500).lean().exec();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: unknown;
    try { body = await req.json(); } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    if (!body || typeof body !== "object") return badRequest("잘못된 요청입니다.");

    const o = body as Record<string, unknown>;
    const noteId = str(o.noteId);
    const imageUrl = str(o.imageUrl);

    if (!mongoose.isValidObjectId(noteId)) return badRequest("noteId가 필요합니다.");
    if (!imageUrl) return badRequest("imageUrl이 필요합니다.");

    await connectDB();
    const note = await findOwnedNote(noteId, viewer.uid);
    if (!note) return notFound("오답노트를 찾을 수 없습니다.");

    const doc = await WrongItem.create({
      noteId: note._id,
      imageUrl,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}
