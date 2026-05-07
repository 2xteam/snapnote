import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getEventModel, getApplicantModel } from "@/models/Event";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const Event = getEventModel();
    const list = await Event.find({ active: true }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      ok: true,
      events: list.map((ev) => ({
        id: String(ev._id),
        title: ev.title,
        description: ev.description,
        rewardTokens: ev.rewardTokens,
        maxPerUser: ev.maxPerUser,
        createdAt: ev.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId ?? "";
    const phone = body.phone ?? "";
    const eventId = body.eventId ?? "";
    const code = (body.code ?? "").trim();

    if (!userId || !phone || !eventId || !code) {
      return NextResponse.json({ ok: false, error: "필수 필드가 누락되었습니다." }, { status: 400 });
    }

    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(eventId)) {
      return NextResponse.json({ ok: false, error: "잘못된 ID입니다." }, { status: 400 });
    }

    await connectDB();
    const Event = getEventModel();
    const Applicant = getApplicantModel();
    const User = getUserModel();

    const ev = await Event.findById(eventId).lean();
    if (!ev || !ev.active) {
      return NextResponse.json({ ok: false, error: "이벤트를 찾을 수 없거나 종료되었습니다." }, { status: 404 });
    }

    if (code !== ev.code) {
      return NextResponse.json({ ok: false, error: "코드가 일치하지 않습니다." }, { status: 400 });
    }

    const existing = await Applicant.findOne({
      eventId: ev._id,
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    if (existing && existing.count >= (ev.maxPerUser ?? 1)) {
      return NextResponse.json({ ok: false, error: "이미 참여 완료한 이벤트입니다." }, { status: 400 });
    }

    if (existing) {
      await Applicant.updateOne(
        { _id: existing._id },
        { $inc: { count: 1 } },
      );
    } else {
      await Applicant.create({
        eventId: ev._id,
        userId: new mongoose.Types.ObjectId(userId),
        phone,
        count: 1,
      });
    }

    await User.findByIdAndUpdate(userId, { $inc: { tokens: ev.rewardTokens } });

    return NextResponse.json({ ok: true, rewardTokens: ev.rewardTokens });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
