import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, serverError } from "@/lib/auth";
import { getInquiryModel } from "@/models/Inquiry";

export const runtime = "nodejs";

/*
  문의의 소유자(`userId`)는 `viewer.uid` 하나다. 쿼리·본문의 `phone`·`userId` 는
  옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    await connectDB();
    const Inquiry = getInquiryModel();
    const list = await Inquiry.find({ userId: new mongoose.Types.ObjectId(viewer.uid) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({
      ok: true,
      inquiries: list.map((d) => ({
        id: String(d._id),
        category: d.category,
        title: d.title,
        content: d.content,
        status: d.status,
        answer: d.answer ?? "",
        answeredAt: d.answeredAt ?? null,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: { category?: string; title?: string; content?: string };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const category = typeof body.category === "string" ? body.category : "other";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!title) return badRequest("제목을 입력해 주세요.");
    if (!content) return badRequest("내용을 입력해 주세요.");

    await connectDB();
    const Inquiry = getInquiryModel();
    const doc = await Inquiry.create({
      userId: new mongoose.Types.ObjectId(viewer.uid),
      // 스키마가 phone·name 을 필수로 둔다. 요청자의 회원 문서에서 채운다
      phone: viewer.doc.phone ?? "",
      name: viewer.doc.name ?? viewer.doc.nickname ?? "",
      category,
      title,
      content,
    });

    return NextResponse.json({
      ok: true,
      inquiry: {
        id: String(doc._id),
        category: doc.category,
        title: doc.title,
        content: doc.content,
        status: doc.status,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
