import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermosServico() {
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
            <CardTitle className="text-2xl">Termos de Serviço</CardTitle>
            <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground">
                Ao acessar ou usar nossa plataforma, você concorda com estes Termos de Serviço.
                Se não concordar com qualquer parte dos termos, você não deve usar o serviço.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
              <p className="text-muted-foreground">
                Nossa plataforma oferece ferramentas de gestão de comunicação via WhatsApp, CRM, 
                automação de atendimento, agentes de IA e integrações com serviços de terceiros 
                como Google Calendar e Meta Business API.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Cadastro e Conta</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Você é responsável por manter a confidencialidade da sua conta e senha</li>
                <li>As informações fornecidas no cadastro devem ser verdadeiras e atualizadas</li>
                <li>Você é responsável por todas as atividades realizadas em sua conta</li>
                <li>Notifique-nos imediatamente sobre qualquer uso não autorizado</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Uso Aceitável</h2>
              <p className="text-muted-foreground">Ao usar nosso serviço, você concorda em NÃO:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Enviar mensagens de spam ou conteúdo não solicitado</li>
                <li>Violar leis aplicáveis ou direitos de terceiros</li>
                <li>Compartilhar conteúdo ilegal, ofensivo ou prejudicial</li>
                <li>Tentar acessar sistemas ou dados de forma não autorizada</li>
                <li>Usar a plataforma para atividades fraudulentas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Integrações com Terceiros</h2>
              <p className="text-muted-foreground">
                Nossa plataforma integra-se com serviços de terceiros (WhatsApp Business API, 
                Meta, Google Calendar, etc.). O uso dessas integrações está sujeito aos termos 
                e políticas de cada provedor. Não nos responsabilizamos por alterações, 
                interrupções ou políticas desses serviços.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Propriedade Intelectual</h2>
              <p className="text-muted-foreground">
                Todo o conteúdo, código, design e funcionalidades da plataforma são de nossa 
                propriedade e protegidos por leis de propriedade intelectual. Os dados que você 
                cadastra e gerencia na plataforma permanecem de sua propriedade.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Pagamentos e Planos</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Os preços e funcionalidades de cada plano estão descritos na página de preços</li>
                <li>As cobranças são realizadas conforme o plano contratado</li>
                <li>Cancelamentos podem ser feitos a qualquer momento nas configurações</li>
                <li>Não há reembolso proporcional para cancelamentos antes do fim do período</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground">
                O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta 
                ou ausência de erros. Não nos responsabilizamos por danos indiretos, incidentais 
                ou consequenciais decorrentes do uso do serviço.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Suspensão e Encerramento</h2>
              <p className="text-muted-foreground">
                Reservamo-nos o direito de suspender ou encerrar sua conta em caso de violação 
                destes termos, uso abusivo ou inadimplência. Você pode encerrar sua conta a 
                qualquer momento seguindo as instruções de exclusão de dados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Alterações nos Termos</h2>
              <p className="text-muted-foreground">
                Podemos modificar estes termos a qualquer momento. Alterações significativas serão 
                comunicadas por e-mail ou notificação no aplicativo. O uso continuado do serviço 
                após as alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
              <p className="text-muted-foreground">
                Em caso de dúvidas sobre estes Termos de Serviço, entre em contato conosco 
                através do suporte no aplicativo.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
