import OpenAI from "openai";
import { buildChatRagContext } from "@/lib/chatRagDocuments";
import { ASK_USER_POLICY } from "@/lib/askUserTool";
import { createOpenAiResponse, type ResponsesCreateUsage } from "@/lib/openAiConversations";

const CHAT_INSTRUCTIONS = `당신은 SnapNote 앱의 챗봇입니다.
사용자의 질문에 친절하게 답변합니다.`;

export type ChatTurnResult = {
  assistantText: string;
  openAiResponseId: string;
  usage: ResponsesCreateUsage | null;
};

/**
 * 매 턴 보낼 지침 — 정책 + 질문에 맞는 참고 문서 + 되묻기 규칙.
 * 스트리밍 라우트도 같은 지침을 쓴다. 두 경로가 다른 말을 하면 안 된다.
 */
export function buildChatInstructions(userText: string): string {
  return mergeInstructionsWithRag(userText);
}

function mergeInstructionsWithRag(userText: string): string {
  const ragContext = buildChatRagContext(userText);
  const parts = [CHAT_INSTRUCTIONS];
  if (ragContext.trim()) {
    parts.push("", RAG_HEADING, ragContext);
  }

  /*
    되묻기 정책은 **맨 뒤**에 둔다.
    앞에 붙이면 참고 문서 수천 자에 묻혀서 모델이 그냥 답해 버린다.
    fitlog에서 실제로 확인한 함정이다.
  */
  parts.push("", "──── 답하기 전에 확인 ────", ASK_USER_POLICY);
  return parts.join("\n");
}

const RAG_HEADING = "──── 참고 문서 ────";

export async function runChatTurn(params: {
  userText: string;
  openAiConversationId: string;
}): Promise<ChatTurnResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const instructions = mergeInstructionsWithRag(params.userText);
  const trimmedUser = params.userText.trim();

  const { id, output_text, usage } = await createOpenAiResponse({
    model,
    instructions,
    userMessage: trimmedUser,
    conversation: params.openAiConversationId,
  });

  return { assistantText: output_text, openAiResponseId: id, usage };
}

export async function generateChatSubjectLine(userMessage: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const trimmed = userMessage.trim().slice(0, 600);
  if (!trimmed) return null;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            '사용자의 첫 질문을 보고 이 채팅방 제목을 한 줄로 정합니다. 반드시 JSON 한 객체만 출력합니다. 키는 정확히 "subject" 하나이고, 값은 공백 제외 최대 28자 한국어 또는 짧은 영어 단어 위주 문자열입니다.',
        },
        { role: "user", content: trimmed },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { subject?: unknown };
    const s = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    if (!s) return null;
    return s.slice(0, 40);
  } catch {
    return null;
  }
}
