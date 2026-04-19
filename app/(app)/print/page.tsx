"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { MathText } from "@/components/MathText";
import katex from "katex";

type NoteRow = { _id: string; name: string };
type ItemRow = {
  _id: string;
  questionNumber: number;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isWrong: boolean;
  noteId: string;
};

export default function PrintPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<ItemRow[]>([]);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const loadingRef = useRef(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/wrong-notes?phone=${encodeURIComponent(session.phone)}`);
      const json = (await res.json()) as { ok: boolean; items?: NoteRow[] };
      if (json.ok && json.items) setNotes(json.items);
    })();
  }, [session]);

  const selectedNoteIds = useMemo(
    () => Object.entries(sel).filter(([, v]) => v).map(([k]) => k),
    [sel],
  );

  const loadItems = useCallback(async () => {
    if (!session || selectedNoteIds.length === 0) { setItems([]); setPick({}); return; }
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const all: ItemRow[] = [];
      for (const nid of selectedNoteIds) {
        const res = await fetch(`/api/wrong-items?noteId=${encodeURIComponent(nid)}`);
        const json = (await res.json()) as { ok: boolean; items?: Array<Record<string, unknown>> };
        if (json.ok && json.items) {
          for (const it of json.items) {
            all.push({
              _id: String(it._id ?? ""),
              questionNumber: typeof it.questionNumber === "number" ? it.questionNumber : 0,
              questionText: typeof it.questionText === "string" ? it.questionText : "",
              userAnswer: typeof it.userAnswer === "string" ? it.userAnswer : "",
              correctAnswer: typeof it.correctAnswer === "string" ? it.correctAnswer : "",
              isWrong: Boolean(it.isWrong),
              noteId: nid,
            });
          }
        }
      }
      setItems(all);
      const init: Record<string, boolean> = {};
      for (const w of all) init[w._id] = true;
      setPick(init);
    } finally {
      loadingRef.current = false;
    }
  }, [session, selectedNoteIds]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const toggleAll = (on: boolean) => {
    const next = { ...pick };
    for (const w of items) next[w._id] = on;
    setPick(next);
  };

  const doPrint = () => {
    const chosen = items.filter((w) => pick[w._id]);
    if (chosen.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const html = buildPrintHtml(chosen);
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.print();
  };

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>Print</h1>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>오답노트를 선택하면 문제가 조회됩니다. 체크한 항목만 인쇄됩니다.</p>

      <section style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>오답노트 선택</div>
        <div style={{ display: "grid", gap: 6, maxHeight: 200, overflow: "auto" }}>
          {notes.map((n) => (
            <label key={n._id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)", cursor: "pointer" }}>
              <input type="checkbox" className="custom-checkbox" checked={Boolean(sel[n._id])} onChange={(e) => setSel((s) => ({ ...s, [n._id]: e.target.checked }))} />
              {n.name}
            </label>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong>문제 ({items.length})</strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => toggleAll(true)}>전체 선택</button>
            <button type="button" onClick={() => toggleAll(false)}>전체 해제</button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 6, maxHeight: 320, overflow: "auto" }}>
          {items.map((it) => (
            <label key={it._id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "0.5rem", borderRadius: 8, background: "var(--bg-elevated)", fontSize: 14, color: "var(--text-primary)" }}>
              <input type="checkbox" className="custom-checkbox" checked={Boolean(pick[it._id])} onChange={(e) => setPick((p) => ({ ...p, [it._id]: e.target.checked }))} style={{ marginTop: 2 }} />
              <span>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                  <strong style={{ color: "#ef4444" }}>{it.questionNumber}.</strong>
                  <MathText text={it.questionText} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  학생: <MathText text={it.userAnswer || "—"} /> → 정답: <MathText text={it.correctAnswer || "—"} />
                </div>
              </span>
            </label>
          ))}
        </div>
        <button type="button" onClick={doPrint} style={{ marginTop: 12, width: "100%", padding: "0.75rem", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, borderRadius: 10 }}>인쇄</button>
      </section>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LATEX_CMD_RE = /\\(?:frac|times|div|sqrt|square|leq|geq|neq|cdot|pm|mp|left|right|begin|end|text|mathrm|mathbf)\b/;

function renderMathHtml(text: string): string {
  const lines = text.split("\n");
  return lines.map((line) => {
    const dollarParts = line.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
    if (dollarParts.length > 1) {
      return dollarParts.map((part) => {
        const m = part.match(/^\$\$([^$]+)\$\$$/) ?? part.match(/^\$([^$]+)\$$/);
        if (m) {
          try { return katex.renderToString(m[1], { throwOnError: false }); } catch { return escapeHtml(part); }
        }
        return escapeHtml(part);
      }).join("");
    }
    if (LATEX_CMD_RE.test(line)) {
      try { return katex.renderToString(line, { throwOnError: false }); } catch { return escapeHtml(line); }
    }
    return escapeHtml(line);
  }).join("<br/>");
}

function buildPrintHtml(items: { questionNumber: number; questionText: string; userAnswer: string; correctAnswer: string }[]): string {
  const blocks = items.map((q, i) => `<div class="q">
  <div class="qnum">${q.questionNumber || i + 1}.</div>
  <div class="qtext">${renderMathHtml(q.questionText)}</div>
  <div class="answer-blank"></div>
</div>`).join("");

  const answerRows = items.map((q, i) =>
    `<tr><td class="anum">${q.questionNumber || i + 1}</td><td class="acorrect">${renderMathHtml(q.correctAnswer)}</td><td class="auser">${renderMathHtml(q.userAnswer)}</td></tr>`
  ).join("");

  const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" crossorigin="anonymous">`;

  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"/>
<title>SnapMath 오답 연습지</title>
${katexCss}
<style>
  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; color: #111; max-width: 800px; margin: 20px auto; padding: 0 16px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .q { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
  .qnum { font-weight: 700; color: #333; margin-bottom: 4px; }
  .qtext { line-height: 1.8; }
  .answer-blank { margin-top: 8px; height: 40px; border-bottom: 1px dashed #ccc; }
  .answer-page { page-break-before: always; }
  .answer-page h2 { font-size: 16px; margin: 0 0 12px; border-bottom: 2px double #111; padding-bottom: 8px; }
  .answer-table { border-collapse: collapse; width: 100%; }
  .answer-table th { padding: 6px 10px; border-bottom: 2px solid #333; font-size: 13px; text-align: left; }
  .answer-table td { padding: 5px 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
  .anum { width: 40px; font-weight: 700; color: #555; text-align: center; }
  .acorrect { font-weight: 700; color: #1d4ed8; }
  .auser { color: #ef4444; }
  @media print { body { margin: 0; } .answer-page { break-before: page; } }
</style></head><body>
<h1>SnapMath — 오답 연습지</h1>
${blocks}
<div class="answer-page">
  <h2>정답 비교</h2>
  <table class="answer-table">
    <thead><tr><th>#</th><th>정답</th><th>학생 답</th></tr></thead>
    <tbody>${answerRows}</tbody>
  </table>
</div>
</body></html>`;
}

const cardStyle: CSSProperties = { background: "var(--bg-card)", borderRadius: 16, padding: "1rem", border: "1px solid var(--border)" };
