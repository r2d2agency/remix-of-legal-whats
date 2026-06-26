import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Monitor, Wifi, WifiOff, Loader2, Users } from "lucide-react";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { api } from "@/lib/api";

interface Connection {
  id: string;
  name: string;
  phone_number?: string;
  status?: string;
}

export function NotificationConnectionSettings() {
  const { settings, updateSettings, isMobileDevice: isMobile } = useNotificationSound();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<Connection[]>("/api/connections");
        setConnections(data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleConnectionMute = (connectionId: string) => {
    const muted = settings.mutedConnections || [];
    const newMuted = muted.includes(connectionId)
      ? muted.filter(id => id !== connectionId)
      : [...muted, connectionId];
    updateSettings({ mutedConnections: newMuted });
  };

  return (
    <Card className="animate-fade-in shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          Notificações por Dispositivo e Conexão
        </CardTitle>
        <CardDescription>
          Controle onde e de quais conexões você recebe notificações sonoras
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mute all groups */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Grupos do WhatsApp</Label>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${settings.muteGroups ? 'bg-muted' : 'bg-primary/10'}`}>
                <Users className={`h-4 w-4 ${settings.muteGroups ? 'text-muted-foreground' : 'text-primary'}`} />
              </div>
              <div>
                <p className="text-sm font-medium">Silenciar todos os grupos</p>
                <p className="text-xs text-muted-foreground">
                  Não toca som para nenhum grupo. Depois, você pode reativar o som
                  apenas nos grupos específicos pelo menu do próprio grupo no chat.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.muteGroups}
              onCheckedChange={(checked) => updateSettings(checked ? { muteGroups: true, allowedGroups: [] } : { muteGroups: false })}
            />
          </div>
        </div>

        {/* Per-device toggles */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Dispositivo</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Monitor className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Computador (Desktop)</p>
                  <p className="text-xs text-muted-foreground">
                    Tocar som no navegador do PC/Mac
                  </p>
                </div>
                {!isMobile && (
                  <Badge variant="outline" className="text-[10px]">Este dispositivo</Badge>
                )}
              </div>
              <Switch
                checked={settings.soundEnabledDesktop}
                onCheckedChange={(checked) => updateSettings({ soundEnabledDesktop: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Celular (Mobile)</p>
                  <p className="text-xs text-muted-foreground">
                    Tocar som no navegador do celular
                  </p>
                </div>
                {isMobile && (
                  <Badge variant="outline" className="text-[10px]">Este dispositivo</Badge>
                )}
              </div>
              <Switch
                checked={settings.soundEnabledMobile}
                onCheckedChange={(checked) => updateSettings({ soundEnabledMobile: checked })}
              />
            </div>
          </div>
        </div>

        {/* Per-connection toggles */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Conexões</Label>
          <p className="text-xs text-muted-foreground">
            Silencie conexões específicas para não receber notificações sonoras delas
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Nenhuma conexão encontrada
            </p>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => {
                const isMuted = (settings.mutedConnections || []).includes(conn.id);
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isMuted ? 'bg-muted' : 'bg-primary/10'}`}>
                        {isMuted ? (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Wifi className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{conn.name}</p>
                        {conn.phone_number && (
                          <p className="text-xs text-muted-foreground">{conn.phone_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {isMuted ? 'Silenciada' : 'Ativa'}
                      </span>
                      <Switch
                        checked={!isMuted}
                        onCheckedChange={() => toggleConnectionMute(conn.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
