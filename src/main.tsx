import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Prevent service worker registration in preview/iframe contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--");
const isLocalhost =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

if (isPreviewHost || isInIframe || isLocalhost) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
