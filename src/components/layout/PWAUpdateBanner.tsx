import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

// Build hash injected at build time — changes on each deploy
const BUILD_ID = import.meta.env.VITE_BUILD_ID || Date.now().toString();

export function PWAUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let interval: ReturnType<typeof setInterval>;

    const setup = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        // When a new SW is found installing
        const onUpdateFound = () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                // New version ready — show banner
                setShowBanner(true);
                toast.info("Nova versão disponível!", {
                  description: "Clique em 'Atualizar' para aplicar.",
                  duration: 8000,
                });
              }
            }
          });
        };

        reg.addEventListener("updatefound", onUpdateFound);

        // Check if there's already a waiting SW
        if (reg.waiting && navigator.serviceWorker.controller) {
          setShowBanner(true);
        }

        // Check for updates every 30 seconds
        interval = setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 1000);

        // Also listen for controller change (auto-update applied)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (updating) return; // we're already handling it
          // Auto-update happened in background — reload silently
          window.location.reload();
        });
      } catch (err) {
        console.error("[PWA] Error setting up update listener:", err);
      }
    };

    setup();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [updating]);

  // Also poll for app-level changes via a lightweight version check
  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Fetch index.html with cache-bust to detect new builds
        const res = await fetch(`/?_v=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "text/html" },
        });
        if (!res.ok) return;
        const html = await res.text();
        // If the HTML contains a different build hash, there's an update
        if (html.includes("/assets/") && !html.includes(BUILD_ID)) {
          // Force SW update check
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) reg.update();
        }
      } catch {
        // Network error — ignore
      }
    };

    // Check every 60 seconds
    const versionInterval = setInterval(checkVersion, 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);

  const handleUpdate = useCallback(() => {
    setUpdating(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 20;
      });
    }, 150);

    const doUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const waiting = reg?.waiting;

        if (waiting) {
          waiting.postMessage({ type: "SKIP_WAITING" });
          // controllerchange listener will reload
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            clearInterval(progressInterval);
            setProgress(100);
            setTimeout(() => window.location.reload(), 400);
          });
        } else {
          // No waiting worker — clear all caches and reload
          clearInterval(progressInterval);
          setProgress(80);

          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          }

          setProgress(100);
          setTimeout(() => window.location.reload(), 400);
        }
      } catch {
        clearInterval(progressInterval);
        // Fallback: force reload
        window.location.reload();
      }
    };

    doUpdate();
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground",
        "shadow-lg transition-all duration-300 ease-in-out"
      )}
    >
      {updating && (
        <Progress
          value={progress}
          className="h-1 rounded-none bg-primary-foreground/20 [&>div]:bg-primary-foreground"
        />
      )}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {updating ? (
            <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {updating
              ? "Atualizando sistema..."
              : "Nova versão disponível!"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!updating && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                onClick={handleUpdate}
              >
                Atualizar agora
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setShowBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
