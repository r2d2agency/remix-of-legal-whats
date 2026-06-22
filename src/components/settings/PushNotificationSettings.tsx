import { Bell, BellOff, BellRing, Loader2, Send, Timer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

export function PushNotificationSettings() {
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe, sendTestNotification } = usePushNotifications();
  const [delayCountdown, setDelayCountdown] = useState<number | null>(null);

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) toast.success("Notificações push desativadas");
      else toast.error("Erro ao desativar notificações");
    } else {
      const ok = await subscribe();
      if (ok) toast.success("Notificações push ativadas!");
      else if (permission === 'denied') toast.error("Permissão de notificações bloqueada no navegador. Desbloqueie nas configurações do navegador.");
      else toast.error("Erro ao ativar notificações push");
    }
  };

  const handleTest = async () => {
    try {
      const result = await sendTestNotification();
      if (result?.success) toast.success(`Notificação de teste enviada! (${result.sent} dispositivo(s))`);
      else toast.error("Erro ao enviar notificação de teste");
    } catch (err: any) {
      const msg = err?.message || "Erro desconhecido";
      const status = err?.status ? ` (HTTP ${err.status})` : "";
      toast.error(`Erro ao enviar: ${msg}${status}`, { duration: 8000 });
    }
  };

  const handleTestBackground = async () => {
    const seconds = 10;
    setDelayCountdown(seconds);
    toast.info(`Vai disparar em ${seconds}s — saia do app, bloqueie a tela ou abra outro app agora! 📱`, {
      duration: seconds * 1000,
    });

    const interval = setInterval(() => {
      setDelayCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);

    try {
      const result = await sendTestNotification({ delaySeconds: seconds });
      clearInterval(interval);
      setDelayCountdown(null);
      if (result?.success) toast.success(`🔔 Push enviada para ${result.sent} dispositivo(s)!`);
      else toast.error("Erro ao enviar notificação de teste");
    } catch (err: any) {
      clearInterval(interval);
      setDelayCountdown(null);
      const msg = err?.message || "Erro desconhecido";
      const status = err?.status ? ` (HTTP ${err.status})` : "";
      toast.error(`Erro ao enviar: ${msg}${status}`, { duration: 8000 });
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Notificações Push</CardTitle>
              <CardDescription className="text-xs">
                Receba alertas mesmo com o navegador fechado
              </CardDescription>
            </div>
          </div>
          <Badge variant={isSubscribed ? "default" : "secondary"} className="text-[10px]">
            {isSubscribed ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            onClick={handleToggle}
            disabled={loading}
            variant={isSubscribed ? "outline" : "default"}
            className="flex-1 gap-2"
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {isSubscribed ? "Desativar" : "Ativar Notificações"}
          </Button>

          {isSubscribed && (
            <Button onClick={handleTest} variant="outline" size="sm" className="gap-2" disabled={loading}>
              <Send className="h-3.5 w-3.5" />
              Testar
            </Button>
          )}
        </div>

        {isSubscribed && (
          <Button
            onClick={handleTestBackground}
            variant="secondary"
            size="sm"
            className="w-full gap-2"
            disabled={loading || delayCountdown !== null}
          >
            {delayCountdown !== null ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Disparando em {delayCountdown}s — saia do app!
              </>
            ) : (
              <>
                <Timer className="h-3.5 w-3.5" />
                Testar em segundo plano (10s)
              </>
            )}
          </Button>
        )}

        {isSubscribed && (
          <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2">
            💡 <strong>Como testar push real:</strong> clique em "Testar em segundo plano", depois <strong>saia do app</strong> (volte pra home, bloqueie a tela ou abra outro app). A notificação chega em 10s com som e vibração.
          </p>
        )}

        {permission === 'denied' && (
          <p className="text-xs text-destructive">
            ⚠️ Notificações bloqueadas no navegador. Vá nas configurações do navegador para desbloquear.
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          Você receberá notificações de novas mensagens, tarefas e alertas importantes mesmo quando o app estiver em segundo plano.
        </p>
      </CardContent>
    </Card>
  );
}
