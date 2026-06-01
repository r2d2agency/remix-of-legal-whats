import { useState } from "react";
import { RefreshCw, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function SystemUpdateCard() {
  const [isChecking, setIsChecking] = useState(false);

  const handleUpdate = async () => {
    setIsChecking(true);
    try {
      if (!("serviceWorker" in navigator)) {
        toast.info("O seu navegador não suporta atualizações automáticas via Service Worker.");
        setIsChecking(false);
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        toast.info("Não foi possível encontrar um Service Worker registrado. Tentando recarregar a página...");
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      // Check for updates
      await reg.update();
      
      // We wait a bit to see if an update is found
      setTimeout(() => {
        if (!reg.waiting && !reg.installing) {
          toast.success("O sistema já está na versão mais recente!");
        } else {
          toast.success("Uma atualização foi encontrada e está sendo preparada.");
        }
        setIsChecking(false);
      }, 1500);
    } catch (err) {
      console.error("[Update] Error:", err);
      toast.error("Erro ao procurar atualizações.");
      setIsChecking(false);
    }
  };

  const forceReload = () => {
    toast.info("Limpando cache e recarregando...");
    if ("caches" in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }
    setTimeout(() => {
      window.location.href = window.location.origin + "/?_v=" + Date.now();
    }, 500);
  };

  return (
    <Card className="animate-fade-in shadow-card border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Sistema e Versão
        </CardTitle>
        <CardDescription>
          Gerencie a versão e atualizações do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-primary/5 p-4 flex gap-3 items-start">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-primary">Informação de Atualização</p>
            <p className="text-muted-foreground">
              O Glee-go Whats atualiza automaticamente em segundo plano. 
              Se você notar algum erro ou lentidão, pode forçar uma verificação manual abaixo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button 
            onClick={handleUpdate} 
            disabled={isChecking}
            variant="outline"
            className="w-full gap-2"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isChecking ? "Verificando..." : "Verificar Atualizações"}
          </Button>
          
          <Button 
            onClick={forceReload}
            variant="ghost"
            className="w-full gap-2 text-muted-foreground hover:text-destructive"
          >
            <RefreshCw className="h-4 w-4" />
            Forçar Recarregamento
          </Button>
        </div>
        
        <p className="text-[10px] text-center text-muted-foreground">
          Versão do Build: {import.meta.env.VITE_BUILD_ID || "Standard Build"}
        </p>
      </CardContent>
    </Card>
  );
}