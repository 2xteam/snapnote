"use client";

import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import { Fragment, useMemo } from "react";

/**
 * LaTeX 수식이 포함된 텍스트를 파싱하여 KaTeX로 렌더링합니다.
 *
 * 지원 패턴:
 * - $...$ 또는 $$...$$ 로 감싼 명시적 수식
 * - LaTeX 명령어가 포함된 텍스트 자동 감지 (\frac, \times, \div, \sqrt, \square 등)
 */

const LATEX_COMMANDS =
  /\\(?:frac|times|div|sqrt|square|leq|geq|neq|cdot|pm|mp|left|right|begin|end|text|mathrm|mathbf)\b/;

type Segment = { type: "text"; value: string } | { type: "math"; value: string };

function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    const dollarMatch = remaining.match(/\$\$([^$]+)\$\$|\$([^$]+)\$/);

    if (dollarMatch && dollarMatch.index !== undefined) {
      if (dollarMatch.index > 0) {
        segments.push({ type: "text", value: remaining.slice(0, dollarMatch.index) });
      }
      const mathContent = dollarMatch[1] ?? dollarMatch[2];
      segments.push({ type: "math", value: mathContent });
      remaining = remaining.slice(dollarMatch.index + dollarMatch[0].length);
    } else {
      segments.push({ type: "text", value: remaining });
      break;
    }
  }

  return segments;
}

function tryRenderLine(line: string): Segment[] {
  const parsed = parseSegments(line);

  if (parsed.length === 1 && parsed[0].type === "text") {
    const text = parsed[0].value;
    if (LATEX_COMMANDS.test(text)) {
      return [{ type: "math", value: text }];
    }
    return parsed;
  }

  return parsed;
}

interface MathTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MathText({ text, className, style }: MathTextProps) {
  const rendered = useMemo(() => {
    if (!text) return null;
    const lines = text.split("\n");

    return lines.map((line, lineIdx) => {
      const segments = tryRenderLine(line);
      return (
        <Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {segments.map((seg, segIdx) => {
            if (seg.type === "math") {
              try {
                return <InlineMath key={segIdx} math={seg.value} />;
              } catch {
                return <span key={segIdx}>{seg.value}</span>;
              }
            }
            return <span key={segIdx}>{seg.value}</span>;
          })}
        </Fragment>
      );
    });
  }, [text]);

  return (
    <span className={className} style={style}>
      {rendered}
    </span>
  );
}
