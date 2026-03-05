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

// Suppress DOM manipulation errors caused by browser extensions
// (translation extensions, Grammarly, etc. modify the DOM outside React)
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('insertBefore') ||
    event.message?.includes('removeChild') ||
    event.message?.includes('NotFoundError')
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('insertBefore') ||
    event.reason?.message?.includes('removeChild') ||
    event.reason?.message?.includes('NotFoundError')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
