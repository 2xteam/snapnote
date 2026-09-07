import type { CSSProperties } from "react";
import { AppIcon } from "@/components/AppIcon";
import { LandingCta, LandingHeaderAuth } from "@/components/LandingAuth";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Sheet } from "@/components/Sheet";

/**
 * 소개 페이지 — 루트(`/`).
 *
 * **로그인하지 않아도 볼 수 있다.** 예전에는 루트가 곧 로그인 화면이어서
 * 이 앱이 무엇을 하는 곳인지 알 방법이 없었다. 로그인 화면은 `/login`으로 옮겼고,
 * 포털에서 들어오는 링크는 `/home`을 가리킨다.
 *
 * 결쩜사 패턴 그대로 **시트를 쌓는다** — 전체 폭 섹션을 쓰지 않고 둥근 카드를
 * 세로로 얹고, 마지막에 어두운 푸터로 문서를 닫는다.
 * 근거: my-obsidian-vault → 20-Design/결쩜사 페이지 패턴.md
 */
export default function LandingPage() {
  return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <header style={headerStyle}>
          <div className="page" style={{ ...headerInner, paddingTop: 14, paddingBottom: 14 }}>
            <span className="row" style={{ gap: 9 }}>
              <AppIcon size={30} priority />
              <span style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>SnapNote</span>
            </span>
            <LandingHeaderAuth />
          </div>
          {/* 헤더가 sticky 라서 띠가 스크롤을 따라온다 */}
          <ScrollProgress />
        </header>

        <main className="page">
          <Sheet
            tone="dark"
            point
            eyebrow="SNAPNOTE · WRONG ANSWERS"
            headline={
              <>
                틀린 문제만,
                <br />
                <span style={{ color: "#ead58c" }}>모아 둡니다.</span>
              </>
            }
            lead="틀린 문제를 찍어 모노톤으로 정리해 나만의 오답노트를 만듭니다. 폴더로 묶어 인쇄해 다시 풀 수 있습니다."
          >
            <div style={{ marginTop: 24 }}>
              <LandingCta variant="hero" />
            </div>
          </Sheet>

          <Sheet tone="tint" eyebrow="HOW IT WORKS" headline="세 걸음이면 됩니다">
            {/* 번호 원과 연결선은 app/elements.css 의 .flow 가 그린다.
                예전 인라인 stepNumStyle 은 번호에 면적용 var(--accent) 를 글자색으로
                썼다 — .flow-num 은 글자용 var(--accent-ink) 를 쓴다 */}
            <ol className="flow">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flow-step">
                  <span className="flow-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Sheet>

          <Sheet eyebrow="WHAT YOU GET" headline={<><span className="mark">다시 풀 것만</span> 남깁니다</>}>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {FEATURES.map((f) => (
                <div key={f.name} className="card--point" style={featureStyle}>
                  <strong style={{ fontSize: "0.92rem" }}>{f.name}</strong>
                  <p style={stepDescStyle}>{f.desc}</p>
                </div>
              ))}
            </div>
          </Sheet>

          <Sheet
            tone="gold"
            eyebrow="ONE ACCOUNT"
            headline="계정만 공유해요"
            lead="myjane 계정 하나로 여러 기록 서비스를 골라 씁니다. 기록과 데이터는 서비스마다 따로 쌓여요."
          >
            <p className="note-block">
              <strong>NOTE</strong>
              쓰지 않는 서비스는 열지 않아도 돼요. 이 앱만 써도 충분합니다.
            </p>
          </Sheet>

          <Sheet center point eyebrow="START" headline="틀린 문제 하나만 찍어 볼까요?">
            <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
              <LandingCta variant="closing" />
            </div>
          </Sheet>
        </main>

        <footer style={footerStyle}>
          <div className="page" style={{ textAlign: "center", paddingBottom: 28 }}>
            <p style={{ margin: "0 0 14px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              SnapNote
            </p>
            <p style={{ margin: 0 }}>
              <a href="https://www.myjane.co.kr" className="myjane-mark" style={{ color: "var(--on-dark)" }}>
                my<span>jane</span>
              </a>
            </p>
            {/*
              법적 고지 — 세 페이지는 포털(myjane)에 한 벌만 둔다.
              여섯 앱이 회원과 세션을 공유하므로 방침도 한 곳이어야 한다.
              → my-obsidian-vault / 50-Plans/C 법적 페이지.md
            */}
            <p style={footerLegalStyle}>
              <a href="https://www.myjane.co.kr/legal/privacy" style={footerLegalLinkStyle}>
                개인정보처리방침
              </a>
              <span style={footerLegalSepStyle}>·</span>
              <a href="https://www.myjane.co.kr/legal/terms" style={footerLegalLinkStyle}>
                이용약관
              </a>
              <span style={footerLegalSepStyle}>·</span>
              <a href="https://www.myjane.co.kr/legal/cookies" style={footerLegalLinkStyle}>
                쿠키 안내
              </a>
            </p>
            <p style={footerLineStyle}>@2026 myjane All rights reserved</p>
          </div>
        </footer>
      </div>
  );
}

const STEPS = [
  {
    "title": "틀린 문제를 찍는다",
    "desc": "시험지든 문제집이든 그 자리에서 찍습니다."
  },
  {
    "title": "보기 좋게 정리된다",
    "desc": "모노톤으로 다듬어 오려 붙인 것처럼 깔끔하게 남습니다."
  },
  {
    "title": "묶어서 인쇄한다",
    "desc": "폴더로 묶어 인쇄하면 그대로 오답노트가 됩니다."
  }
];

const FEATURES = [
  {
    "name": "사진 한 장으로",
    "desc": "오려 붙이거나 다시 옮겨 적지 않습니다."
  },
  {
    "name": "모노톤 정리",
    "desc": "배경과 그림자를 눌러 인쇄해도 깨끗합니다."
  },
  {
    "name": "인쇄해서 다시 풀기",
    "desc": "화면으로 보는 것과 손으로 푸는 것은 다릅니다."
  }
];

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 40,
  background: "var(--bg-primary)",
  borderBottom: "1px solid var(--border-subtle)",
};

