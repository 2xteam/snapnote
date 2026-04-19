import { ThemeProvider } from "@/components/ThemeProvider";
import { TopNav } from "@/components/TopNav";
import { FloatingChat } from "@/components/FloatingChat";

export default function AppShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <TopNav />
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "calc(var(--nav-height) + var(--nav-top) + 1rem) 1rem 2rem",
          }}
        >
          {children}
        </div>
        <FloatingChat />
      </div>
    </ThemeProvider>
  );
}
