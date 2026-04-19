import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { WrongNote } from "@/models/WrongNote";
import { WrongItem } from "@/models/WrongItem";
import { clampBox } from "@/lib/problemTypes";

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

    await connectDB();
    const note = await WrongNote.findById(noteId).exec();
    if (!note || note.phone !== phone) {
      return NextResponse.json({ ok: false, error: "오답노트를 찾을 수 없거나 phone이 일치하지 않습니다." }, { status: 403 });
    }

    const nid = new mongoose.Types.ObjectId(noteId);

    if (Array.isArray(o.problems)) {
      const ids: string[] = [];
      for (const it of o.problems) {
        if (!it || typeof it !== "object") continue;
        const p = it as Record<string, unknown>;
        const questionText = str(p.questionText);
        if (!questionText) continue;
        const layout = clampBox(p.layout);
        const answerArea = p.answerArea ? clampBox(p.answerArea) : { ...layout };
        const doc = await WrongItem.create({
          noteId: nid,
          problemId: str(p.problemId),
          questionNumber: typeof p.questionNumber === "number" ? p.questionNumber : 0,
          questionText,
          type: str(p.type, "calculation"),
          layout,
          answerArea,
          userAnswer: str(p.userAnswer),
          correctAnswer: str(p.correctAnswer),
          isWrong: p.isWrong !== false,
          imageUrl,
        });
        ids.push(String(doc._id));
      }
      return NextResponse.json({ ok: true, ids, count: ids.length });
    }

    const questionText = str(o.questionText);
    if (!questionText) {
      return NextResponse.json({ ok: false, error: "questionText가 필요합니다." }, { status: 400 });
    }

    const layout = clampBox(o.layout);
    const answerArea = o.answerArea ? clampBox(o.answerArea) : { ...layout };

    const doc = await WrongItem.create({
      noteId: nid,
      problemId: str(o.problemId),
      questionNumber: typeof o.questionNumber === "number" ? o.questionNumber : 0,
      questionText,
      type: str(o.type, "calculation"),
      layout,
      answerArea,
      userAnswer: str(o.userAnswer),
      correctAnswer: str(o.correctAnswer),
      isWrong: o.isWrong !== false,
      imageUrl,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
