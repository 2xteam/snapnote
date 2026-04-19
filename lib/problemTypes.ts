export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProblemType = "multiple_choice" | "subjective" | "fill_blank" | "calculation";

export type ProblemPayload = {
  problemId: string;
  questionNumber: number;
  questionText: string;
  type: ProblemType;
  layout: BoundingBox;
  answerArea: BoundingBox;
  userAnswer: string;
  correctAnswer: string;
  isWrong: boolean;
};

export function clampBox(box: unknown): BoundingBox {
  if (!box || typeof box !== "object") return { x: 0, y: 0, width: 1, height: 1 };
  const b = box as Record<string, unknown>;
  return {
    x: Math.max(0, Math.min(1, Number(b.x) || 0)),
    y: Math.max(0, Math.min(1, Number(b.y) || 0)),
    width: Math.max(0, Math.min(1, Number(b.width) || 0)),
    height: Math.max(0, Math.min(1, Number(b.height) || 0)),
  };
}

const VALID_TYPES = new Set<ProblemType>(["multiple_choice", "subjective", "fill_blank", "calculation"]);

export function normalizeProblem(raw: unknown): ProblemPayload {
  if (!raw || typeof raw !== "object") {
    return {
      problemId: "", questionNumber: 0, questionText: "",
      type: "calculation", layout: { x: 0, y: 0, width: 1, height: 1 },
      answerArea: { x: 0, y: 0, width: 1, height: 1 },
      userAnswer: "", correctAnswer: "", isWrong: false,
    };
  }
  const o = raw as Record<string, unknown>;

  const layout = clampBox(o.layout);
  let answerArea = o.answerArea ? clampBox(o.answerArea) : { ...layout };
  if (answerArea.width === 0 || answerArea.height === 0) answerArea = { ...layout };

  const rawType = typeof o.type === "string" ? o.type : "calculation";
  const type: ProblemType = VALID_TYPES.has(rawType as ProblemType) ? (rawType as ProblemType) : "calculation";

  return {
    problemId: typeof o.problemId === "string" ? o.problemId : `p${Date.now()}`,
    questionNumber: typeof o.questionNumber === "number" ? o.questionNumber : 0,
    questionText: typeof o.questionText === "string" ? o.questionText.trim() : "",
    type,
    layout,
    answerArea,
    userAnswer: typeof o.userAnswer === "string" ? o.userAnswer.trim() : "",
    correctAnswer: typeof o.correctAnswer === "string" ? o.correctAnswer.trim() : "",
    isWrong: Boolean(o.isWrong),
  };
}
