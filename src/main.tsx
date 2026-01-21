import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize PWA install prompt handler
import "./lib/pwa";

// Initialize theme before render to prevent flash
const savedTheme = localStorage.getItem('app-theme') || 'dark';
const effectiveTheme = savedTheme === 'system' 
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : savedTheme;
document.documentElement.classList.add(effectiveTheme);

createRoot(document.getElementById("root")!).render(<App />);
