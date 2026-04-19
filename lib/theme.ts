export type ThemeId = "dark" | "light" | "violet" | "custom";

export type ThemeCustomColor = {
  accent: string;
  bg: string;
};

export type ThemeConfig = {
  id: ThemeId;
  label: string;
  preview: { bg: string; accent: string; text: string };
  dataAttr: string;
  custom?: ThemeCustomColor;
};

export const PRESET_THEMES: ThemeConfig[] = [
  {
    id: "dark",
    label: "다크",
    dataAttr: "dark",
    preview: { bg: "#0a0a0f", accent: "#3b82f6", text: "#e8e8ed" },
  },
  {
    id: "light",
    label: "화이트",
    dataAttr: "light",
    preview: { bg: "#f5f5f7", accent: "#2563eb", text: "#111118" },
  },
  {
    id: "violet",
    label: "바이올렛",
    dataAttr: "violet",
    preview: { bg: "#0d0b1a", accent: "#8b5cf6", text: "#ede9fe" },
  },
  {
    id: "custom",
    label: "커스텀",
    dataAttr: "custom",
    preview: { bg: "#0a0a0f", accent: "#3b82f6", text: "#e8e8ed" },
  },
];

const STORAGE_KEY = "snapnote_theme";

type StoredTheme = { id: ThemeId; custom?: ThemeCustomColor };

export function loadTheme(): StoredTheme {
  if (typeof window === "undefined") return { id: "dark" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: "dark" };
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    const validIds: ThemeId[] = ["dark", "light", "violet", "custom"];
    if (!validIds.includes(parsed.id as ThemeId)) return { id: "dark" };
    return { id: parsed.id as ThemeId, custom: parsed.custom };
  } catch {
    return { id: "dark" };
  }
}

export function saveTheme(id: ThemeId, custom?: ThemeCustomColor) {
  if (typeof window === "undefined") return;
  const payload: StoredTheme = { id, ...(custom ? { custom } : {}) };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function luminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function buildCustomVars(custom: ThemeCustomColor): Record<string, string> {
  const bgRgb = hexToRgb(custom.bg) ?? [10, 10, 15];
  const accentRgb = hexToRgb(custom.accent) ?? [59, 130, 246];
  const lum = luminance(...bgRgb);
  const isDark = lum < 0.4;

  const [ar, ag, ab] = accentRgb;
  const [br, bg_, bb] = bgRgb;

  const mix = (base: [number, number, number], ratio: number) =>
    `#${base.map((c, i) => {
      const target = [br, bg_, bb][i];
      return Math.round(c + (target - c) * ratio).toString(16).padStart(2, "0");
    }).join("")}`;

  return {
    "--bg-primary": custom.bg,
    "--bg-secondary": mix(bgRgb, 0.18),
    "--bg-card": mix(bgRgb, 0.3),
    "--bg-elevated": mix(bgRgb, 0.45),
    "--border": isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.1)",
    "--border-subtle": isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    "--text-primary": isDark ? "#e8e8ed" : "#111118",
    "--text-secondary": isDark ? "#8b8b9e" : "#4a4a5a",
    "--text-muted": isDark ? "#5c5c6f" : "#9090a0",
    "--accent": custom.accent,
    "--accent-hover": `rgb(${Math.max(ar - 20, 0)},${Math.max(ag - 20, 0)},${Math.max(ab - 20, 0)})`,
    "--accent-subtle": `rgba(${ar},${ag},${ab},0.14)`,
    "--danger": "#ef4444",
    "--danger-subtle": "rgba(239,68,68,0.12)",
    "--success": "#22c55e",
    "--success-subtle": "rgba(34,197,94,0.12)",
    "--warning": "#f59e0b",
    "--input-bg": mix(bgRgb, 0.35),
    "--input-border": isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.14)",
  };
}
