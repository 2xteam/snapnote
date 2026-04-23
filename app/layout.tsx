import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapNote",
  description: "SnapNote — 오답노트 학습 도우미",
  icons: {
    icon: "/favicon.png",
    apple: "/icon.png",
  },
};

const themeInitScript = `
(function(){
  try {
    var STORAGE_KEY = 'snapnote_theme';
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var stored = JSON.parse(raw);
    var validIds = ['dark','light','violet','custom'];
    if (!stored || !validIds.includes(stored.id)) return;

    document.documentElement.setAttribute('data-theme', stored.id);

    if (stored.id === 'custom' && stored.custom) {
      var bg = stored.custom.bg || '#0a0a0f';
      var accent = stored.custom.accent || '#3b82f6';

      function hexToRgb(hex) {
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
        if (!m) return null;
        return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
      }
      function luminance(r,g,b) {
        function lin(c){ var s=c/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4); }
        return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
      }

      var bgRgb   = hexToRgb(bg)     || [10,10,15];
      var accRgb  = hexToRgb(accent) || [59,130,246];
      var isDark  = luminance(bgRgb[0],bgRgb[1],bgRgb[2]) < 0.4;

      function mix(base, ratio) {
        return '#'+base.map(function(c,i){
          return Math.round(c+(bgRgb[i]-c)*ratio).toString(16).padStart(2,'0');
        }).join('');
      }

      var ar=accRgb[0], ag=accRgb[1], ab=accRgb[2];
      var vars = {
        '--bg-primary':    bg,
        '--bg-secondary':  mix(bgRgb,0.18),
        '--bg-card':       mix(bgRgb,0.3),
        '--bg-elevated':   mix(bgRgb,0.45),
        '--border':        isDark?'rgba(255,255,255,0.09)':'rgba(0,0,0,0.1)',
        '--border-subtle': isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)',
        '--text-primary':  isDark?'#e8e8ed':'#111118',
        '--text-secondary':isDark?'#8b8b9e':'#4a4a5a',
        '--text-muted':    isDark?'#5c5c6f':'#9090a0',
        '--accent':        accent,
        '--accent-hover':  'rgb('+Math.max(ar-20,0)+','+Math.max(ag-20,0)+','+Math.max(ab-20,0)+')',
        '--accent-subtle': 'rgba('+ar+','+ag+','+ab+',0.14)',
        '--danger':        '#ef4444',
        '--danger-subtle': 'rgba(239,68,68,0.12)',
        '--success':       '#22c55e',
        '--success-subtle':'rgba(34,197,94,0.12)',
        '--warning':       '#f59e0b',
        '--input-bg':      mix(bgRgb,0.35),
        '--input-border':  isDark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.14)',
      };
      var root = document.documentElement;
      Object.keys(vars).forEach(function(k){ root.style.setProperty(k, vars[k]); });
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}
