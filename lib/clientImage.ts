/**
 * 브라우저에서 이미지를 만들 때 쓰는 공통 유틸.
 *
 * 필요한 이유: Vercel Functions는 요청 본문이 4.5MB를 넘으면 함수에 닿기도 전에
 * FUNCTION_PAYLOAD_TOO_LARGE로 잘린다. 휴대폰 사진을 원본 해상도로 이진화한 PNG는
 * 잡음이 많을 때 수 MB까지 커지므로, 업로드 전에 해상도를 제한한다.
 */

/** 업로드 상한 (플랫폼 한도 4.5MB 아래로 여유를 둔 값) */
export const UPLOAD_HARD_LIMIT_BYTES = 4 * 1024 * 1024;

/** 재인코딩을 시도할 기준 크기 — 이보다 크면 해상도를 한 단계 낮춘다 */
export const UPLOAD_RETRY_THRESHOLD_BYTES = 3.5 * 1024 * 1024;

/** 노트 이미지 긴 변 상한. 이 정도면 확대해도 글씨가 읽힌다. */
export const NOTE_IMAGE_MAX_EDGE = 2400;

/** 용량이 초과될 때 순차적으로 낮춰볼 해상도 */
export const NOTE_IMAGE_FALLBACK_EDGES = [2400, 1800, 1400];

/** 긴 변이 maxEdge를 넘지 않도록 축소한 크기(확대는 하지 않음) */
export function fitInside(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** 업로드 가능한 크기인지 확인. 불가하면 사용자에게 보여줄 메시지를 돌려준다. */
export function checkUploadSize(
  file: File | Blob,
): { ok: true } | { ok: false; error: string } {
  if (file.size <= UPLOAD_HARD_LIMIT_BYTES) return { ok: true };
  return {
    ok: false,
    error: `이미지 용량이 너무 큽니다. (${(file.size / (1024 * 1024)).toFixed(1)}MB) 사진을 다시 촬영하거나 영역을 좁혀서 시도해 주세요.`,
  };
}
