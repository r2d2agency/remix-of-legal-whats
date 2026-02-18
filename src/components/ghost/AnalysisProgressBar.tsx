import { cn } from "@/lib/utils";
import { Check, Search, Brain, BarChart3, Loader2 } from "lucide-react";
import type { AnalysisStep } from "@/hooks/use-ghost-analysis";

const steps = [
  { key: "fetching", label: "Buscando conversas", icon: Search },
  { key: "analyzing", label: "Analisando com IA", icon: Brain },
  { key: "processing", label: "Processando resultados", icon: BarChart3 },
] as const;

const stepOrder: AnalysisStep[] = ["fetching", "analyzing", "processing", "done"];

function getStepIndex(step: AnalysisStep) {
  return stepOrder.indexOf(step);
}

export function AnalysisProgressBar({ currentStep }: { currentStep: AnalysisStep }) {
  if (currentStep === "idle") return null;

  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="w-full rounded-xl border bg-card p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        {steps.map((s, idx) => {
          const isDone = currentIdx > idx || currentStep === "done";
          const isActive = currentIdx === idx && currentStep !== "done";
          const Icon = s.icon;

          return (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                    isDone && "bg-primary border-primary text-primary-foreground",
                    isActive && "border-primary bg-primary/10 text-primary animate-pulse",
                    !isDone && !isActive && "border-muted-foreground/30 text-muted-foreground/40"
                  )}
                >
                  {isDone ? (
                    <Check className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium text-center transition-colors",
                    isDone && "text-primary",
                    isActive && "text-foreground",
                    !isDone && !isActive && "text-muted-foreground/50"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-6 relative overflow-hidden rounded-full bg-muted-foreground/10">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700 ease-out",
                      isDone ? "w-full" : isActive ? "w-1/2 animate-pulse" : "w-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {currentStep === "done" && (
        <p className="text-center text-sm text-primary font-medium animate-in fade-in duration-500">
          ✨ Análise concluída com sucesso!
        </p>
      )}
    </div>
  );
}
