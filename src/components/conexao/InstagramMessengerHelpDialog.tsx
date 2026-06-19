import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, MousePointerClick, CheckCircle2, Wrench } from "lucide-react";

const previewSteps = [
  {
    icon: Facebook,
    title: "1. Clique em \"Conectar com Facebook\"",
    body: "Você será redirecionado ao login oficial do Facebook. Use a conta que administra sua Página e sua conta Instagram Business.",
  },
  {
    icon: MousePointerClick,
    title: "2. Escolha a Página e o Instagram",
    body: "Selecione a Página do Facebook e a conta Instagram Business que deseja integrar. Pode escolher mais de uma.",
  },
  {
    icon: CheckCircle2,
    title: "3. Pronto — sua conta está integrada",
    body: "A Gleego cuida do webhook, das renovações e do roteamento das mensagens. Você já recebe e responde Direct e Messenger pelo painel.",
  },
];

export function InstagramMessengerHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Instagram className="h-4 w-4" />
          Como conectar Instagram / Messenger
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-primary" />
            Conexão simplificada
            <Badge variant="secondary" className="ml-1 gap-1">
              <Wrench className="h-3 w-3" /> Em desenvolvimento
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Estamos finalizando a integração que conecta seu Instagram Direct e Facebook Messenger à Gleego em poucos cliques, sem você precisar criar App nem token na Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {previewSteps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3 rounded-lg border bg-card p-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          Enquanto a conexão simplificada não é liberada, fale com o suporte da Gleego para que sua conta seja ativada manualmente.
        </div>
      </DialogContent>
    </Dialog>
  );
}
