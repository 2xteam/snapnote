"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { PRESET_THEMES, type ThemeCustomColor, type ThemeId } from "@/lib/theme";
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

  const { themeId, custom, setTheme } = useTheme();
  const [customAccent, setCustomAccent] = useState(custom.accent);
  const [customBg, setCustomBg] = useState(custom.bg);

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

  useEffect(() => {
    setCustomAccent(custom.accent);
    setCustomBg(custom.bg);
  }, [custom]);

  const applyCustom = () => {
    const c: ThemeCustomColor = { accent: customAccent, bg: customBg };
    setTheme("custom", c);
  };

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
                <button type="button" onClick={saveEmail} disabled={emailBusy} style={{ padding: "0.5rem 0.9rem", borderRadius: "var(--radius-sm)", border: "none", background: emailBusy ? "var(--text-muted)" : "var(--accent)", color: "#000", fontWeight: 600, fontSize: 13, cursor: emailBusy ? "default" : "pointer", flexShrink: 0 }}>{emailBusy ? "…" : "저장"}</button>
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
      <div style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          🪙
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{tokens}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>보유 토큰</div>
        </div>
      </div>

      {/* Theme selector */}
      <div style={{ borderRadius: "var(--radius-lg)", background: "var(--bg-card)", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1rem 0.6rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>테마</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>앱 전체 색상 분위기를 변경합니다.</div>
        </div>

        <div style={{ padding: "0.85rem 1rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
          {PRESET_THEMES.map((t) => {
            const isActive = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === "custom") {
                    setTheme("custom", { accent: customAccent, bg: customBg });
                  } else {
                    setTheme(t.id as ThemeId);
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "0.65rem 0.4rem",
                  borderRadius: "var(--radius-md)",
                  border: isActive ? "2px solid var(--accent)" : "1px solid transparent",
                  background: isActive ? "var(--accent-subtle)" : "var(--bg-elevated)",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--radius-sm)",
                  background: t.id === "custom"
                    ? `linear-gradient(135deg, ${customBg} 50%, ${customAccent} 50%)`
                    : t.preview.bg,
                  border: `3px solid ${t.preview.accent}`,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {t.id !== "custom" && (
                    <div style={{
                      position: "absolute", bottom: 4, left: "50%",
                      transform: "translateX(-50%)",
                      width: 16, height: 3,
                      borderRadius: 2,
                      background: t.preview.accent,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          margin: "0 1rem 0.85rem",
          padding: "0.85rem",
          borderRadius: "var(--radius-md)",
          background: "var(--bg-elevated)",
          border: `1px solid ${themeId === "custom" ? "var(--accent)" : "transparent"}`,
          opacity: themeId === "custom" ? 1 : 0.45,
          pointerEvents: themeId === "custom" ? "auto" : "none",
          transition: "opacity 0.2s, border-color 0.2s",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.65rem" }}>
            커스텀 색상 설정
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <ColorPicker label="배경색" value={customBg} onChange={setCustomBg} />
            <ColorPicker label="강조색" value={customAccent} onChange={setCustomAccent} />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            style={{
              marginTop: "0.65rem",
              width: "100%",
              padding: "0.55rem",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: customAccent,
              color: "#000",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "filter 0.15s",
            }}
          >
            커스텀 테마 적용
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 34,
            height: 34,
            padding: 2,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--input-bg)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          style={{ fontSize: 12, width: "100%", fontFamily: "monospace" }}
          placeholder="#rrggbb"
        />
      </div>
    </label>
  );
}
