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
import { Instagram, MessageCircle, ExternalLink, AlertTriangle, KeyRound } from "lucide-react";

interface Step {
  title: string;
  body: React.ReactNode;
}

const steps: Step[] = [
  {
    title: "1. Pré-requisitos",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Conta no <a className="text-primary underline" href="https://business.facebook.com" target="_blank" rel="noreferrer">Meta Business Manager</a> (recomendado verificada).</li>
        <li>Uma <strong>Página do Facebook</strong> (necessária tanto para Messenger quanto para Instagram).</li>
        <li>Para Instagram Direct: conta do Instagram do tipo <strong>Profissional / Business</strong>, vinculada à Página do Facebook.</li>
        <li>Permitir o acesso a mensagens nas Configurações do Instagram: <em>Configurações → Privacidade → Mensagens → Permitir acesso a mensagens</em>.</li>
      </ul>
    ),
  },
  {
    title: "2. Crie um App no Meta for Developers",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Acesse <a className="text-primary underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> e clique em <strong>"Criar App"</strong>.</li>
        <li>Tipo: <strong>Negócios (Business)</strong>.</li>
        <li>Vincule o app à sua conta do Business Manager.</li>
        <li>Pode ser o <strong>mesmo App</strong> que você já usa para a WhatsApp Cloud API.</li>
      </ul>
    ),
  },
  {
    title: "3. Adicione os produtos Messenger e Instagram",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>No painel do App, em <strong>"Adicionar produto"</strong>, configure:</li>
        <li>👉 <strong>Messenger</strong> — para mensagens de Páginas do Facebook.</li>
        <li>👉 <strong>Instagram</strong> (Instagram Graph API / Instagram Messaging) — para Direct.</li>
      </ul>
    ),
  },
  {
    title: "4. Vincule a Página e a conta Instagram",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Em <strong>Messenger → Configurações</strong>, na seção <em>"Tokens de acesso"</em>, adicione/selecione a <strong>Página do Facebook</strong> que receberá mensagens.</li>
        <li>Em <strong>Instagram → Configurações da API com login do Instagram</strong>, conecte a conta do Instagram Business vinculada à mesma Página.</li>
        <li>Importante: a conta Instagram precisa estar vinculada à Página em <em>Página do Facebook → Configurações → Contas vinculadas → Instagram</em>.</li>
      </ul>
    ),
  },
  {
    title: "5. Permissões necessárias",
    body: (
      <>
        <p className="mb-2">Solicite (e aprove em <em>App Review</em>, quando exigido) as seguintes permissões:</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Messenger</p>
            <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">
              <li>pages_messaging</li>
              <li>pages_manage_metadata</li>
              <li>pages_read_engagement</li>
              <li>pages_show_list</li>
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-semibold flex items-center gap-2"><Instagram className="h-4 w-4" /> Instagram</p>
            <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">
              <li>instagram_basic</li>
              <li>instagram_manage_messages</li>
              <li>pages_manage_metadata</li>
              <li>pages_show_list</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    title: "6. Crie um System User e gere Token Permanente",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>No Business Manager → <strong>Configurações do Negócio → Usuários → Usuários do Sistema</strong>, crie um System User do tipo <strong>Admin</strong>.</li>
        <li>Atribua a este System User a sua <strong>Página do Facebook</strong> e o <strong>App</strong> (com controle total).</li>
        <li>Clique em <strong>"Gerar novo token"</strong>, selecione o App e marque as permissões da etapa 5.</li>
        <li>Em <em>Expiração</em>, escolha <strong>"Nunca"</strong> — esse é o token que não expira.</li>
        <li>Guarde o token: ele é o <strong>Page/Instagram Access Token</strong> usado pela plataforma.</li>
      </ul>
    ),
  },
  {
    title: "7. Configure o Webhook",
    body: (
      <>
        <ul className="list-disc pl-5 space-y-1">
          <li>Em <strong>Messenger → Webhooks</strong>: assine os eventos <code>messages</code>, <code>messaging_postbacks</code>, <code>message_reactions</code> na sua Página.</li>
          <li>Em <strong>Instagram → Webhooks</strong>: assine <code>messages</code> e <code>messaging_postbacks</code>.</li>
          <li>Use a <strong>URL de Callback</strong> e o <strong>Verify Token</strong> que serão fornecidos pela plataforma ao criar a conexão (etapa 9).</li>
        </ul>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
          <span>O mesmo App pode ter um único webhook por produto. Se já usa WhatsApp Cloud API no mesmo App, é normal — apenas adicione as assinaturas de Messenger e Instagram além das de WhatsApp.</span>
        </div>
      </>
    ),
  },
  {
    title: "8. Coloque o App em modo Live e faça App Review",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>No topo do painel do App, troque de <strong>Development</strong> para <strong>Live</strong>.</li>
        <li>Envie para <strong>App Review</strong> as permissões avançadas (<code>pages_messaging</code>, <code>instagram_manage_messages</code> etc.). Sem aprovação, só admins/testadores do App podem mandar mensagem.</li>
        <li>Para o review, a Meta pede um vídeo curto demonstrando o fluxo de uso e uma descrição clara.</li>
      </ul>
    ),
  },
  {
    title: "9. Conecte na plataforma (em breve)",
    body: (
      <>
        <p>Em <strong>Conexões → Nova conexão</strong>, escolha <strong>Instagram Direct</strong> ou <strong>Facebook Messenger</strong> e informe:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Page ID</strong> (Facebook) e/ou <strong>Instagram Business Account ID</strong>.</li>
          <li><strong>Page Access Token permanente</strong> gerado na etapa 6.</li>
          <li><strong>App Secret</strong> (para validar assinatura do webhook).</li>
        </ul>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm">
          <KeyRound className="h-4 w-4 text-primary mt-0.5" />
          <span>Atenção à <strong>janela de 24h</strong>: você só pode responder livremente até 24h após a última mensagem do usuário. Fora dessa janela é preciso usar Message Tags (Messenger) ou tópicos aprovados (Instagram).</span>
        </div>
      </>
    ),
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
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-primary" />
            Guia: Instagram Direct & Facebook Messenger
            <Badge variant="secondary" className="ml-2">Em breve no app</Badge>
          </DialogTitle>
          <DialogDescription>
            Siga o passo a passo abaixo para criar seu próprio App Meta, preparar sua Página do Facebook e/ou conta Instagram Business e habilitar o recebimento e envio de mensagens.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
              <KeyRound className="h-4 w-4 text-primary mt-0.5" />
              <span>
                Você precisará criar seu próprio App no Meta for Developers e conectar sua Página do Facebook / Instagram Business. Cada empresa utiliza seus próprios dados, sem compartilhar contas com terceiros.
              </span>
            </div>

            {steps.map((s, i) => (
              <div key={i} className="space-y-2">
                <h3 className="font-semibold text-base">{s.title}</h3>
                <div className="text-sm text-muted-foreground leading-relaxed">{s.body}</div>
                {i < steps.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
              <ExternalLink className="h-4 w-4 text-primary mt-0.5" />
              <div>
                Docs oficiais:{" "}
                <a className="text-primary underline" href="https://developers.facebook.com/docs/messenger-platform" target="_blank" rel="noreferrer">Messenger Platform</a>
                {" · "}
                <a className="text-primary underline" href="https://developers.facebook.com/docs/messenger-platform/instagram" target="_blank" rel="noreferrer">Instagram Messaging API</a>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
