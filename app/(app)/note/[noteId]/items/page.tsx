"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { MathText } from "@/components/MathText";
import dynamic from "next/dynamic";
import type { CanvasProblem } from "@/components/ProblemCanvas";
import type { ProblemPayload } from "@/lib/problemTypes";

const ProblemCanvas = dynamic(
  () => import("@/components/ProblemCanvas").then((m) => m.ProblemCanvas),
  { ssr: false },
);

type ItemRow = CanvasProblem & { _id?: string; imageUrl?: string };
type DialogMode = "vision" | "confirmDelete" | null;

export default function NoteItemsEditPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [visionProblems, setVisionProblems] = useState<ProblemPayload[]>([]);
  const [visionImageUrl, setVisionImageUrl] = useState("");
  const [visionImageSrc, setVisionImageSrc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  const load = useCallback(async () => {
    if (!noteId) return;
    const res = await fetch(`/api/wrong-items?noteId=${encodeURIComponent(noteId)}`);
    const json = (await res.json()) as { ok: boolean; items?: ItemRow[] };
    if (json.ok && json.items) setRows(json.items.reverse());
    setLoaded(true);
  }, [noteId]);

  useEffect(() => { void load(); }, [load]);

  const closeDialog = () => { setDialogMode(null); setVisionProblems([]); setVisionImageSrc(""); setVisionImageUrl(""); };

  const runVision = async (file: File | null) => {
    if (!file || !session) return;
    setBusy("vision");
    setMsg(null);
    try {
      // 1) Upload image
      const uploadFd = new FormData();
      uploadFd.set("file", file);
      const uploadRes = await fetch("/api/upload-image", { method: "POST", body: uploadFd });
      const uploadJson = (await uploadRes.json()) as { ok: boolean; url?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.ok || !uploadJson.url) {
        setMsg(uploadJson.error ?? "이미지 업로드 실패");
        return;
      }
      const imgUrl = uploadJson.url;
      setVisionImageUrl(imgUrl);
      setVisionImageSrc(imgUrl);

      // 2) Vision analysis
      const visionFd = new FormData();
      visionFd.set("file", file);
      const visionRes = await fetch("/api/openai-vision", { method: "POST", body: visionFd });
      const visionJson = (await visionRes.json()) as { ok: boolean; problems?: ProblemPayload[]; error?: string };
      if (!visionRes.ok || !visionJson.ok || !visionJson.problems?.length) {
        setMsg(visionJson.error ?? "오답을 찾지 못했습니다. 오답 표시가 없거나 인식에 실패했습니다.");
        return;
      }
      setVisionProblems(visionJson.problems);
      setDialogMode("vision");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const submitVision = async () => {
    if (!session || !noteId || visionProblems.length === 0) return;
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/wrong-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          noteId,
          phone: session.phone,
          imageUrl: visionImageUrl,
          problems: visionProblems,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) { setMsg(json.error ?? "저장 실패"); return; }
      closeDialog();
      await load();
    } finally {
      setBusy(null);
    }
  };

  const removeVisionProblem = (i: number) => {
    setVisionProblems((prev) => prev.filter((_, j) => j !== i));
  };

  const askDelete = (i: number) => { setDeleteTarget(i); setDialogMode("confirmDelete"); };

  const confirmDelete = async () => {
    if (deleteTarget === null || !session) return;
    const row = rows[deleteTarget];
    if (row._id) {
      const res = await fetch(`/api/wrong-items/${row._id}?phone=${encodeURIComponent(session.phone)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean };
      if (!res.ok || !json.ok) { setMsg("삭제 실패"); setDialogMode(null); setDeleteTarget(null); return; }
    }
    setRows((prev) => prev.filter((_, j) => j !== deleteTarget));
    setDialogMode(null);
    setDeleteTarget(null);
  };

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {busy === "vision" && (
        <div style={overlayFull}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>이미지 분석 중…</p>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>오답 표시를 찾고 있습니다</p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href={`/note/${noteId}`} style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>오답 관리</h1>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...btn, cursor: "pointer", display: "inline-block" }}>
          📷 사진으로 오답 추가
          <input type="file" accept="image/*" hidden onChange={(e) => void runVision(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {msg ? <p style={{ fontSize: 13, color: msg.includes("저장") ? "var(--success)" : "var(--danger)" }}>{msg}</p> : null}

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {!loaded ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>오답이 없습니다. 사진으로 추가하세요.</p>
        ) : (
          rows.map((r, i) => (
            <div key={`${r._id ?? "new"}-${i}`} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: r.isWrong ? "#ef4444" : "var(--text-primary)", fontSize: 16 }}>
                  {r.questionNumber}.
                </span>
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                  {r.type === "fill_blank" ? "빈칸" : r.type === "subjective" ? "서술형" : r.type === "multiple_choice" ? "객관식" : "계산"}
                </span>
              </div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 6 }}>
                <MathText text={r.questionText} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "#ef4444" }}>학생 답: <MathText text={r.userAnswer || "—"} /></span>
                <span style={{ color: "var(--accent)" }}>정답: <MathText text={r.correctAnswer || "—"} /></span>
              </div>
              <button type="button" onClick={() => askDelete(i)} style={btnDangerStyle}>삭제</button>
            </div>
          ))
        )}
      </div>

      {/* Vision result dialog with canvas preview */}
      {dialogMode === "vision" && (
        <>
          <div style={overlayStyle} onClick={closeDialog} />
          <div style={dialogBoxStyle}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>
              {visionProblems.length}개 오답 발견
            </h3>

            {visionImageSrc && (
              <div style={{ marginBottom: 12 }}>
                <ProblemCanvas
                  imageSrc={visionImageSrc}
                  problems={visionProblems}
                  maxWidth={440}
                />
              </div>
            )}

            <div style={{ display: "grid", gap: "0.5rem", maxHeight: "35vh", overflowY: "auto", paddingBottom: 60 }}>
              {visionProblems.map((p, i) => (
                <div key={p.problemId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.6rem", background: "var(--bg-elevated)", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#ef4444" }}>#{p.questionNumber}</span>
                    <button type="button" onClick={() => removeVisionProblem(i)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>제거</button>
                  </div>
                  <div style={{ color: "var(--text-primary)", lineHeight: 1.5 }}><MathText text={p.questionText} /></div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: "#ef4444" }}>학생: <MathText text={p.userAnswer || "—"} /></span>
                    <span style={{ color: "var(--accent)" }}>정답: <MathText text={p.correctAnswer || "—"} /></span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void submitVision()}
              disabled={busy !== null || visionProblems.length === 0}
              style={fabStyle}
              title="저장"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </>
      )}

      {dialogMode === "confirmDelete" && deleteTarget !== null && (
        <>
          <div style={overlayStyle} onClick={() => { setDialogMode(null); setDeleteTarget(null); }} />
          <div style={dialogBoxStyle}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>오답 삭제</h3>
            <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>이 문제를 삭제하시겠습니까?</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setDialogMode(null); setDeleteTarget(null); }} style={btnCancelStyle}>취소</button>
              <button type="button" onClick={() => void confirmDelete()} style={btnDangerAction}>삭제</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const backBtnStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" };
const btn: CSSProperties = { padding: "0.5rem 0.85rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer", fontWeight: 500 };
const btnDangerStyle: CSSProperties = { padding: "0.35rem 0.65rem", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.3)", background: "var(--danger-subtle)", color: "#fca5a5", fontSize: 12, cursor: "pointer" };
const btnDangerAction: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnCancelStyle: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const cardStyle: CSSProperties = { border: "1px solid var(--border)", borderRadius: 14, padding: "0.85rem", background: "var(--bg-card)" };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 };
const dialogBoxStyle: CSSProperties = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "min(92vw, 520px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" };
const overlayFull: CSSProperties = { position: "fixed", inset: 0, zIndex: 300, background: "rgba(10,10,15,0.85)", display: "flex", alignItems: "center", justifyContent: "center" };
const fabStyle: CSSProperties = { position: "sticky", bottom: 0, marginTop: 12, width: "100%", padding: "0.75rem", borderRadius: 12, background: "var(--accent)", border: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
