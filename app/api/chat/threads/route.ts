import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, serverError } from "@/lib/auth";
import { ChatThread } from "@/models/ChatThread";

export const runtime = "nodejs";

/*
  스레드의 소유자(`userId`)는 `viewer.uid` 하나다. 쿼리·본문의 `phone`·`userId` 는
  옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    await connectDB();
    const items = await ChatThread.find({ userId: new mongoose.Types.ObjectId(viewer.uid) })
      .sort({ updatedAt: -1 })
      .limit(100)
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

    let body: { title?: string };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "새 대화";

    await connectDB();
    const doc = await ChatThread.create({
      userId: new mongoose.Types.ObjectId(viewer.uid),
      title,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}
