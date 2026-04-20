"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { ImageCropper, type CropResult } from "@/components/ImageCropper";
import { MonoAdjust, type MonoResult } from "@/components/MonoAdjust";

type NoteInfo = { _id: string; name: string; folderId?: string };
type ItemRow = { _id: string; imageUrl: string };
type DialogMode = "crop" | "mono" | "confirmDelete" | null;

export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [cropSrc, setCropSrc] = useState("");
  const [monoSrc, setMonoSrc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    if (ij.ok && ij.items) setItems(ij.items);
    setLoaded(true);
  }, [noteId]);

  useEffect(() => { if (session) void load(session); }, [session, load]);

  /* ── Add flow: file → crop → mono adjust → upload → save ── */

  const onFileSelected = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setDialogMode("crop");
  };

  const onCropCancel = () => {
    setDialogMode(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc("");
  };

  const onCropDone = (result: CropResult) => {
    setDialogMode(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc("");
    setMonoSrc(result.dataUrl);
    setDialogMode("mono");
  };

  const onMonoCancel = () => {
    setDialogMode(null);
    setMonoSrc("");
  };

  const onMonoConfirm = (result: MonoResult) => {
    setDialogMode(null);
    setMonoSrc("");
    void uploadAndSave(result.file);
  };

  const uploadAndSave = async (file: File) => {
    if (!session) return;
    setBusy("saving");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("phone", session.phone);
      fd.set("noteId", noteId);
      const uploadRes = await fetch("/api/upload-image", { method: "POST", body: fd });
      const uploadJson = (await uploadRes.json()) as { ok: boolean; url?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.ok || !uploadJson.url) {
        setMsg(uploadJson.error ?? "이미지 업로드 실패");
        return;
      }

      const saveRes = await fetch("/api/wrong-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId, phone: session.phone, imageUrl: uploadJson.url }),
      });
      const saveJson = (await saveRes.json()) as { ok: boolean; error?: string };
      if (!saveRes.ok || !saveJson.ok) { setMsg(saveJson.error ?? "저장 실패"); return; }
      await load(session);
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  /* ── Delete flow ── */

  const askDelete = (id: string) => {
    setDeleteTarget(id);
    setDialogMode("confirmDelete");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !session) return;
    const res = await fetch(`/api/wrong-items/${deleteTarget}?phone=${encodeURIComponent(session.phone)}`, { method: "DELETE" });
    const json = (await res.json()) as { ok: boolean };
    if (!res.ok || !json.ok) { setMsg("삭제 실패"); }
    else { setItems((prev) => prev.filter((it) => it._id !== deleteTarget)); }
    setDialogMode(null);
    setDeleteTarget(null);
  };

  const backHref = note?.folderId ? `/folders/${note.folderId}` : "/folders";

  if (!session) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Saving overlay */}
      {busy === "saving" && (
        <div style={overlayFull}>
          <div style={{ textAlign: "center" }}>
            <div style={spinnerStyle} />
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>저장 중…</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
        <Link href={backHref} style={headerBtn} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>{note?.name ?? "오답노트"}</h1>

        <label style={{ ...headerBtn, cursor: "pointer" }} title="사진 추가">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="file" accept="image/*" hidden onChange={(e) => { onFileSelected(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>

        {items.length > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{items.length}개</span>
        )}
      </div>

      {msg && <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 0.5rem" }}>{msg}</p>}

      {!loaded ? (
        <p style={{ color: "var(--text-muted)" }}>로딩 중…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>아직 추가된 문제가 없습니다.</p>
          <label style={{ ...actionBtn, cursor: "pointer" }}>
            📷 사진으로 문제 추가
            <input type="file" accept="image/*" hidden onChange={(e) => { onFileSelected(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it, i) => (
            <div key={it._id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => askDelete(it._id)}
                  style={cardDeleteBtn}
                  title="삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl}
                  alt={`문제 ${i + 1}`}
                  draggable={false}
                  style={{ maxWidth: "100%", height: "auto", objectFit: "contain", userSelect: "none", WebkitUserSelect: "none" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}

      {dialogMode === "crop" && cropSrc && (
        <ImageCropper imageSrc={cropSrc} onCrop={onCropDone} onCancel={onCropCancel} />
      )}

      {dialogMode === "mono" && monoSrc && (
        <MonoAdjust imageSrc={monoSrc} onConfirm={onMonoConfirm} onCancel={onMonoCancel} />
      )}

      {dialogMode === "confirmDelete" && deleteTarget !== null && (
        <>
          <div style={overlayDim} onClick={() => { setDialogMode(null); setDeleteTarget(null); }} />
          <div style={dialogBoxStyle}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>삭제</h3>
            <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>이 문제 이미지를 삭제하시겠습니까?</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setDialogMode(null); setDeleteTarget(null); }} style={btnCancel}>취소</button>
              <button type="button" onClick={() => void confirmDelete()} style={btnDanger}>삭제</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const headerBtn: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none", cursor: "pointer" };
const actionBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.6rem 1.2rem", borderRadius: 10, background: "var(--accent)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 };
const cardStyle: CSSProperties = { borderRadius: 14, padding: "0.75rem", background: "var(--bg-card)", border: "1px solid var(--border)", overflow: "hidden" };
const cardDeleteBtn: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", cursor: "pointer", padding: 0 };
const btnCancel: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const btnDanger: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const overlayFull: CSSProperties = { position: "fixed", inset: 0, zIndex: 300, background: "rgba(10,10,15,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const overlayDim: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 };
const dialogBoxStyle: CSSProperties = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "min(92vw, 420px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" };
const spinnerStyle: CSSProperties = { width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" };
