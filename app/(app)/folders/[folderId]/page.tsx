"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type FolderRow = { _id: string; name: string; parentFolderId?: string | null };
type WrongNote = { _id: string; name: string; description?: string };

type Dialog =
  | { type: "createFolder" }
  | { type: "createNote" }
  | { type: "renameFolder"; id: string; current: string }
  | { type: "renameNote"; id: string; current: string }
  | { type: "deleteFolder"; id: string; name: string }
  | { type: "deleteNote"; id: string; name: string }
  | null;

export default function FolderInsidePage() {
  const params = useParams();
  const folderId = String(params.folderId ?? "");
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [folder, setFolder] = useState<FolderRow | null>(null);
  const [childFolders, setChildFolders] = useState<FolderRow[]>([]);
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogName, setDialogName] = useState("");

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  const refresh = useCallback(
    async (s: SessionUser) => {
      const [fRes, cRes, nRes] = await Promise.all([
        fetch(`/api/folders/${folderId}?phone=${encodeURIComponent(s.phone)}`),
        fetch(`/api/folders?phone=${encodeURIComponent(s.phone)}&parentId=${encodeURIComponent(folderId)}`),
        fetch(`/api/wrong-notes?folderId=${encodeURIComponent(folderId)}`),
      ]);
      const fj = (await fRes.json()) as { ok: boolean; item?: FolderRow };
      const cj = (await cRes.json()) as { ok: boolean; items?: FolderRow[] };
      const nj = (await nRes.json()) as { ok: boolean; items?: WrongNote[] };
      if (fj.ok && fj.item) setFolder(fj.item);
      if (cj.ok && cj.items) setChildFolders(cj.items);
      if (nj.ok && nj.items) setNotes(nj.items);
      setLoaded(true);
    },
    [folderId],
  );

  useEffect(() => {
    if (!session) return;
    void refresh(session);
  }, [session, refresh]);

  const parentHref = folder?.parentFolderId
    ? `/folders/${String(folder.parentFolderId)}`
    : "/folders";

  const openDialog = (d: Dialog) => {
    if (d && ("current" in d)) setDialogName(d.current);
    else setDialogName("");
    setDialog(d);
  };

  const closeDialog = () => { setDialog(null); setDialogName(""); };

  const submitDialog = async () => {
    if (!session || !dialog) return;
    setMsg(null);

    if (dialog.type === "deleteFolder") {
      const res = await fetch(`/api/folders/${dialog.id}?phone=${encodeURIComponent(session.phone)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) { setMsg(json.error ?? "삭제 실패"); return; }
    } else if (dialog.type === "deleteNote") {
      const res = await fetch(`/api/wrong-notes/${dialog.id}?phone=${encodeURIComponent(session.phone)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) { setMsg(json.error ?? "삭제 실패"); return; }
    } else {
      if (!dialogName.trim()) return;
      if (dialog.type === "createFolder") {
        const res = await fetch("/api/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: session.phone, name: dialogName.trim(), createdBy: session.id, parentFolderId: folderId }) });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) { setMsg(json.error ?? "실패"); return; }
      } else if (dialog.type === "createNote") {
        const res = await fetch("/api/wrong-notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folderId, phone: session.phone, name: dialogName.trim(), description: "", createdBy: session.id }) });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) { setMsg(json.error ?? "실패"); return; }
      } else if (dialog.type === "renameFolder") {
        const res = await fetch(`/api/folders/${dialog.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: session.phone, name: dialogName.trim() }) });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) { setMsg(json.error ?? "수정 실패"); return; }
      } else if (dialog.type === "renameNote") {
        const res = await fetch(`/api/wrong-notes/${dialog.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: session.phone, name: dialogName.trim() }) });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) { setMsg(json.error ?? "수정 실패"); return; }
      }
    }
    closeDialog();
    await refresh(session);
  };

  const isDeleteDialog = dialog?.type === "deleteFolder" || dialog?.type === "deleteNote";

  const dialogTitle = (() => {
    if (!dialog) return "";
    switch (dialog.type) {
      case "createFolder": return "새 폴더";
      case "createNote": return "새 오답노트";
      case "renameFolder": return "폴더 이름 수정";
      case "renameNote": return "오답노트 이름 수정";
      case "deleteFolder": return "폴더 삭제";
      case "deleteNote": return "오답노트 삭제";
    }
  })();

  const dialogPlaceholder = dialog?.type === "createNote" || dialog?.type === "renameNote" ? "오답노트 이름" : "폴더 이름";
  const dialogSubmitLabel = dialog?.type === "createFolder" || dialog?.type === "createNote" ? "생성" : "저장";

  if (!session) return null;

  const items: Array<{ kind: "folder" | "note"; id: string; name: string }> = [
    ...childFolders.map((f) => ({ kind: "folder" as const, id: f._id, name: f.name })),
    ...notes.map((n) => ({ kind: "note" as const, id: n._id, name: n.name })),
  ];

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href={parentHref} style={backBtn} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>
          {folder?.name ?? "폴더"}
        </h1>
        <button type="button" onClick={() => openDialog({ type: "createFolder" })} style={btnSmall} title="폴더 생성">
          <FolderPlusIcon />
        </button>
        <button type="button" onClick={() => openDialog({ type: "createNote" })} style={btnSmall} title="오답노트 생성">
          <FilePlusIcon />
        </button>
      </div>

      {msg ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {!loaded ? (
          <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>로딩중입니다…</li>
        ) : items.length === 0 ? (
          <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>
            비어 있습니다. 폴더나 오답노트를 만들어 보세요.
          </li>
        ) : (
          items.map((it) => (
            <li key={it.id} style={{ display: "flex", alignItems: "center" }}>
              <Link
                href={it.kind === "folder" ? `/folders/${it.id}` : `/note/${it.id}`}
                style={explorerRow}
              >
                {it.kind === "folder" ? <FolderIcon /> : <FileIcon />}
                <span style={{ flex: 1 }}>{it.name}</span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  openDialog(
                    it.kind === "folder"
                      ? { type: "renameFolder", id: it.id, current: it.name }
                      : { type: "renameNote", id: it.id, current: it.name },
                  )
                }
                style={btnAction}
                title="이름 수정"
              >
                <PenIcon />
              </button>
              <button
                type="button"
                onClick={() =>
                  openDialog(
                    it.kind === "folder"
                      ? { type: "deleteFolder", id: it.id, name: it.name }
                      : { type: "deleteNote", id: it.id, name: it.name },
                  )
                }
                style={btnAction}
                title="삭제"
              >
                <TrashIcon />
              </button>
            </li>
          ))
        )}
      </ul>

      {dialog && (
        <>
          <div style={overlayStyle} onClick={closeDialog} />
          <div style={dialogBoxStyle}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>
              {dialogTitle}
            </h3>
            {isDeleteDialog ? (
              <>
                <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <strong>&ldquo;{(dialog as { name: string }).name}&rdquo;</strong>
                  {dialog.type === "deleteFolder"
                    ? "을(를) 삭제하시겠습니까? 하위 폴더와 오답노트도 함께 삭제됩니다."
                    : "을(를) 삭제하시겠습니까? 휴지통으로 이동됩니다."}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={closeDialog} style={btnCancel}>취소</button>
                  <button type="button" onClick={() => void submitDialog()} style={btnDanger}>삭제</button>
                </div>
              </>
            ) : (
              <>
                <input
                  value={dialogName}
                  onChange={(e) => setDialogName(e.target.value)}
                  placeholder={dialogPlaceholder}
                  autoFocus
                  style={{ width: "100%", marginBottom: "1rem" }}
                  onKeyDown={(e) => e.key === "Enter" && void submitDialog()}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={closeDialog} style={btnCancel}>취소</button>
                  <button type="button" onClick={() => void submitDialog()} disabled={!dialogName.trim()} style={btnAccent}>
                    {dialogSubmitLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FilePlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12v4M10 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M15.232 5.232l3.536 3.536M9 13l-2 2v3h3l9-9-3.536-3.536L9 13Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const backBtn: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none" };
const btnSmall: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 };
const explorerRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "0.6rem 0.75rem", borderRadius: 8, textDecoration: "none", color: "var(--text-primary)", fontSize: 14, fontWeight: 500, transition: "background 0.1s", background: "transparent" };
const btnAction: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: "0.6rem 0.4rem", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" };
const btnAccent: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnDanger: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const btnCancel: CSSProperties = { padding: "0.55rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 13 };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 };
const dialogBoxStyle: CSSProperties = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "min(90vw, 400px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" };
