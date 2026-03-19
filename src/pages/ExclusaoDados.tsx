import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ExclusaoDados() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Instrução de Exclusão de Dados</CardTitle>
            <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Seu Direito à Exclusão</h2>
              <p className="text-muted-foreground">
                Em conformidade com a Lei Geral de Proteção de Dados (LGPD) e as políticas da 
                Meta Platform, você tem o direito de solicitar a exclusão completa dos seus dados 
                pessoais armazenados em nossa plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Quais Dados São Excluídos</h2>
              <p className="text-muted-foreground">Ao solicitar a exclusão, os seguintes dados serão removidos:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Dados de perfil (nome, e-mail, telefone)</li>
                <li>Histórico de conversas e mensagens</li>
                <li>Contatos cadastrados</li>
                <li>Configurações de chatbots e automações</li>
                <li>Dados de CRM (negociações, empresas, tarefas)</li>
                <li>Integrações e tokens de acesso (WhatsApp, Google Calendar, Meta)</li>
                <li>Arquivos e mídias enviados</li>
                <li>Logs de atividade da conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Como Solicitar a Exclusão</h2>
              <p className="text-muted-foreground">Você pode solicitar a exclusão dos seus dados de duas formas:</p>
              
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <h3 className="font-semibold text-foreground mb-2">Opção A – Pelo Aplicativo</h3>
                  <ol className="list-decimal pl-6 text-muted-foreground space-y-1">
                    <li>Acesse <strong>Configurações</strong> no menu lateral</li>
                    <li>Role até a seção <strong>Segurança</strong></li>
                    <li>Clique em <strong>"Solicitar exclusão da conta"</strong></li>
                    <li>Confirme sua identidade inserindo sua senha</li>
                    <li>Confirme a solicitação</li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <h3 className="font-semibold text-foreground mb-2">Opção B – Por E-mail</h3>
                  <p className="text-muted-foreground">
                    Envie um e-mail para o suporte com o assunto <strong>"Solicitação de Exclusão de Dados"</strong> 
                    contendo:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
                    <li>Nome completo</li>
                    <li>E-mail cadastrado na plataforma</li>
                    <li>Motivo da solicitação (opcional)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Prazo de Processamento</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Sua solicitação será processada em até <strong>15 dias úteis</strong></li>
                <li>Você receberá uma confirmação por e-mail quando a exclusão for concluída</li>
                <li>Durante o processamento, sua conta ficará inativa</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Dados Retidos por Obrigação Legal</h2>
              <p className="text-muted-foreground">
                Alguns dados podem ser retidos por período determinado para cumprimento de 
                obrigações legais, como:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Registros fiscais e de faturamento (5 anos)</li>
                <li>Logs de acesso conforme Marco Civil da Internet (6 meses)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Esses dados são mantidos de forma anonimizada e não são utilizados para 
                fins comerciais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Exclusão de Dados via Facebook/Meta</h2>
              <p className="text-muted-foreground">
                Se você autorizou nosso aplicativo através do Facebook Login ou Meta Business, 
                você também pode solicitar a exclusão dos seus dados:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Acesse as <strong>Configurações do Facebook</strong> → <strong>Aplicativos e Sites</strong></li>
                <li>Encontre nosso aplicativo na lista</li>
                <li>Clique em <strong>"Remover"</strong> e selecione <strong>"Excluir dados"</strong></li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Essa ação será sincronizada com nossa plataforma e seus dados serão removidos 
                automaticamente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Consequências da Exclusão</h2>
              <p className="text-muted-foreground">Ao excluir seus dados:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Sua conta será permanentemente desativada</li>
                <li>Todas as automações e chatbots serão desligados</li>
                <li>Integrações com WhatsApp e outros serviços serão desconectadas</li>
                <li>Os dados <strong>não poderão ser recuperados</strong> após a exclusão</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Contato</h2>
              <p className="text-muted-foreground">
                Em caso de dúvidas sobre o processo de exclusão de dados, entre em contato 
                conosco através do suporte no aplicativo.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
