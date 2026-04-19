"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";

export type MonoResult = { file: File; dataUrl: string };

interface Props {
  imageSrc: string;
  onConfirm: (result: MonoResult) => void;
  onCancel: () => void;
}

function applyMono(
  src: HTMLImageElement,
  canvas: HTMLCanvasElement,
  threshold: number,
) {
  const w = src.naturalWidth;
  const h = src.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(src, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const val = gray >= threshold ? 255 : 0;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
}

export function MonoAdjust({ imageSrc, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [threshold, setThreshold] = useState(120);
  const [previewW, setPreviewW] = useState(0);
  const [previewH, setPreviewH] = useState(0);

  const loadImage = useCallback(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => { loadImage(); }, [loadImage]);

  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !previewRef.current) return;
    const img = imgRef.current;

    const maxW = Math.min(window.innerWidth - 32, 500);
    const maxH = window.innerHeight * 0.5;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const dw = Math.round(img.naturalWidth * scale);
    const dh = Math.round(img.naturalHeight * scale);
    setPreviewW(dw);
    setPreviewH(dh);

    const pCanvas = previewRef.current;
    pCanvas.width = dw;
    pCanvas.height = dh;
    const pCtx = pCanvas.getContext("2d")!;
    pCtx.drawImage(img, 0, 0, dw, dh);
    const imageData = pCtx.getImageData(0, 0, dw, dh);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const val = gray >= threshold ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    pCtx.putImageData(imageData, 0, 0);
  }, [imgLoaded, threshold]);

  const doConfirm = () => {
    if (!imgRef.current) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    applyMono(imgRef.current, canvas, threshold);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "mono.png", { type: "image/png" });
        const dataUrl = canvas.toDataURL("image/png");
        onConfirm({ file, dataUrl });
      },
      "image/png",
      0.95,
    );
  };

  return (
    <div style={wrapperStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#fff" }}>모노톤 조절</h3>
        <button type="button" onClick={onCancel} style={cancelBtnStyle}>취소</button>
      </div>

      {imgLoaded ? (
        <>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <canvas
              ref={previewRef}
              style={{ width: previewW, height: previewH, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Threshold slider */}
          <div style={{ padding: "0 4px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>밝기 임계값</span>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, minWidth: 36, textAlign: "right" }}>{threshold}</span>
            </div>
            <input
              type="range"
              min={80}
              max={240}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
              <span>어둡게 (글자 많이 남김)</span>
              <span>밝게 (배경 깨끗)</span>
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: "none" }} />

          <button type="button" onClick={doConfirm} style={confirmBtnStyle}>
            ✓ 이 설정으로 저장
          </button>
        </>
      ) : (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>이미지 로딩 중…</p>
        </div>
      )}
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 300,
  background: "rgba(10,10,15,0.95)",
  display: "flex",
  flexDirection: "column",
  padding: 16,
  overflow: "auto",
};

const cancelBtnStyle: CSSProperties = {
  padding: "0.4rem 0.85rem",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 13,
  cursor: "pointer",
};

const confirmBtnStyle: CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: 12,
  background: "var(--accent)",
  border: "none",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
