"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { PRESET_THEMES, type ThemeCustomColor, type ThemeId } from "@/lib/theme";
import { loadSession, type SessionUser } from "@/lib/session";

export default function MyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);

  const { themeId, custom, setTheme } = useTheme();
  const [customAccent, setCustomAccent] = useState(custom.accent);
  const [customBg, setCustomBg] = useState(custom.bg);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-card)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {session.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{session.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.phone}</div>
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
