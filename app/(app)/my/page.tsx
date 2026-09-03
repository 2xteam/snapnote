"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { loadSession, type SessionUser } from "@/lib/session";

export default function MyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);

  const [email, setEmail] = useState<string>("");
  const [emailInput, setEmailInput] = useState("");
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);


  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch(`/api/stats/me?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}`);
        const json = (await res.json()) as { ok: boolean; email?: string; tokens?: number };
        if (json.ok) {
          setEmail(json.email ?? "");
          setTokens(json.tokens ?? 0);
        }
      } catch { /* ignore */ }
    })();
  }, [session]);

  const saveEmail = useCallback(async () => {
    if (!session) return;
    setEmailBusy(true);
    setEmailMsg(null);
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailMsg("올바른 이메일 주소를 입력해 주세요.");
      setEmailBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/update-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: session.phone, userId: session.id, email: trimmed }),
      });
      const json = (await res.json()) as { ok: boolean; email?: string; error?: string };
      if (!res.ok || !json.ok) { setEmailMsg(json.error ?? "이메일 등록에 실패했습니다."); return; }
      setEmail(json.email ?? trimmed);
      setEmailEditing(false);
      setEmailInput("");
    } catch { setEmailMsg("네트워크 오류입니다."); } finally { setEmailBusy(false); }
  }, [session, emailInput]);

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>My</h1>

      {/* Profile */}
      <div style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {session.name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{session.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.phone}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          {emailEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>이메일 등록</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="example@email.com" autoFocus style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14 }} />
                <button type="button" onClick={saveEmail} disabled={emailBusy} style={{ padding: "0.5rem 0.9rem", borderRadius: "var(--radius-sm)", border: "none", background: emailBusy ? "var(--text-muted)" : "var(--accent)", color: "var(--on-accent)", fontWeight: 600, fontSize: 13, cursor: emailBusy ? "default" : "pointer", flexShrink: 0 }}>{emailBusy ? "…" : "저장"}</button>
                <button type="button" onClick={() => { setEmailEditing(false); setEmailMsg(null); }} style={{ padding: "0.5rem 0.7rem", borderRadius: "var(--radius-sm)", border: "none", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>취소</button>
              </div>
              {emailMsg && <p style={{ margin: 0, color: "var(--danger)", fontSize: 12 }}>{emailMsg}</p>}
            </div>
          ) : email ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
              <button type="button" onClick={() => { setEmailInput(email); setEmailEditing(true); setEmailMsg(null); }} style={{ padding: "3px 10px", borderRadius: "var(--radius-full)", border: "none", background: "var(--bg-elevated)", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>변경</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setEmailEditing(true); setEmailMsg(null); }} style={{ width: "100%", padding: "0.55rem", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              이메일 등록하기
            </button>
          )}
        </div>
      </div>

      {/* Token balance */}
      {IS_TOKEN_SYSTEM_ENABLED && (
        <div style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            🪙
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{tokens}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>보유 토큰</div>
          </div>
        </div>
      )}

    </div>
  );
}

