import OpenAI from "openai";
import { buildChatRagContext } from "@/lib/chatRagDocuments";
import { createOpenAiResponse, type ResponsesCreateUsage } from "@/lib/openAiConversations";

const CHAT_INSTRUCTIONS = `당신은 SnapMath 앱의 챗봇입니다.
사용자의 질문에 친절하게 답변합니다.`;

export type ChatTurnResult = {
  assistantText: string;
  openAiResponseId: string;
  usage: ResponsesCreateUsage | null;
};

function mergeInstructionsWithRag(userText: string): string {
  const ragContext = buildChatRagContext(userText);
  if (!ragContext.trim()) return CHAT_INSTRUCTIONS;
  return [
    CHAT_INSTRUCTIONS,
    "",
    "──── 참고 문서 ────",
    ragContext,
  ].join("\n");
}

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
