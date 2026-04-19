"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type FolderRow = { _id: string; name: string; parentFolderId?: string | null };
type Dialog = { type: "create" } | { type: "rename"; id: string; current: string } | { type: "confirmDelete"; id: string; name: string } | null;

export default function HomeFoldersPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogName, setDialogName] = useState("");

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  const refresh = useCallback(async (s: SessionUser) => {
    const res = await fetch(`/api/folders?phone=${encodeURIComponent(s.phone)}&parentId=`);
    const json = (await res.json()) as { ok: boolean; items?: FolderRow[] };
    if (json.ok && json.items) setFolders(json.items);
    setLoaded(true);
  }, []);

  useEffect(() => { if (session) void refresh(session); }, [session, refresh]);

  const openCreate = () => { setDialogName(""); setDialog({ type: "create" }); };
  const closeDialog = () => { setDialog(null); setDialogName(""); };

  const submitDialog = async () => {
    if (!session) return;
    setMsg(null);
    if (dialog?.type === "create") {
      if (!dialogName.trim()) return;
      const res = await fetch("/api/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: session.phone, name: dialogName.trim(), createdBy: session.id, parentFolderId: null }) });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) { setMsg(json.error ?? "폴더 생성 실패"); return; }
    } else if (dialog?.type === "rename") {
      if (!dialogName.trim()) return;
      const res = await fetch(`/api/folders/${dialog.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: session.phone, name: dialogName.trim() }) });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) { setMsg(json.error ?? "이름 수정 실패"); return; }
    } else if (dialog?.type === "confirmDelete") {
      const res = await fetch(`/api/folders/${dialog.id}?phone=${encodeURIComponent(session.phone)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) { setMsg(json.error ?? "삭제 실패"); return; }
    }
    closeDialog();
    await refresh(session);
  };

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>Folders</h1>
        <button type="button" onClick={openCreate} style={btnSmall} title="새 폴더">
          <FolderPlusIcon />
        </button>
      </div>

      {msg ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {!loaded ? (
          <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>로딩중입니다…</li>
        ) : folders.length === 0 ? (
          <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>폴더가 없습니다. 새 폴더를 만들어 보세요.</li>
        ) : (
          folders.map((f) => (
            <li key={f._id} style={{ display: "flex", alignItems: "center" }}>
              <Link href={`/folders/${f._id}`} style={explorerRow}>
                <FolderIcon />
                <span style={{ flex: 1 }}>{f.name}</span>
              </Link>
              <button type="button" onClick={() => { setDialogName(f.name); setDialog({ type: "rename", id: f._id, current: f.name }); }} style={btnAction} title="이름 수정"><PenIcon /></button>
              <button type="button" onClick={() => { setDialogName(""); setDialog({ type: "confirmDelete", id: f._id, name: f.name }); }} style={btnAction} title="삭제"><TrashIcon /></button>
            </li>
          ))
        )}
      </ul>

      {dialog && (
        <>
          <div style={overlay} onClick={closeDialog} />
          <div style={dialogBox}>
            {dialog.type === "confirmDelete" ? (
              <>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>폴더 삭제</h3>
                <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <strong>&ldquo;{dialog.name}&rdquo;</strong> 폴더를 삭제하시겠습니까?<br />하위 폴더와 오답노트도 함께 삭제됩니다.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={closeDialog} style={btnCancel}>취소</button>
                  <button type="button" onClick={() => void submitDialog()} style={btnDanger}>삭제</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>
                  {dialog.type === "create" ? "새 폴더 만들기" : "폴더 이름 수정"}
                </h3>
                <input value={dialogName} onChange={(e) => setDialogName(e.target.value)} placeholder="폴더 이름" autoFocus style={{ width: "100%", marginBottom: "1rem" }} onKeyDown={(e) => e.key === "Enter" && void submitDialog()} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={closeDialog} style={btnCancel}>취소</button>
                  <button type="button" onClick={() => void submitDialog()} disabled={!dialogName.trim()} style={btnPrimary}>{dialog.type === "create" ? "생성" : "저장"}</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FolderIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinejoin="round" /></svg>; }
function FolderPlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function PenIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15.232 5.232l3.536 3.536M9 13l-2 2v3h3l9-9-3.536-3.536L9 13Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function TrashIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

const btnSmall: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 };
const explorerRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "0.6rem 0.75rem", borderRadius: 8, textDecoration: "none", color: "var(--text-primary)", fontSize: 14, fontWeight: 500, transition: "background 0.1s", background: "transparent" };
const btnAction: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.6rem 0.4rem", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" };
const btnPrimary: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnDanger: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnCancel: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 };
const dialogBox: CSSProperties = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "min(90vw, 400px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" };
