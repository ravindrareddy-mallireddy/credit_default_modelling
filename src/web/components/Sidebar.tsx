import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

const nav = [
  { path: "/", label: "Dashboard", icon: "⬡" },
  { path: "/calculator", label: "PD Calculator", icon: "◎" },
  { path: "/stress", label: "Stress Testing", icon: "⚡" },
  { path: "/shap", label: "SHAP Explorer", icon: "◈" },
  { path: "/montecarlo", label: "Monte Carlo", icon: "◇" },
  { path: "/ifrs9", label: "IFRS9 / ECL", icon: "▣" },
];

const SIDEBAR_WIDTH = 220;
const COLLAPSED_WIDTH = 56;

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapse?.(next);
  };

  // Mobile: drawer overlay
  if (isMobile) {
    return (
      <>
        {/* Hamburger button — top-left, always visible */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          style={{
            position: "fixed", top: 14, left: 14, zIndex: 300,
            background: "#070f1f", border: "1px solid #1a2d4a",
            borderRadius: 6, width: 36, height: 36,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 5, cursor: "pointer", padding: 0,
          }}
        >
          {mobileOpen ? (
            <span style={{ color: "#00d4ff", fontSize: 18, lineHeight: 1, fontWeight: 700 }}>✕</span>
          ) : (
            <>
              <span style={{ display: "block", width: 18, height: 2, background: "#00d4ff", borderRadius: 2 }} />
              <span style={{ display: "block", width: 18, height: 2, background: "#00d4ff", borderRadius: 2 }} />
              <span style={{ display: "block", width: 18, height: 2, background: "#00d4ff", borderRadius: 2 }} />
            </>
          )}
        </button>

        {/* Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
              zIndex: 150, backdropFilter: "blur(2px)",
            }}
          />
        )}

        {/* Slide-in drawer */}
        <aside
          style={{
            width: SIDEBAR_WIDTH, minHeight: "100vh",
            background: "#070f1f", borderRight: "1px solid #1a2d4a",
            display: "flex", flexDirection: "column",
            position: "fixed", top: 0, left: 0, zIndex: 200,
            transform: mobileOpen ? "translateX(0)" : `translateX(-${SIDEBAR_WIDTH}px)`,
            transition: "transform 0.25s ease",
          }}
        >
          <SidebarInner
            location={location}
            showLabels={true}
            collapsed={false}
            onToggle={() => setMobileOpen(false)}
            closeIcon
          />
        </aside>
      </>
    );
  }

  // Desktop: collapsible sidebar
  return (
    <aside
      style={{
        width: collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        minHeight: "100vh", background: "#070f1f",
        borderRight: "1px solid #1a2d4a", display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, zIndex: 100,
        transition: "width 0.22s ease", overflow: "hidden",
      }}
    >
      <SidebarInner
        location={location}
        showLabels={!collapsed}
        collapsed={collapsed}
        onToggle={toggle}
      />
    </aside>
  );
}

function SidebarInner({
  location,
  showLabels,
  collapsed,
  onToggle,
  closeIcon = false,
}: {
  location: string;
  showLabels: boolean;
  collapsed: boolean;
  onToggle: () => void;
  closeIcon?: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: "18px 14px 14px",
          borderBottom: "1px solid #1a2d4a",
          display: "flex", alignItems: "center",
          justifyContent: showLabels ? "space-between" : "center",
          minHeight: 64, gap: 8,
        }}
      >
        {showLabels && (
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{
              fontFamily: "Syne", fontWeight: 800, fontSize: 14,
              color: "#00d4ff", letterSpacing: "0.05em", whiteSpace: "nowrap",
            }}>
              CREDIT RISK
            </div>
            <div style={{
              fontFamily: "Syne", fontWeight: 600, fontSize: 10,
              color: "#334155", letterSpacing: "0.12em", marginTop: 2, whiteSpace: "nowrap",
            }}>
              INTELLIGENCE PLATFORM
            </div>
          </div>
        )}

        {/* Toggle / close button */}
        <button
          onClick={onToggle}
          aria-label={closeIcon ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            background: "transparent", border: "1px solid #1a2d4a",
            borderRadius: 5, width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, padding: 0,
          }}
        >
          {closeIcon ? (
            <span style={{ color: "#00d4ff", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✕</span>
          ) : collapsed ? (
            <span style={{ color: "#00d4ff", fontSize: 12, lineHeight: 1 }}>▶</span>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1, letterSpacing: "-2px" }}>☰</span>
          )}
        </button>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "10px 0" }}>
        {nav.map(({ path, label, icon }) => {
          const active = location === path;
          return (
            <Link key={path} href={path}>
              <div
                title={!showLabels ? label : undefined}
                style={{
                  display: "flex", alignItems: "center",
                  gap: showLabels ? 10 : 0,
                  justifyContent: showLabels ? "flex-start" : "center",
                  padding: showLabels ? "10px 16px" : "13px 0",
                  cursor: "pointer",
                  background: active ? "#0f1e35" : "transparent",
                  borderLeft: active ? "2px solid #00d4ff" : "2px solid transparent",
                  color: active ? "#00d4ff" : "#64748b",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap", overflow: "hidden",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
              >
                <span style={{ fontSize: 17, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                {showLabels && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {showLabels && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid #1a2d4a" }}>
          <div style={{ fontSize: 10, color: "#334155", fontFamily: "DM Mono", lineHeight: 1.6 }}>
            UCI Credit Card Dataset<br />
            n=30,000 · Default=22.1%<br />
            Champion: LR (WoE+Scorecard)
          </div>
        </div>
      )}
    </>
  );
}
