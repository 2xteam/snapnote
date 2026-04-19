import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { WrongNote } from "@/models/WrongNote";
import { WrongItem } from "@/models/WrongItem";
import { clampBox } from "@/lib/problemTypes";

export const runtime = "nodejs";

async function assertItemAccess(itemId: string, phone: string) {
  const p = normalizePhone(phone);
  if (!mongoose.isValidObjectId(itemId) || !p) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "itemId, phone이 필요합니다." }, { status: 400 }) };
  }
  await connectDB();
  const item = await WrongItem.findById(itemId).exec();
  if (!item) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "항목을 찾을 수 없습니다." }, { status: 404 }) };
  }
  const note = await WrongNote.findById(item.noteId).exec();
  if (!note || note.phone !== p) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true as const, item };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await ctx.params;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const phone = typeof body.phone === "string" ? body.phone : "";
    const access = await assertItemAccess(itemId, phone);
    if (!access.ok) return access.response;

    const questionText = typeof body.questionText === "string" ? body.questionText.trim() : access.item.questionText;
    if (!questionText) {
      return NextResponse.json({ ok: false, error: "questionText는 필수입니다." }, { status: 400 });
    }

    const update: Record<string, unknown> = { questionText };
    if (typeof body.correctAnswer === "string") update.correctAnswer = body.correctAnswer.trim();
    if (typeof body.userAnswer === "string") update.userAnswer = body.userAnswer.trim();
    if (typeof body.type === "string") update.type = body.type;
    if (typeof body.isWrong === "boolean") update.isWrong = body.isWrong;
    if (body.layout) update.layout = clampBox(body.layout);
    if (body.answerArea) update.answerArea = clampBox(body.answerArea);

    access.item.set(update);
    await access.item.save();

    return NextResponse.json({ ok: true, id: itemId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await ctx.params;
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone") ?? "";

    const access = await assertItemAccess(itemId, phone);
    if (!access.ok) return access.response;

    await WrongItem.deleteOne({ _id: access.item._id }).exec();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
