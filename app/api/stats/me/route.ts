import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    const userId = url.searchParams.get("userId") ?? "";

    if (!phone || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      stats: {},
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
