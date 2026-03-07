import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function PWAUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleSWUpdate = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg);
      setShowBanner(true);
    };

    // Listen for the vite-plugin-pwa update event
    const onNeedRefresh = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.registration) {
        handleSWUpdate(detail.registration);
      }
    };

    // Check for updates from vite-plugin-pwa's virtual module
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New content available
                setRegistration(reg);
                setShowBanner(true);
              }
            });
          });

          // Also check if there's already a waiting worker
          if (reg.waiting && navigator.serviceWorker.controller) {
            setRegistration(reg);
            setShowBanner(true);
          }

          // Periodically check for updates (every 60s)
          const interval = setInterval(() => {
            reg.update().catch(() => {});
          }, 60 * 1000);
          return () => clearInterval(interval);
        }
      } catch (err) {
        console.error("[PWA] Error checking for updates:", err);
      }
    };

    document.addEventListener("swUpdated", onNeedRefresh);
    checkForUpdates();

    return () => {
      document.removeEventListener("swUpdated", onNeedRefresh);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    setUpdating(true);
    setProgress(0);

    // Simulate progress while the SW activates
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    const waiting = registration?.waiting;
    if (waiting) {
      // Tell the waiting SW to skip waiting and become active
      waiting.postMessage({ type: "SKIP_WAITING" });

      // Listen for the new SW to take control
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearInterval(progressInterval);
        setProgress(100);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      });
    } else {
      // Fallback: just reload
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [registration]);

  if (!showBanner) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground",
      "shadow-lg transition-all duration-300 ease-in-out"
    )}>
      {updating && (
        <Progress value={progress} className="h-1 rounded-none bg-primary-foreground/20 [&>div]:bg-primary-foreground" />
      )}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw className={cn("h-4 w-4 flex-shrink-0", updating && "animate-spin")} />
          <span className="text-sm font-medium truncate">
            {updating ? "Atualizando..." : "Nova versão disponível!"}
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
