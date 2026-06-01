import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Build hash injected at build time — changes on each deploy
const BUILD_ID = import.meta.env.VITE_BUILD_ID || Date.now().toString();

export function PWAUpdateBanner() {
  const [showPopup, setShowPopup] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let interval: ReturnType<typeof setInterval>;

    const setup = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;

        const onUpdateFound = () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setShowPopup(true);
            }
          });
        };

        reg.addEventListener("updatefound", onUpdateFound);

        if (reg.waiting && navigator.serviceWorker.controller) {
          setShowPopup(true);
        }

        // Check for updates every 30 seconds
        interval = setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 1000);
      } catch (err) {
        console.error("[PWA] Error setting up update listener:", err);
      }
    };

    setup();
    return () => { if (interval) clearInterval(interval); };
  }, []);

  // Periodically check for updates
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // console.log("[PWA] Checking for updates...");
          await reg.update();
        }
      } catch (err) {
        // console.error("[PWA] Update check failed:", err);
      }
    };

    // Check every 5 minutes instead of 1 minute to be less aggressive but reliable
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
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
        return prev + Math.random() * 15;
      });
    }, 200);

    const doUpdate = async () => {
      try {
        // Pre-cache: fetch main assets
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }

        setProgress(50);

        const reg = await navigator.serviceWorker.getRegistration();
        const waiting = reg?.waiting;

        if (waiting) {
          waiting.postMessage({ type: "SKIP_WAITING" });

          navigator.serviceWorker.addEventListener("controllerchange", () => {
            clearInterval(progressInterval);
            setProgress(100);
            setDone(true);
            setTimeout(() => window.location.reload(), 800);
          });
        } else {
          clearInterval(progressInterval);
          setProgress(100);
          setDone(true);
          setTimeout(() => window.location.reload(), 800);
        }
      } catch {
        clearInterval(progressInterval);
        window.location.reload();
      }
    };

    doUpdate();
  }, []);

  if (!showPopup) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={cn(
        "bg-card border rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full",
        "animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      )}>
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={cn(
            "p-4 rounded-full",
            done ? "bg-success/10" : updating ? "bg-primary/10" : "bg-primary/10"
          )}>
            {done ? (
              <CheckCircle2 className="h-10 w-10 text-success" />
            ) : updating ? (
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <Sparkles className="h-10 w-10 text-primary" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-foreground text-center">
          {done ? "Atualização concluída!" : updating ? "Atualizando..." : "Nova atualização disponível!"}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground text-center mt-2">
          {done
            ? "O sistema será recarregado automaticamente."
            : updating
            ? "Pré-carregando nova versão, aguarde..."
            : "Uma nova versão do sistema está pronta. Clique para atualizar agora."}
        </p>

        {/* Progress bar */}
        {updating && (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center mt-1">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Actions */}
        {!updating && !done && (
          <div className="flex flex-col gap-2 mt-5">
            <Button onClick={handleUpdate} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Atualizar agora
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowPopup(false)}
            >
              Depois
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
