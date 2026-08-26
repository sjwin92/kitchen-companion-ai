import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/monitoring";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
