export type ChatRagChunk = {
  id: string;
  keywords: string[];
  body: string;
  baseScore?: number;
};

export const CHAT_RAG_CHUNKS: ChatRagChunk[] = [
  {
    id: "math-vision-overview",
    keywords: ["오답", "사진", "시험지", "문제집", "비전", "vision", "OCR", "분석", "캔버스"],
    body: `SnapMath는 수학 시험지/문제집 사진에서 틀린 문제를 AI로 추출하고, 이미지 위에 좌표 기반 오버레이로 표시합니다.

핵심 흐름:
1. 사진 업로드 → OpenAI Vision API가 이미지 분석
2. 한국 초등학교 채점 방식에 따라 오답을 감지:
   - 빨간 동그라미(○) 또는 체크(✓) = **정답** (맞은 문제) → 건너뜀
   - 아무 표시 없음 = **오답** (틀린 문제) → 추출 대상
   - 빨간 X 또는 빨간 펜 수정 = **오답** → 추출 대상
3. 각 오답 문제의 위치(layout), 답안 영역(answerArea)을 0~1 비율 좌표로 추출
4. 문제 텍스트, 학생 답, 정답, 문제 유형을 JSON으로 구조화
5. React Konva 캔버스로 원본 이미지 위에 오답 영역을 시각적으로 표시
6. react-zoom-pan-pinch로 확대/이동 기능 제공

데이터 스키마:
- problemId: 문제 고유 ID
- questionNumber: 문제 번호
- questionText: 문제 전문 (LaTeX 수식 포함)
- type: multiple_choice | subjective | fill_blank | calculation
- layout: { x, y, width, height } 문제 영역 좌표 (0~1)
- answerArea: { x, y, width, height } 답안 영역 좌표 (0~1)
- userAnswer: 학생이 쓴 답
- correctAnswer: 정답
- isWrong: 오답 여부`,
    baseScore: 5,
  },
  {
    id: "math-latex-format",
    keywords: ["수식", "LaTeX", "KaTeX", "분수", "곱셈", "나눗셈", "제곱", "렌더링"],
    body: `수학 수식은 LaTeX로 저장되고 KaTeX로 렌더링됩니다.
주요 표현: \\frac{분자}{분모}, \\times, \\div, \\sqrt{}, \\square(빈칸), a^{2}, \\leq, \\geq
React Konva 캔버스 위에는 좌표 기반으로 오답 영역이 빨간색으로 표시됩니다.
카드 뷰에서는 MathText 컴포넌트가 LaTeX를 자동 감지하여 수식으로 렌더링합니다.`,
    baseScore: 3,
  },
  {
    id: "wrong-note-workflow",
    keywords: ["오답노트", "워크플로", "폴더", "추가", "관리", "프린트", "캔버스"],
    body: `오답노트 흐름:
1. 폴더 생성 → 오답노트 생성
2. 사진 업로드 → AI가 오답 추출 (좌표 + 텍스트 + 정답)
3. 캔버스 프리뷰에서 오답 영역 확인 → 저장
4. 오답노트 상세에서 이미지 위에 오답 오버레이 표시
5. 카드 클릭 → 문제/학생답/정답 확인
6. Print 페이지에서 연습지 인쇄 (문제 → 정답 비교표)
수동 입력은 없으며 사진으로만 추가합니다.`,
    baseScore: 4,
  },
  {
    id: "korean-elementary-math",
    keywords: ["초등", "곱셈", "분수", "나눗셈", "채점", "빨간", "동그라미"],
    body: `한국 초등학교 채점 방식:
- 빨간 동그라미(○) = **정답** (맞은 문제). 문제 번호 위에 빨간 원을 그려줌.
- 아무 표시 없음 = **오답** (틀린 문제). 채점에서 빠진 것이 아니라 틀렸기 때문에 표시를 안 함.
- 빨간 X = **오답**. 일부 교사가 사용.
- 빨간 펜 수정 = **오답**. 교사가 정답을 빨간 펜으로 적어줌.

중요: 한국 초등 채점에서 빨간 동그라미는 "맞았다"는 의미이므로, 빨간 동그라미가 있는 문제는 정답이고 건너뛰어야 합니다.

주요 단원: 곱셈(세로셈), 분수(분수만큼의 양), 나눗셈, 측정.
문제 유형: 빈칸("□ 안에 알맞은 수"), 서술형("풀이 과정을 쓰고"), 계산, 암호표.
학생이 손글씨로 답을 쓰고 선생님이 빨간 펜으로 채점합니다.`,
    baseScore: 2,
  },
];

function tokenizeForMatch(s: string): Set<string> {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (const m of lower.matchAll(/[\p{L}\p{N}]+/gu)) {
    const w = m[0];
    if (w.length >= 2) out.add(w);
  }
  return out;
}

function scoreChunk(userText: string, tokens: Set<string>, c: ChatRagChunk): number {
  let score = c.baseScore ?? 0;
  const lowerUser = userText.toLowerCase();
  for (const kw of c.keywords) {
    const k = kw.toLowerCase();
    if (k.length === 0) continue;
    if (lowerUser.includes(k)) score += 12;
    if (tokens.has(k)) score += 4;
  }
  const bodyLower = c.body.toLowerCase();
  for (const t of tokens) {
    if (t.length >= 4 && bodyLower.includes(t)) score += 0.35;
  }
  return score;
}

export function buildChatRagContext(userText: string, maxChars = 4200): string {
  const trimmed = userText.trim();
  if (CHAT_RAG_CHUNKS.length === 0) return "";
  const tokens = tokenizeForMatch(trimmed);
  const ranked = CHAT_RAG_CHUNKS
    .map((c) => ({ c, s: scoreChunk(trimmed, tokens, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const blocks: string[] = [];
  let used = 0;
  const sep = "\n\n";
  for (const { c } of ranked) {
    const next = `### ${c.id}\n${c.body.trim()}`;
    if (used + sep.length + next.length > maxChars) break;
    blocks.push(next);
    used += sep.length + next.length;
  }
  return blocks.join("\n\n");
}
