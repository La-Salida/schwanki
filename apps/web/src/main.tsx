import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary, startMonitoring } from "@/lib/monitoring";
import { SUPPORT_EMAIL } from "@/lib/legal";
import "./index.css";
import { keepAppFresh } from "./lib/swUpdate";
import { captureFirstTouch } from "./lib/attribution";
import { startAnalytics } from "./lib/analytics";

captureFirstTouch();
startAnalytics();
keepAppFresh();

startMonitoring();

function CrashScreen() {
  return (
    <main className="page-shell space-y-4" role="alert">
      <h1 className="text-2xl font-black tracking-tight">Something broke on this screen</h1>
      <p className="text-ink/70">We've been sent the error report. Reload to keep going. If it keeps happening, email {SUPPORT_EMAIL}.</p>
      <button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload</button>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ErrorBoundary fallback={<CrashScreen />}><App /></ErrorBoundary></React.StrictMode>,
);
