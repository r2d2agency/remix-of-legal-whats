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
import { HelpCircle, Facebook, MousePointerClick, CheckCircle2, Wrench } from "lucide-react";

const previewSteps = [
  {
    icon: Facebook,
    title: "1. Clique em \"Conectar com Facebook\"",
    body: "Você será redirecionado ao login oficial do Facebook. Use a conta que administra sua Página, Instagram Business e/ou WhatsApp Business.",
  },
  {
    icon: MousePointerClick,
    title: "2. Escolha o que deseja conectar",
    body: "Selecione sua Página do Facebook, sua conta Instagram Business e/ou seu número WhatsApp Business. Tudo na mesma tela, sem precisar copiar tokens.",
  },
  {
    icon: CheckCircle2,
    title: "3. Pronto — sua conta está integrada",
    body: "A Gleego cuida do resto: webhook, renovação de token e roteamento de mensagens. Você já pode atender pelo painel.",
  },
];

export function MetaApiHelpDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Como conectar WhatsApp Business
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-primary" />
            Conexão simplificada
            <Badge variant="secondary" className="ml-1 gap-1">
              <Wrench className="h-3 w-3" /> Em desenvolvimento
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Estamos finalizando a integração que conecta seu WhatsApp Business à Gleego em poucos cliques, sem você precisar criar nada do lado da Meta.
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