"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type FolderRow = { _id: string; name: string; parentFolderId?: string | null };
type Dialog = { type: "create" } | { type: "rename"; id: string; current: string } | { type: "confirmDelete"; id: string; name: string } | null;

type TrashFolder = { _id: string; name: string; deletedAt: string };
type TrashNote = { _id: string; name: string; deletedAt: string };

type ConfirmDialog = {
  action: "restore" | "permanentDelete";
  type: "folder" | "note";
  id: string;
  name: string;
} | null;

type ViewTab = "folders" | "trash";

export default function HomeFoldersPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("folders");

  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogName, setDialogName] = useState("");

  const [trashFolders, setTrashFolders] = useState<TrashFolder[]>([]);
  const [trashNotes, setTrashNotes] = useState<TrashNote[]>([]);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const [trashMsg, setTrashMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialog>(null);

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

  const refreshTrash = useCallback(async (s: SessionUser) => {
    const res = await fetch(`/api/trash?phone=${encodeURIComponent(s.phone)}`);
    const json = (await res.json()) as { ok: boolean; folders?: TrashFolder[]; notes?: TrashNote[] };
    if (json.ok) {
      setTrashFolders(json.folders ?? []);
      setTrashNotes(json.notes ?? []);
    }
    setTrashLoaded(true);
  }, []);

  useEffect(() => { if (session) void refresh(session); }, [session, refresh]);

  useEffect(() => {
    if (!session || viewTab !== "trash") return;
    void refreshTrash(session);
  }, [session, viewTab, refreshTrash]);

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

  const handleTrashAction = async () => {
    if (!session || !confirm) return;
    setTrashMsg(null);
    const res = await fetch("/api/trash", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: session.phone,
        action: confirm.action,
        type: confirm.type,
        id: confirm.id,
      }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setTrashMsg(json.error ?? "작업에 실패했습니다.");
      setConfirm(null);
      return;
    }
    setConfirm(null);
    await refreshTrash(session);
  };

  if (!session) return null;

  const trashItems = [
    ...trashFolders.map((f) => ({ kind: "folder" as const, ...f })),
    ...trashNotes.map((n) => ({ kind: "note" as const, ...n })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)", flex: 1 }}>Folders</h1>
        {viewTab === "folders" && (
          <button type="button" onClick={openCreate} style={btnSmall} title="새 폴더">
            <FolderPlusIcon />
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setViewTab("folders")} style={tabBtnStyle(viewTab === "folders")}>
          Folders
        </button>
        <button type="button" onClick={() => setViewTab("trash")} style={tabBtnStyle(viewTab === "trash")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {viewTab === "folders" && (
        <>
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
        </>
      )}

      {viewTab === "trash" && (
        <>
          {trashMsg ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{trashMsg}</p> : null}

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
            {!trashLoaded ? (
              <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>로딩중입니다…</li>
            ) : trashItems.length === 0 ? (
              <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>
                휴지통이 비어 있습니다.
              </li>
            ) : (
              trashItems.map((it) => (
                <li key={it._id} style={trashRowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {it.kind === "folder" ? <FolderIcon /> : <NoteIcon />}
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{it.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 26 }}>
                      {it.kind === "folder" ? "폴더" : "노트"} · 삭제: {fmtDate(it.deletedAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirm({ action: "restore", type: it.kind === "folder" ? "folder" : "note", id: it._id, name: it.name })}
                    style={btnRestore}
                    title="복원"
                  >
                    <RestoreIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ action: "permanentDelete", type: it.kind === "folder" ? "folder" : "note", id: it._id, name: it.name })}
                    style={btnPermDelete}
                    title="영구 삭제"
                  >
                    <TrashXIcon />
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}

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

      {confirm && (
        <>
          <div style={overlay} onClick={() => setConfirm(null)} />
          <div style={dialogBox}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>
              {confirm.action === "restore" ? "복원" : "영구 삭제"}
            </h3>
            <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <strong>&ldquo;{confirm.name}&rdquo;</strong>
              {confirm.action === "restore"
                ? "을(를) 복원하시겠습니까?"
                : "을(를) 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirm(null)} style={btnCancel}>취소</button>
              <button
                type="button"
                onClick={() => void handleTrashAction()}
                style={confirm.action === "restore" ? btnPrimary : btnDanger}
              >
                {confirm.action === "restore" ? "복원" : "영구 삭제"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FolderIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinejoin="round" /></svg>; }
function FolderPlusIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function PenIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M15.232 5.232l3.536 3.536M9 13l-2 2v3h3l9-9-3.536-3.536L9 13Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function TrashIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function NoteIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 2v6h6" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" /></svg>; }
function RestoreIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="currentColor" strokeWidth="1.6" /><path d="M3 3v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function TrashXIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11l4 4M14 11l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>; }

function tabBtnStyle(active: boolean): CSSProperties {
  return {
    padding: "0.55rem 1.1rem",
    borderRadius: "var(--radius-full)",
    border: "none",
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#000" : "var(--text-secondary)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  };
}

const btnSmall: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 };
const explorerRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "0.6rem 0.75rem", borderRadius: "var(--radius-sm)", textDecoration: "none", color: "var(--text-primary)", fontSize: 14, fontWeight: 500, transition: "background 0.1s", background: "transparent" };
const btnAction: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.6rem 0.4rem", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" };
const trashRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 4, padding: "0.5rem 0.5rem", borderRadius: "var(--radius-sm)" };
const btnRestore: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem", border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" };
const btnPermDelete: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem", border: "none", background: "transparent", color: "#dc2626", cursor: "pointer" };
const btnPrimary: CSSProperties = { padding: "0.55rem 1rem", borderRadius: "var(--radius-sm)", border: "none", background: "var(--accent)", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnDanger: CSSProperties = { padding: "0.55rem 1rem", borderRadius: "var(--radius-sm)", border: "none", background: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnCancel: CSSProperties = { padding: "0.55rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 };
const dialogBox: CSSProperties = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "min(90vw, 400px)", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" };
