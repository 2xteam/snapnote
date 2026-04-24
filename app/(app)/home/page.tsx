"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { useDragScroll } from "@/lib/useDragScroll";

type FolderRow = { _id: string; name: string };
type NoteRow = { _id: string; name: string };

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const noteDragRef = useDragScroll();
  const folderDragRef = useDragScroll();

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [fRes, nRes] = await Promise.all([
        fetch(`/api/folders?phone=${encodeURIComponent(session.phone)}&parentId=`),
        fetch(`/api/wrong-notes?phone=${encodeURIComponent(session.phone)}`),
      ]);
      const fj = (await fRes.json()) as { ok: boolean; items?: FolderRow[] };
      const nj = (await nRes.json()) as { ok: boolean; items?: NoteRow[] };
      if (fj.ok && fj.items) setFolders(fj.items.slice(0, 10));
      if (nj.ok && nj.items) setNotes(nj.items.slice(0, 10));
      setLoaded(true);
    })();
  }, [session]);

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1.5rem", minWidth: 0 }}>
      <h1 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>Home</h1>

      {!loaded ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
      ) : (
        <>
          {/* 최근 오답노트 */}
          <section style={{ minWidth: 0, overflow: "hidden" }}>
            <h2 style={{ margin: "0 0 0.6rem", fontSize: "1rem", color: "var(--text-primary)" }}>최근 오답노트</h2>
            {notes.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>오답노트가 없습니다.</p>
            ) : (
              <div ref={noteDragRef} className="home-scroll-row" style={scrollRow}>
                {notes.map((n) => (
                  <Link key={n._id} href={`/note/${n._id}`} style={thumbCard}>
                    <FileIcon />
                    <span style={thumbLabel}>{n.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 최근 폴더 */}
          <section style={{ minWidth: 0, overflow: "hidden" }}>
            <h2 style={{ margin: "0 0 0.6rem", fontSize: "1rem", color: "var(--text-primary)" }}>최근 폴더</h2>
            {folders.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>폴더가 없습니다.</p>
            ) : (
              <div ref={folderDragRef} className="home-scroll-row" style={scrollRow}>
                {folders.map((f) => (
                  <Link key={f._id} href={`/folders/${f._id}`} style={thumbCard}>
                    <FolderIcon />
                    <span style={thumbLabel}>{f.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

const scrollRow: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 10,
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 4,
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch",
  maxWidth: "100%",
};

const thumbCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: 100,
  minWidth: 100,
  height: 100,
  flexShrink: 0,
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  textDecoration: "none",
  scrollSnapAlign: "start",
  padding: "0.5rem",
  transition: "background 0.15s",
};

const thumbLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-primary)",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
  padding: "0 2px",
};
