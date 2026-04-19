"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";

export type CropResult = { file: File; dataUrl: string };

interface Props {
  imageSrc: string;
  onCrop: (result: CropResult) => void;
  onCancel: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "t"
  | "b"
  | "l"
  | "r"
  | "move"
  | null;

const HANDLE_SIZE = 22;
const MIN_CROP = 30;

export function ImageCropper({ imageSrc, onCrop, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);

  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState<Handle>(null);
  const dragStart = useRef({ mx: 0, my: 0, crop: { x: 0, y: 0, w: 0, h: 0 } });

  const loadImage = useCallback(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);

      const container = containerRef.current;
      if (!container) return;
      const maxW = container.clientWidth;
      const maxH = window.innerHeight * 0.6;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const dw = Math.round(img.naturalWidth * scale);
      const dh = Math.round(img.naturalHeight * scale);
      setDisplayW(dw);
      setDisplayH(dh);

      const pad = Math.round(Math.min(dw, dh) * 0.1);
      setCrop({ x: pad, y: pad, w: dw - pad * 2, h: dh - pad * 2 });
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => { loadImage(); }, [loadImage]);

  const clampCrop = useCallback(
    (r: Rect): Rect => ({
      x: Math.max(0, Math.min(r.x, displayW - MIN_CROP)),
      y: Math.max(0, Math.min(r.y, displayH - MIN_CROP)),
      w: Math.max(MIN_CROP, Math.min(r.w, displayW - r.x)),
      h: Math.max(MIN_CROP, Math.min(r.h, displayH - r.y)),
    }),
    [displayW, displayH],
  );

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const offsetX = (container.clientWidth - displayW) / 2;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left - offsetX, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left - offsetX, y: e.clientY - rect.top };
  };

  const hitTest = (px: number, py: number): Handle => {
    const { x, y, w, h } = crop;
    const hs = HANDLE_SIZE / 2;
    const corners: [Handle, number, number][] = [
      ["tl", x, y],
      ["tr", x + w, y],
      ["bl", x, y + h],
      ["br", x + w, y + h],
    ];
    for (const [handle, cx, cy] of corners) {
      if (Math.abs(px - cx) < hs && Math.abs(py - cy) < hs) return handle;
    }
    const edges: [Handle, boolean][] = [
      ["t", Math.abs(py - y) < hs && px > x + hs && px < x + w - hs],
      ["b", Math.abs(py - (y + h)) < hs && px > x + hs && px < x + w - hs],
      ["l", Math.abs(px - x) < hs && py > y + hs && py < y + h - hs],
      ["r", Math.abs(px - (x + w)) < hs && py > y + hs && py < y + h - hs],
    ];
    for (const [handle, hit] of edges) {
      if (hit) return handle;
    }
    if (px > x && px < x + w && py > y && py < y + h) return "move";
    return null;
  };

  const onPointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    const pos = getPos(e);
    const handle = hitTest(pos.x, pos.y);
    if (!handle) return;
    e.preventDefault();
    setDragging(handle);
    dragStart.current = { mx: pos.x, my: pos.y, crop: { ...crop } };
  };

  const onPointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - dragStart.current.mx;
    const dy = pos.y - dragStart.current.my;
    const s = dragStart.current.crop;

    let next: Rect;
    switch (dragging) {
      case "move":
        next = { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h };
        next.x = Math.max(0, Math.min(next.x, displayW - next.w));
        next.y = Math.max(0, Math.min(next.y, displayH - next.h));
        break;
      case "tl":
        next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy };
        break;
      case "tr":
        next = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy };
        break;
      case "bl":
        next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy };
        break;
      case "br":
        next = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy };
        break;
      case "t":
        next = { x: s.x, y: s.y + dy, w: s.w, h: s.h - dy };
        break;
      case "b":
        next = { x: s.x, y: s.y, w: s.w, h: s.h + dy };
        break;
      case "l":
        next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h };
        break;
      case "r":
        next = { x: s.x, y: s.y, w: s.w + dx, h: s.h };
        break;
      default:
        return;
    }
    setCrop(clampCrop(next));
  };

  const onPointerUp = () => setDragging(null);

  const doCrop = () => {
    if (!imgRef.current || !displayW) return;

    const scaleX = naturalW / displayW;
    const scaleY = naturalH / displayH;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw, sh);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "cropped.png", { type: "image/png" });
        const dataUrl = canvas.toDataURL("image/png");
        onCrop({ file, dataUrl });
      },
      "image/png",
      0.95,
    );
  };

  const cursorForHandle = (h: Handle): string => {
    switch (h) {
      case "tl":
      case "br":
        return "nwse-resize";
      case "tr":
      case "bl":
        return "nesw-resize";
      case "t":
      case "b":
        return "ns-resize";
      case "l":
      case "r":
        return "ew-resize";
      case "move":
        return "move";
      default:
        return "default";
    }
  };

  const handleCursor = (e: React.MouseEvent) => {
    if (dragging) return;
    const pos = getPos(e);
    const h = hitTest(pos.x, pos.y);
    const el = containerRef.current;
    if (el) el.style.cursor = cursorForHandle(h);
  };

  return (
    <div style={wrapperStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>문제 영역 자르기</h3>
        <button type="button" onClick={onCancel} style={cancelBtnStyle}>취소</button>
      </div>

      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>
        문제 부분만 남기도록 영역을 조절한 후 확인 버튼을 누르세요.
      </p>

      <div
        ref={containerRef}
        style={{ position: "relative", touchAction: "none", display: "flex", justifyContent: "center", userSelect: "none" }}
        onMouseDown={onPointerDown}
        onMouseMove={(e) => { onPointerMove(e); handleCursor(e); }}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        {imgLoaded && (
          <div style={{ position: "relative", width: displayW, height: displayH }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="crop source"
              style={{ width: displayW, height: displayH, display: "block", pointerEvents: "none" }}
              draggable={false}
            />

            {/* dim overlay - four rectangles around crop area */}
            <div style={{ ...dimStyle, top: 0, left: 0, width: displayW, height: crop.y }} />
            <div style={{ ...dimStyle, top: crop.y, left: 0, width: crop.x, height: crop.h }} />
            <div style={{ ...dimStyle, top: crop.y, left: crop.x + crop.w, width: displayW - crop.x - crop.w, height: crop.h }} />
            <div style={{ ...dimStyle, top: crop.y + crop.h, left: 0, width: displayW, height: displayH - crop.y - crop.h }} />

            {/* crop border */}
            <div style={{
              position: "absolute",
              left: crop.x,
              top: crop.y,
              width: crop.w,
              height: crop.h,
              border: "2px solid var(--accent)",
              boxSizing: "border-box",
              pointerEvents: "none",
            }} />

            {/* corner handles */}
            {(
              [
                ["tl", crop.x, crop.y],
                ["tr", crop.x + crop.w, crop.y],
                ["bl", crop.x, crop.y + crop.h],
                ["br", crop.x + crop.w, crop.y + crop.h],
              ] as [string, number, number][]
            ).map(([key, cx, cy]) => (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left: cx - 6,
                  top: cy - 6,
                  width: 12,
                  height: 12,
                  background: "var(--accent)",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* rule-of-thirds guides */}
            <div style={{ ...guideLineStyle, left: crop.x + crop.w / 3, top: crop.y, width: 1, height: crop.h }} />
            <div style={{ ...guideLineStyle, left: crop.x + (crop.w * 2) / 3, top: crop.y, width: 1, height: crop.h }} />
            <div style={{ ...guideLineStyle, left: crop.x, top: crop.y + crop.h / 3, width: crop.w, height: 1 }} />
            <div style={{ ...guideLineStyle, left: crop.x, top: crop.y + (crop.h * 2) / 3, width: crop.w, height: 1 }} />

            {/* crop size label */}
            <div style={{
              position: "absolute",
              left: crop.x + crop.w / 2,
              top: crop.y + crop.h + 6,
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}>
              {Math.round(crop.w * (naturalW / displayW))} × {Math.round(crop.h * (naturalH / displayH))}
            </div>
          </div>
        )}

        {!imgLoaded && (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>이미지 로딩 중…</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={doCrop}
        disabled={!imgLoaded}
        style={confirmBtnStyle}
      >
        ✂️ 이 영역으로 자르기
      </button>
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 250,
  background: "var(--bg-base, #111)",
  display: "flex",
  flexDirection: "column",
  padding: "16px",
  overflow: "auto",
};

const dimStyle: CSSProperties = {
  position: "absolute",
  background: "rgba(0, 0, 0, 0.5)",
  pointerEvents: "none",
};

const guideLineStyle: CSSProperties = {
  position: "absolute",
  background: "rgba(255,255,255,0.25)",
  pointerEvents: "none",
};

const cancelBtnStyle: CSSProperties = {
  padding: "0.4rem 0.85rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontSize: 13,
  cursor: "pointer",
};

const confirmBtnStyle: CSSProperties = {
  marginTop: 12,
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
