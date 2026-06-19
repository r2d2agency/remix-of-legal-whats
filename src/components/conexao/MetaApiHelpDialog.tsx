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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, ExternalLink, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";

interface Step {
  title: string;
  body: React.ReactNode;
}

const steps: Step[] = [
  {
    title: "1. Tenha uma conta no Meta Business Manager",
    body: (
      <>
        <p>
          Acesse <a className="text-primary underline" href="https://business.facebook.com" target="_blank" rel="noreferrer">business.facebook.com</a> e
          crie (ou entre em) sua conta empresarial. Recomenda-se que o negócio esteja <strong>verificado</strong> pela Meta para evitar limites.
        </p>
      </>
    ),
  },
  {
    title: "2. Crie um App no Meta for Developers",
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>Vá em <a className="text-primary underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> e clique em <strong>"Criar App"</strong>.</li>
          <li>Escolha o tipo <strong>"Negócios" (Business)</strong>.</li>
          <li>Dê um nome, e-mail de contato e vincule à sua conta do Business Manager.</li>
          <li>Após criar, na tela do app, adicione o produto <strong>"WhatsApp"</strong> clicando em "Configurar".</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. Configure o WhatsApp Business Account (WABA)",
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>Na seção <strong>WhatsApp → Configuração da API</strong>, selecione (ou crie) uma conta do WhatsApp Business.</li>
          <li>Adicione um <strong>número de telefone</strong>. Pode usar o número de teste fornecido pela Meta inicialmente.</li>
          <li>Anote o <strong>Phone Number ID</strong> e o <strong>WhatsApp Business Account ID (WABA ID)</strong> — você vai precisar deles para conectar aqui.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Crie um Usuário do Sistema (System User)",
    body: (
      <>
        <p className="mb-2">Tokens de usuário comum expiram em 60 dias. Para ter um token <strong>permanente</strong>, use um System User:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>No Business Manager, vá em <strong>Configurações do Negócio → Usuários → Usuários do Sistema</strong>.</li>
          <li>Clique em <strong>"Adicionar"</strong>, dê um nome (ex.: "Integração WhatsApp") e selecione função <strong>Admin</strong>.</li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Atribua ativos ao System User",
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>Selecione o System User criado e clique em <strong>"Adicionar Ativos"</strong>.</li>
          <li>Em <strong>Apps</strong>: adicione o App criado no passo 2 com <em>controle total</em>.</li>
          <li>Em <strong>Contas do WhatsApp</strong>: adicione seu WABA com <em>controle total</em>.</li>
        </ul>
      </>
    ),
  },
  {
    title: "6. Gere o Token Permanente",
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ainda no System User, clique em <strong>"Gerar Novo Token"</strong>.</li>
          <li>Selecione o App criado.</li>
          <li>Em <strong>Expiração</strong>, escolha <strong>"Nunca"</strong>.</li>
          <li>Marque as permissões: <code>whatsapp_business_messaging</code>, <code>whatsapp_business_management</code> e <code>business_management</code>.</li>
          <li>Clique em <strong>Gerar Token</strong> e <strong>copie e salve</strong> imediatamente — ele só aparece uma vez.</li>
        </ul>
      </>
    ),
  },
  {
    title: "7. Configure o Webhook (recebimento de mensagens)",
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>No painel do App em <strong>WhatsApp → Configuração</strong>, na seção <strong>Webhook</strong>, clique em <strong>Editar</strong>.</li>
          <li>A URL do callback e o token de verificação são gerados aqui na plataforma após criar a conexão (botão "Configurar Webhook" na conexão).</li>
          <li>Inscreva-se nos eventos: <code>messages</code>, <code>message_template_status_update</code> e <code>messaging_handovers</code>.</li>
        </ul>
      </>
    ),
  },
  {
    title: "8. Coloque o App em modo Live",
    body: (
      <>
        <p>No topo do painel do App, alterne de <strong>Desenvolvimento</strong> para <strong>Live (Em produção)</strong>. Sem isso, apenas números de teste recebem mensagens.</p>
      </>
    ),
  },
  {
    title: "9. Conecte aqui na plataforma",
    body: (
      <>
        <p className="mb-2">Volte para "Nova Conexão", escolha <strong>Meta API</strong> e informe:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Token Permanente</strong> (gerado no passo 6).</li>
          <li><strong>Phone Number ID</strong> (passo 3).</li>
          <li><strong>WABA ID</strong> (passo 3).</li>
        </ul>
        <p className="mt-2 text-muted-foreground">Pronto! Sua conexão Meta API está ativa e não vai expirar.</p>
      </>
    ),
  },
];

export function MetaApiHelpDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Como criar App Meta API
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Guia passo a passo — Meta WhatsApp Cloud API
          </DialogTitle>
          <DialogDescription>
            Siga o procedimento abaixo desde o zero para criar um App no Meta for Developers e gerar um <strong>token permanente</strong> para conectar aqui na plataforma.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] px-6">
          <div className="space-y-5 pb-6">
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <span>
                O token de System User só é "permanente" enquanto o System User existir e mantiver as permissões. Guarde o token em local seguro — ele só aparece uma vez ao ser gerado.
              </span>
            </div>

            {steps.map((step, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full h-6 w-6 p-0 flex items-center justify-center">
                    {idx + 1}
                  </Badge>
                  <h3 className="font-semibold">{step.title.replace(/^\d+\.\s*/, "")}</h3>
                </div>
                <div className="text-sm text-muted-foreground pl-8 leading-relaxed">
                  {step.body}
                </div>
                {idx < steps.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}

            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                Dica: deixe o App em <strong>modo Live</strong> e o negócio <strong>verificado</strong> no Business Manager para liberar limites maiores de envio.
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <a href="https://business.facebook.com" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Business Manager
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Meta for Developers
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Documentação Cloud API
                </a>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}