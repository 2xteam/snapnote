import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound } from "@/lib/auth";
import { generateChatSubjectLine, runChatTurn } from "@/lib/chatOpenAi";
import { isOpenAiKeyConfigured } from "@/lib/openaiKey";
import {
  createOpenAiConversation,
  listConversationMessages,
} from "@/lib/openAiConversations";
import { requireConsents } from "@/lib/requireConsent";
import { ChatThread, type ChatThreadDocument } from "@/models/ChatThread";
import { deductTokens } from "@/lib/useToken";

export const runtime = "nodejs";
// OpenAI 응답 지연 대비 (Vercel 기본값은 플랜에 따라 10~15초)
export const maxDuration = 60;

type ChatThreadHydrated = HydratedDocument<ChatThreadDocument>;

/**
 * 내 스레드인지 확인한다. 소유자는 `viewer.uid` 하나다 — 쿼리·본문의
 * `phone`·`userId` 는 옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
 */
async function assertThread(
  threadId: string,
  uid: string,
): Promise<{ ok: true; thread: ChatThreadHydrated } | { ok: false; response: NextResponse }> {
  if (!mongoose.isValidObjectId(threadId)) {
    return { ok: false, response: badRequest("threadId가 필요합니다.") };
  }

  await connectDB();
  const thread = await ChatThread.findOne({
    _id: new mongoose.Types.ObjectId(threadId),
    userId: new mongoose.Types.ObjectId(uid),
  }).exec();

  if (!thread) {
    return { ok: false, response: notFound("스레드를 찾을 수 없습니다.") };
  }

  return { ok: true, thread };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY가 필요합니다." },
        { status: 503 },
      );
    }

    const { threadId } = await ctx.params;
    const gate = await assertThread(threadId, viewer.uid);
    if (!gate.ok) return gate.response;

    const convId = (gate.thread.openAiConversationId ?? "").trim();

    if (!convId) {
      return NextResponse.json({
        ok: true,
        items: [] as unknown[],
        usage: {
          totalInputTokens: gate.thread.totalInputTokens ?? 0,
          totalOutputTokens: gate.thread.totalOutputTokens ?? 0,
          totalTokens: gate.thread.totalTokens ?? 0,
        },
      });
    }

    const items = await listConversationMessages(convId);

    return NextResponse.json({
      ok: true,
      items,
      usage: {
        totalInputTokens: gate.thread.totalInputTokens ?? 0,
        totalOutputTokens: gate.thread.totalOutputTokens ?? 0,
        totalTokens: gate.thread.totalTokens ?? 0,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY가 필요합니다." },
        { status: 503 },
      );
    }

    /*
      국외 이전 동의를 **서버에서** 본다. 대화 내용이 OpenAI(미국)로 나간다.
      OpenAI 에 무엇이든 보내기 전에 막아야 한다 → lib/requireConsent.ts
    */
    const consentDenied = await requireConsents(viewer.uid, ["overseas"]);
    if (consentDenied) return consentDenied;

    const { threadId } = await ctx.params;
    let body: { text?: string };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("text가 필요합니다.");

    const gate = await assertThread(threadId, viewer.uid);
    if (!gate.ok) return gate.response;
    const thread = gate.thread;

    const tokenResult = await deductTokens(viewer.uid, 1);
    if (!tokenResult.ok) {
      return NextResponse.json({ ok: false, error: tokenResult.error }, { status: 402 });
    }

    let convId = (thread.openAiConversationId ?? "").trim();
    if (!convId) {
      convId = await createOpenAiConversation();
      thread.openAiConversationId = convId;
    }

    const { assistantText, openAiResponseId, usage } = await runChatTurn({
      userText: text,
      openAiConversationId: convId,
    });

    if (usage) {
      thread.totalInputTokens = (thread.totalInputTokens ?? 0) + usage.input_tokens;
      thread.totalOutputTokens = (thread.totalOutputTokens ?? 0) + usage.output_tokens;
      thread.totalTokens = (thread.totalTokens ?? 0) + usage.total_tokens;
    }

    thread.updatedAt = new Date();

    let threadTitle: string | null = null;
    const currentTitle = (thread.title ?? "").trim();
    if (!currentTitle || currentTitle === "새 대화") {
      const subject = await generateChatSubjectLine(text);
      if (subject) {
        thread.title = subject;
        threadTitle = subject;
      }
    }

    await thread.save();

    return NextResponse.json({
      ok: true,
      assistantText,
      openAiResponseId,
      threadTitle,
      usage: {
        lastTurn: usage,
        totalInputTokens: thread.totalInputTokens ?? 0,
        totalOutputTokens: thread.totalOutputTokens ?? 0,
        totalTokens: thread.totalTokens ?? 0,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
