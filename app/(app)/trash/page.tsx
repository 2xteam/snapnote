"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type TrashFolder = { _id: string; name: string; deletedAt: string };
type TrashNote = { _id: string; name: string; deletedAt: string };

type ConfirmDialog = {
  action: "restore" | "permanentDelete";
  type: "folder" | "note";
  id: string;
  name: string;
} | null;

export default function TrashPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [folders, setFolders] = useState<TrashFolder[]>([]);
  const [notes, setNotes] = useState<TrashNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmDialog>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  const refresh = useCallback(async (s: SessionUser) => {
    const res = await fetch(`/api/trash?phone=${encodeURIComponent(s.phone)}`);
    const json = (await res.json()) as { ok: boolean; folders?: TrashFolder[]; notes?: TrashNote[] };
    if (json.ok) {
      setFolders(json.folders ?? []);
      setNotes(json.notes ?? []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    void refresh(session);
  }, [session, refresh]);

  const handleAction = async () => {
    if (!session || !confirm) return;
    setMsg(null);
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
      setMsg(json.error ?? "작업에 실패했습니다.");
      setConfirm(null);
      return;
    }
    setConfirm(null);
    await refresh(session);
  };

  if (!session) return null;

  const items = [
    ...folders.map((f) => ({ kind: "folder" as const, ...f })),
    ...notes.map((n) => ({ kind: "note" as const, ...n })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>Trash</h1>

      {msg ? <p style={{ color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
        {!loaded ? (
          <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>로딩중입니다…</li>
        ) : items.length === 0 ? (
          <li style={{ color: "var(--text-muted)", fontSize: 14, padding: "1rem 0" }}>
            휴지통이 비어 있습니다.
          </li>
        ) : (
          items.map((it) => (
            <li key={it._id} style={rowStyle}>
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

      {confirm && (
        <>
          <div style={overlayStyle} onClick={() => setConfirm(null)} />
          <div style={dialogBoxStyle}>
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
                onClick={() => void handleAction()}
                style={confirm.action === "restore" ? btnAccent : btnDanger}
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

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 3v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashXIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11l4 4M14 11l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "0.5rem 0.5rem",
  borderRadius: 8,
};

const btnRestore: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem",
  border: "none",
  background: "transparent",
  color: "var(--accent)",
  cursor: "pointer",
};

const btnPermDelete: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.5rem",
  border: "none",
  background: "transparent",
  color: "#dc2626",
  cursor: "pointer",
};

const btnAccent: CSSProperties = {
  padding: "0.55rem 1rem",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const btnDanger: CSSProperties = {
  padding: "0.55rem 1rem",
  borderRadius: 10,
  border: "none",
  background: "#dc2626",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};

const btnCancel: CSSProperties = {
  padding: "0.55rem 1rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontWeight: 500,
  cursor: "pointer",
  fontSize: 13,
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 200,
};

const dialogBoxStyle: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 201,
  width: "min(90vw, 400px)",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "1.5rem",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};
