"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage } from "react-konva";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { BoundingBox } from "@/lib/problemTypes";

export type CanvasProblem = {
  _id?: string;
  problemId: string;
  questionNumber: number;
  questionText: string;
  type: string;
  layout: BoundingBox;
  answerArea: BoundingBox;
  userAnswer: string;
  correctAnswer: string;
  isWrong: boolean;
};

interface ProblemCanvasProps {
  imageSrc: string;
  problems: CanvasProblem[];
  onProblemClick?: (problem: CanvasProblem) => void;
  maxWidth?: number;
}

export function ProblemCanvas({
  imageSrc,
  problems,
  onProblemClick,
  maxWidth = 800,
}: ProblemCanvasProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ w: 400, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      const containerW = containerRef.current?.clientWidth ?? maxWidth;
      const scale = Math.min(containerW, maxWidth) / img.naturalWidth;
      setDims({
        w: Math.round(img.naturalWidth * scale),
        h: Math.round(img.naturalHeight * scale),
      });
    };
    img.src = imageSrc;
  }, [imageSrc, maxWidth]);

  const handleClick = useCallback(
    (p: CanvasProblem) => {
      onProblemClick?.(p);
    },
    [onProblemClick],
  );

  if (!image) {
    return (
      <div ref={containerRef} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
        이미지 로딩 중…
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", overflow: "hidden", borderRadius: 12, border: "1px solid var(--border)" }}>
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
      >
        <TransformComponent wrapperStyle={{ width: "100%" }}>
          <Stage width={dims.w} height={dims.h}>
            <Layer>
              <KonvaImage image={image} width={dims.w} height={dims.h} />

              {problems.map((p) => (
                <ProblemOverlay
                  key={p.problemId}
                  problem={p}
                  width={dims.w}
                  height={dims.h}
                  onClick={() => handleClick(p)}
                />
              ))}
            </Layer>
          </Stage>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function ProblemOverlay({
  problem: p,
  width,
  height,
  onClick,
}: {
  problem: CanvasProblem;
  width: number;
  height: number;
  onClick: () => void;
}) {
  return (
    <>
      {/* 문제 영역 */}
      <Rect
        x={p.layout.x * width}
        y={p.layout.y * height}
        width={p.layout.width * width}
        height={p.layout.height * height}
        stroke="#3b82f6"
        strokeWidth={1.5}
        dash={[4, 4]}
        opacity={0.6}
        onClick={onClick}
        onTap={onClick}
      />

      {/* 오답 영역 */}
      {p.isWrong && (
        <Rect
          x={p.answerArea.x * width}
          y={p.answerArea.y * height}
          width={p.answerArea.width * width}
          height={p.answerArea.height * height}
          stroke="#ef4444"
          strokeWidth={2}
          fill="rgba(239, 68, 68, 0.15)"
          cornerRadius={4}
          onClick={onClick}
          onTap={onClick}
        />
      )}

      {/* 문제 번호 라벨 */}
      <Rect
        x={p.layout.x * width}
        y={p.layout.y * height - 22}
        width={28}
        height={20}
        fill={p.isWrong ? "#ef4444" : "#3b82f6"}
        cornerRadius={4}
      />
      <Text
        x={p.layout.x * width + 2}
        y={p.layout.y * height - 20}
        text={`${p.questionNumber}`}
        fontSize={13}
        fontStyle="bold"
        fill="#fff"
        width={24}
        align="center"
      />
    </>
  );
}
