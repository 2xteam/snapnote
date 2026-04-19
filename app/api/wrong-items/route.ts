import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { WrongNote } from "@/models/WrongNote";
import { WrongItem } from "@/models/WrongItem";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId") ?? "";
    if (!mongoose.isValidObjectId(noteId)) {
      return NextResponse.json({ ok: false, error: "noteId 쿼리가 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const items = await WrongItem.find({ noteId })
      .sort({ createdAt: -1 }).limit(500).lean().exec();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
    }

    const o = body as Record<string, unknown>;
    const noteId = str(o.noteId);
    const phone = typeof o.phone === "string" ? normalizePhone(o.phone) : "";
    const imageUrl = str(o.imageUrl);

    if (!mongoose.isValidObjectId(noteId) || !phone) {
      return NextResponse.json({ ok: false, error: "noteId, phone이 필요합니다." }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ ok: false, error: "imageUrl이 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const note = await WrongNote.findById(noteId).exec();
    if (!note || note.phone !== phone) {
      return NextResponse.json({ ok: false, error: "오답노트를 찾을 수 없거나 phone이 일치하지 않습니다." }, { status: 403 });
    }

    const nid = new mongoose.Types.ObjectId(noteId);

    const doc = await WrongItem.create({
      noteId: nid,
      imageUrl,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
