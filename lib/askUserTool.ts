/**
 * 되묻기 — 모델이 **정보가 부족할 때 사용자에게 선택지를 제시**하게 하는 도구.
 *
 * OpenAI API에는 이런 전용 기능이 없다. 함수 도구 호출로 만든다 —
 * 모델이 `ask_user`를 "부르면" 앱이 그 자리에 버튼을 그리고, 사용자가 고른 값을
 * 도구 결과로 되돌려주면 대화가 이어진다.
 *
 * 구조화 출력(JSON Schema)으로도 만들 수 있지만 그러면 응답 전체가 JSON이 되어
 * **스트리밍이 깨진다.** 도구 호출은 모델이 *답변* 아니면 *되묻기* 중 하나를
 * 고르는 방식이라, 답변 쪽은 지금처럼 글자가 쌓이는 걸 그대로 보여줄 수 있다.
 *
 * 앱마다 되물을 자리가 다르다. 정책은 아래 `ASK_USER_POLICY`에 있다.
 */

export const ASK_USER_TOOL = {
  type: "function" as const,
  name: "ask_user",
  description:
    "답을 정확히 하려면 사용자만 알 수 있는 정보가 꼭 필요할 때 부른다. " +
    "선택지를 주어 한 번에 고르게 한다. 기록에 이미 있는 것은 묻지 않는다.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["question", "options"],
    properties: {
      question: {
        type: "string",
        description: "한 문장으로 된 질문. 해요체.",
      },
      options: {
        type: "array",
        description:
          "고를 수 있는 답 2~4개. 짧은 구절로. '잘 모르겠어요'처럼 빠져나갈 선택지를 하나 넣는다.",
        items: { type: "string" },
      },
    },
  },
} as const;

export type AskUserPayload = { question: string; options: string[] };

/** 도구 인자를 안전하게 읽는다. 모델이 이상한 걸 채워도 화면이 깨지면 안 된다 */
export function parseAskUser(rawArguments: string): AskUserPayload | null {
  try {
    const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
    const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .filter((o): o is string => typeof o === "string")
          .map((o) => o.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    if (!question || options.length < 2) return null;
    return { question, options };
  } catch {
    return null;
  }
}

/**
 * 지침에 붙일 되묻기 규칙.
 *
 * 도구만 주면 모델이 지나치게 자주 묻는다. "매번 되묻는 상담사"는 안 묻는 것보다
 * 나쁘다 — 한 번에 답을 못 얻으니까. 그래서 **언제 묻지 않는지**를 더 길게 쓴다.
 */
export const ASK_USER_POLICY = `[되묻기 — ask_user 도구]
답이 **학생의 상황에 따라 갈릴 때**, 추측하지 말고 ask_user를 불러 선택지로 묻습니다.

- 문제 풀이를 도와달라는데 어디까지 이해했는지 모를 때
  (풀이 전체가 필요한지, 막힌 부분만 짚으면 되는지)
- "이거 왜 틀렸어요?"인데 어떤 답을 썼는지 모를 때
- 어느 학년·단원 기준으로 설명할지 모를 때 (같은 개념도 설명이 달라집니다)
- 공부 방법을 물을 때, 지금 목표가 무엇인지 (오답 정리인지, 시험 대비인지)

**묻지 않습니다** (바로 답합니다):
- 개념 설명처럼 답이 하나로 정해지는 질문
- 사용자가 이미 상황을 말한 경우
- 되물으면 오히려 흐름이 끊기는 짧은 질문

규칙:
- 한 번에 하나만. 연달아 되묻지 않습니다.
- 선택지는 2~4개, 짧고 쉬운 말로. 마지막에 "잘 모르겠어요"를 둡니다.
- "잘 모르겠어요"를 고르면 다시 묻지 말고 **경우를 나눠** 설명합니다.
- 되물을 때는 본문을 함께 쓰지 않습니다. 도구만 부르고 기다립니다.`;
