import { NextResponse } from "next/server";

/**
 * 이어서 물어볼 것.
 *
 * 선택항목이 **첫 화면에만** 있어서, 대화가 시작되면 사라졌다. 그 뒤로는 무엇을
 * 더 물어도 되는지 알 수 없어 계속 직접 타이핑해야 했다.
 *
 * FitLog는 사용자의 검사 기록에서 칩을 뽑지만 이 앱에는 그런 수치 기록이 없다.
 * 그래서 지금은 고정 목록이다. 나중에 최근 단어장·오답노트에서 뽑을 수 있다.
 */

export const runtime = "nodejs";

type Chip = { text: string; from: "general" };

/** 대화를 이어갈 때 */
const GENERAL: Chip[] = [
  { text: "이 문제 풀이 알려줘", from: "general" },
  { text: "왜 틀렸는지 짚어줘", from: "general" },
  { text: "비슷한 문제 하나 더 내줘", from: "general" },
];

/** 아직 아무것도 안 물어봤을 때 — 무엇을 할 수 있는 곳인지 알려주는 쪽으로 */
const EMPTY: Chip[] = [
  { text: "여기서 뭘 할 수 있어?", from: "general" },
  { text: "오답노트는 어떻게 만들어?", from: "general" },
  { text: "틀린 문제는 어떻게 정리해?", from: "general" },
  { text: "복습은 언제 하는 게 좋아?", from: "general" },
];

export async function GET(req: Request) {
  const started = new URL(req.url).searchParams.get("started") === "1";
  return NextResponse.json({ ok: true, chips: started ? GENERAL : EMPTY });
}
