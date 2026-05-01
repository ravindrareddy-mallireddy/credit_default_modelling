import { useState, useEffect } from "react";
import { Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/dashboard";
import Calculator from "./pages/calculator";
import Stress from "./pages/stress";
import Shap from "./pages/shap";
import MonteCarlo from "./pages/montecarlo";
import IFRS9 from "./pages/ifrs9";

const SIDEBAR_FULL = 220;
const SIDEBAR_COLLAPSED = 56;

function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Listen for sidebar toggle events from Sidebar component
  useEffect(() => {
    const handler = (e: Event) => {
      setCollapsed((e as CustomEvent).detail.collapsed);
    };
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  const marginLeft = isMobile ? 0 : collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#050d1a" }}>
      <Sidebar onCollapse={setCollapsed} />
      <main
        style={{
          marginLeft,
          flex: 1,
          padding: isMobile ? "64px 16px 32px" : "32px 36px",
          maxWidth: `calc(100vw - ${marginLeft}px)`,
          minHeight: "100vh",
          overflowX: "hidden",
          transition: "margin-left 0.22s ease, max-width 0.22s ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <Provider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/calculator" component={Calculator} />
          <Route path="/stress" component={Stress} />
          <Route path="/shap" component={Shap} />
          <Route path="/montecarlo" component={MonteCarlo} />
          <Route path="/ifrs9" component={IFRS9} />
        </Switch>
      </Layout>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