const headerInner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const stepDescStyle: CSSProperties = {
  margin: "5px 0 0",
  fontSize: "0.82rem",
  lineHeight: 1.75,
  color: "var(--text-secondary)",
  wordBreak: "keep-all",
};

const featureStyle: CSSProperties = {
  padding: "15px 17px",
  // ⚠️ 좌상·우하는 .card--point 가 깎는다 (app/elements.css). 인라인
  // borderRadius shorthand 를 쓰면 네 모서리를 모두 세워 그 깎임을 덮어쓴다 —
  // 그래서 남는 두 모서리만 longhand 로 적는다
  borderTopRightRadius: "var(--radius-sm)",
  borderBottomLeftRadius: "var(--radius-sm)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-subtle)",
};

const footerStyle: CSSProperties = {
  marginTop: 40,
  paddingTop: 30,
  background: "var(--footer-bg)",
  color: "var(--on-dark)",
};

const footerLineStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "0.78rem",
  lineHeight: 1.8,
  color: "var(--on-dark-faint)",
  wordBreak: "keep-all",
};

/*
 * 어두운 푸터의 법적 고지 링크. 짙은 면 위이므로 --on-dark 계열을 쓴다
 * (밝은 면용 토큰을 쓰면 2~3:1 로 떨어진다).
 * 다섯 앱이 같은 모양이다 — 고칠 때 함께 고친다.
 */
const footerLegalStyle: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "0.78rem",
  lineHeight: 1.9,
};

const footerLegalLinkStyle: CSSProperties = {
  color: "var(--on-dark-dim)",
  textDecoration: "none",
  fontWeight: 600,
};

const footerLegalSepStyle: CSSProperties = {
  margin: "0 8px",
  color: "var(--on-dark-faint)",
};
