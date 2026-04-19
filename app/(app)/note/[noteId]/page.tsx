"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { MathText } from "@/components/MathText";
import dynamic from "next/dynamic";
import type { CanvasProblem } from "@/components/ProblemCanvas";

const ProblemCanvas = dynamic(
  () => import("@/components/ProblemCanvas").then((m) => m.ProblemCanvas),
  { ssr: false },
);

type NoteInfo = { _id: string; name: string; folderId?: string };
type ItemRow = CanvasProblem & { _id: string; imageUrl?: string };

export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ItemRow | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  const load = useCallback(async (s: SessionUser) => {
    const [nRes, iRes] = await Promise.all([
      fetch(`/api/wrong-notes/${noteId}?phone=${encodeURIComponent(s.phone)}`),
      fetch(`/api/wrong-items?noteId=${encodeURIComponent(noteId)}`),
    ]);
    const nj = (await nRes.json()) as { ok: boolean; item?: NoteInfo };
    const ij = (await iRes.json()) as { ok: boolean; items?: ItemRow[] };
    if (nj.ok && nj.item) setNote(nj.item);
    if (ij.ok && ij.items) setItems(ij.items.reverse());
    setLoaded(true);
  }, [noteId]);

  useEffect(() => { if (session) void load(session); }, [session, load]);

  const imageGroups = groupByImage(items);
  const backHref = note?.folderId ? `/home/folder/${note.folderId}` : "/home";

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href={backHref} style={backBtn} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>{note?.name ?? "오답노트"}</h1>
        <Link href={`/note/${noteId}/items`} style={btnSmall} title="문제 관리">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </Link>
      </div>

      {!loaded ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>오답이 없습니다. 사진으로 오답을 추가하세요.</p>
      ) : (
        <>
          {imageGroups.map(([imgUrl, probs]) => (
            <div key={imgUrl} style={{ marginBottom: "1rem" }}>
              {imgUrl && (
                <ProblemCanvas
                  imageSrc={imgUrl}
                  problems={probs}
                  onProblemClick={(p) => setSelected(p as ItemRow)}
                />
              )}
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {probs.map((p) => (
                  <div
                    key={p._id}
                    style={{
                      ...card,
                      borderColor: selected?._id === p._id ? "var(--accent)" : "var(--border)",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelected(selected?._id === p._id ? null : p)}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, color: p.isWrong ? "#ef4444" : "var(--text-primary)", fontSize: 15 }}>
                        {p.questionNumber}.
                      </span>
                      <span style={{ fontSize: 14, color: "var(--text-primary)", flex: 1, lineHeight: 1.6 }}>
                        <MathText text={p.questionText} />
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13 }}>
                      <span style={{ color: "#ef4444" }}>학생 답: <MathText text={p.userAnswer || "—"} /></span>
                      <span style={{ color: "var(--accent)" }}>정답: <MathText text={p.correctAnswer || "—"} /></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!imageGroups.some(([url]) => url) && items.map((it) => (
            <div key={it._id} style={card}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, color: it.isWrong ? "#ef4444" : "var(--text-primary)", fontSize: 15 }}>
                  {it.questionNumber}.
                </span>
                <span style={{ fontSize: 14, color: "var(--text-primary)", flex: 1, lineHeight: 1.6 }}>
                  <MathText text={it.questionText} />
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13 }}>
                <span style={{ color: "#ef4444" }}>학생 답: <MathText text={it.userAnswer || "—"} /></span>
                <span style={{ color: "var(--accent)" }}>정답: <MathText text={it.correctAnswer || "—"} /></span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function groupByImage(items: ItemRow[]): [string, ItemRow[]][] {
  const map = new Map<string, ItemRow[]>();
  for (const it of items) {
    const key = it.imageUrl || "";
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  return Array.from(map.entries());
}

const backBtn: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" };
const btnSmall: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", textDecoration: "none" };
const card: CSSProperties = { border: "1px solid var(--border)", borderRadius: 14, padding: "0.85rem", background: "var(--bg-card)", transition: "border-color 0.15s" };
