import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { logOpenAiChatCompletion } from "@/lib/openaiRequestLog";
import { mergeExtraInstructionsForModel } from "@/lib/openaiInstructions";
import { normalizeProblem, type ProblemPayload } from "@/lib/problemTypes";

const SYSTEM_PROMPT = `You are an AI that extracts WRONG answers from Korean elementary school math workbook/test images.
Return ONLY valid JSON.

Output schema:
{
  "problems": [
    {
      "problemId": "p1",
      "questionNumber": 37,
      "questionText": "□ 안에 알맞은 수를 써넣으세요.",
      "type": "fill_blank",
      "layout": { "x": 0.0, "y": 0.25, "width": 0.45, "height": 0.15 },
      "answerArea": { "x": 0.05, "y": 0.32, "width": 0.15, "height": 0.06 },
      "userAnswer": "63",
      "correctAnswer": "66",
      "isWrong": true
    }
  ]
}

=== CRITICAL: Korean grading system (채점 방식) ===
In Korean elementary school workbooks:
- Red circle (○) or red check mark (✓) on a problem = CORRECT answer (정답, 맞음)
- NO red mark on a problem = WRONG answer (오답, 틀림)
- Red X mark = WRONG answer
- Red ink correction writing = WRONG answer (teacher wrote the correct answer)

Therefore:
- Problems WITH red circles/check marks → SKIP (these are correct)
- Problems WITHOUT any red mark → Include as WRONG (isWrong: true)
- Problems with red X or corrections → Include as WRONG (isWrong: true)

=== Problem detection ===
1. First, identify ALL problems on the page by their printed question numbers (e.g., 36, 37, 38...).
2. For each problem, check if it has a red circle (○) or red check mark.
3. If it has a red circle → it is CORRECT → SKIP it.
4. If it has NO red mark, or has a red X → it is WRONG → include it.

=== Layout coordinates ===
All coordinates are normalized 0~1 relative to the full image dimensions.
- layout: bounding box around the ENTIRE problem area including question text, diagrams, and answer space.
  - x: left edge of the problem (0 = left edge of image, 1 = right edge)
  - y: top edge of the problem (0 = top of image, 1 = bottom)
  - width: horizontal span of the problem
  - height: vertical span of the problem
- answerArea: bounding box of ONLY the answer/blank area where the student writes.
  - Must be INSIDE or near the layout area.
  - Should tightly wrap just the answer region.

Coordinate tips:
- A typical page has 2 columns: left column problems have x ≈ 0.0~0.5, right column x ≈ 0.5~1.0.
- Each problem typically occupies height ≈ 0.08~0.20 of the page.
- Be precise: look at where the question number is printed and where the answer blank is.

=== Field rules ===
- questionNumber: The printed number (e.g., 37, 41).
- questionText: Full problem text in Korean. Use LaTeX for math: \\times, \\div, \\frac{a}{b}, \\sqrt{}, \\square (for blanks).
- type: "multiple_choice" | "subjective" | "fill_blank" | "calculation"
- userAnswer: What the student actually wrote (handwritten). Read carefully.
- correctAnswer: The correct answer. Solve the problem yourself if needed.
- isWrong: Always true (we only include wrong problems).
- problemId: "p1", "p2", etc.

DO NOT return markdown, code fences, or explanations. ONLY the JSON object.`;

const VISION_USER_INSTRUCTION = `Analyze this Korean elementary math workbook page.

Step 1: List ALL visible problem numbers on the page.
Step 2: For each problem, check if it has a RED CIRCLE (○) or RED CHECK MARK (✓).
  - RED CIRCLE present → This problem is CORRECT → SKIP it.
  - NO red mark or RED X → This problem is WRONG → Include it.
Step 3: For each WRONG problem, extract the layout coordinates, student's handwritten answer, and compute the correct answer.
Step 4: Return the JSON with only wrong problems.

Remember: In Korean schools, red circle (○) means the answer is CORRECT, not wrong.`;

function buildSystemPrompt(requestExtra?: string): string {
  const merged = mergeExtraInstructionsForModel(requestExtra);
  if (!merged) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n--- Additional instructions ---\n${merged}`;
}

function extractJsonObjectString(raw: string): string | null {
  const trimmed = raw.trim();
  try { JSON.parse(trimmed); return trimmed; } catch {/* */}
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) { const inner = fence[1].trim(); if (inner.startsWith("{")) return inner; }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

function parseProblemsFromLlmContent(content: string): ProblemPayload[] {
  const jsonString = extractJsonObjectString(content);
  if (!jsonString) throw new Error("LLM 응답에서 JSON 객체를 찾지 못했습니다.");
  let parsed: unknown;
  try { parsed = JSON.parse(jsonString); } catch { throw new Error("LLM JSON 파싱에 실패했습니다."); }
  if (!parsed || typeof parsed !== "object") throw new Error("LLM 응답이 객체가 아닙니다.");
  const root = parsed as Record<string, unknown>;
  const arr = Array.isArray(root.problems) ? root.problems : [];
  return arr.map(normalizeProblem).filter((p) => p.questionText.length > 0);
}

const ALLOWED_VISION_MIME = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
]);

export async function wrongItemsFromImage(
  image: Buffer,
  mimeType: string,
  options?: { extraInstructions?: string },
): Promise<ProblemPayload[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");

  const mt = mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_VISION_MIME.has(mt)) {
    throw new Error(`지원 이미지: jpeg, png, gif, webp (받음: ${mimeType || "없음"})`);
  }

  const modelFallback =
    process.env.OPENAI_VISION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini";

  const detail =
    process.env.OPENAI_IMAGE_DETAIL === "low" ? ("low" as const) : ("high" as const);

  const base64 = image.toString("base64");
  const dataUrl = `data:${mt};base64,${base64}`;

  const client = new OpenAI({ apiKey });
  const temperature = 0.15;
  const t0 = Date.now();

  let completion: ChatCompletion | null = null;
  try {
    completion = await client.chat.completions.create({
      model: modelFallback,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(options?.extraInstructions) },
        {
          role: "user",
          content: [
            { type: "text", text: VISION_USER_INSTRUCTION },
            { type: "image_url", image_url: { url: dataUrl, detail } },
          ],
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logOpenAiChatCompletion({
      kind: "vision", completion: null, modelFallback, temperature,
      durationMs: Date.now() - t0, success: false, errorMessage: msg,
      inputImageBytes: image.length, inputImageMime: mt, inputImageDetail: detail,
    });
    throw err;
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    await logOpenAiChatCompletion({
      kind: "vision", completion, modelFallback, temperature,
      durationMs: Date.now() - t0, success: false, errorMessage: "LLM 응답이 비어 있습니다.",
      inputImageBytes: image.length, inputImageMime: mt, inputImageDetail: detail,
    });
    throw new Error("LLM 응답이 비어 있습니다.");
  }

  try {
    const problems = parseProblemsFromLlmContent(content);
    await logOpenAiChatCompletion({
      kind: "vision", completion, modelFallback, temperature,
      durationMs: Date.now() - t0, success: true, wordsCount: problems.length,
      inputImageBytes: image.length, inputImageMime: mt, inputImageDetail: detail,
    });
    return problems;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logOpenAiChatCompletion({
      kind: "vision", completion, modelFallback, temperature,
      durationMs: Date.now() - t0, success: false, errorMessage: msg,
      inputImageBytes: image.length, inputImageMime: mt, inputImageDetail: detail,
    });
    throw err;
  }
}
