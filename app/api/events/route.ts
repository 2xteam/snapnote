import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { getEventModel, getApplicantModel } from "@/models/Event";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/** 진행 중인 이벤트 목록 — 개인 정보가 없어 공개다. 참여 코드는 내려주지 않는다 */
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
    return serverError(err);
  }
}

/*
  참여자는 `viewer.uid` 하나다. 본문의 `userId`·`phone` 은 옛 화면이 아직
  보내지만 읽지 않는다 — 남의 id 로 참여 기록을 남기고 보상을 줄 수 있었다.
*/
export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const body = await req.json();
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!eventId || !code) return badRequest("필수 필드가 누락되었습니다.");
    if (!mongoose.isValidObjectId(eventId)) return badRequest("잘못된 ID입니다.");

    await connectDB();
    const Event = getEventModel();
    const Applicant = getApplicantModel();
    const User = getUserModel();
    const uid = new mongoose.Types.ObjectId(viewer.uid);

    const ev = await Event.findById(eventId).lean();
    if (!ev || !ev.active) return notFound("이벤트를 찾을 수 없거나 종료되었습니다.");

    if (code !== ev.code) return badRequest("코드가 일치하지 않습니다.");

    const existing = await Applicant.findOne({ eventId: ev._id, userId: uid }).lean();

    if (existing && existing.count >= (ev.maxPerUser ?? 1)) {
      return badRequest("이미 참여 완료한 이벤트입니다.");
    }

    if (existing) {
      await Applicant.updateOne(
        { _id: existing._id },
        { $inc: { count: 1 } },
      );
    } else {
      await Applicant.create({
        eventId: ev._id,
        userId: uid,
        // 스키마가 phone 을 필수로 둔다. 요청자의 회원 문서에서 채운다
        phone: viewer.doc.phone ?? "",
        count: 1,
      });
    }

    if (IS_TOKEN_SYSTEM_ENABLED) {
      await User.findByIdAndUpdate(uid, { $inc: { tokens: ev.rewardTokens } });
    }

    return NextResponse.json({
      ok: true,
      rewardTokens: IS_TOKEN_SYSTEM_ENABLED ? ev.rewardTokens : 0,
    });
  } catch (err) {
    return serverError(err);
  }
}
