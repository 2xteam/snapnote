"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type NoteRow = { _id: string; name: string };
type ItemRow = {
  _id: string;
  imageUrl: string;
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
            const imgUrl = typeof it.imageUrl === "string" ? it.imageUrl : "";
            if (!imgUrl) continue;
            all.push({ _id: String(it._id ?? ""), imageUrl: imgUrl, noteId: nid });
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

  const printableItems = items.filter((w) => pick[w._id]);

  const doPrint = () => {
    if (printableItems.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const html = buildImagePrintHtml(printableItems);
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>Print</h1>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
        오답노트를 선택하면 문제 이미지가 조회됩니다.<br />
        체크한 항목만 좌→우 배치로 인쇄됩니다.
      </p>

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
          <strong>문제 이미지 ({items.length})</strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => toggleAll(true)}>전체 선택</button>
            <button type="button" onClick={() => toggleAll(false)}>전체 해제</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, maxHeight: 400, overflow: "auto" }}>
          {items.map((it) => (
            <label key={it._id} style={{ cursor: "pointer", position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: pick[it._id] ? "2px solid var(--accent)" : "2px solid var(--border)", transition: "border-color 0.15s" }}>
              <input type="checkbox" className="custom-checkbox" checked={Boolean(pick[it._id])} onChange={(e) => setPick((p) => ({ ...p, [it._id]: e.target.checked }))} style={{ position: "absolute", top: 6, left: 6, zIndex: 2 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.imageUrl} alt="문제" style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }} />
            </label>
          ))}
        </div>
        <button type="button" onClick={doPrint} disabled={printableItems.length === 0} style={{ marginTop: 12, width: "100%", padding: "0.75rem", background: printableItems.length > 0 ? "var(--accent)" : "var(--bg-elevated)", color: printableItems.length > 0 ? "#000" : "var(--text-muted)", border: "none", fontWeight: 600, borderRadius: "var(--radius-sm)", cursor: printableItems.length > 0 ? "pointer" : "default" }}>
          🖨️ 인쇄 ({printableItems.length}개)
        </button>
      </section>
    </div>
  );
}

function buildImagePrintHtml(items: ItemRow[]): string {
  const images = items.map((it) =>
    `<div class="cell"><img src="${escapeAttr(it.imageUrl)}" /></div>`
  ).join("");

  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"/>
<title>SnapNote 오답 연습지</title>
<style>
  @page { margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
    padding: 0;
  }
  .cell {
    break-inside: avoid;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cell img {
    width: 100%;
    height: auto;
    display: block;
  }
  @media print {
    .grid { gap: 4mm; }
    .cell { border: 0.5px solid #ccc; }
  }
</style></head><body>
<div class="grid">${images}</div>
</body></html>`;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const cardStyle: CSSProperties = { background: "var(--bg-card)", borderRadius: "var(--radius-lg)", padding: "1rem" };
