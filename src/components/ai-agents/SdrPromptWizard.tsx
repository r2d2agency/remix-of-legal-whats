import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Sparkles, ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface Answers {
  agentName: string;
  companyName: string;
  segment: string;
  product: string;
  goal: string;
  qualifyQuestions: string;
  pains: string;
  benefits: string;
  tone: string;
  rules: string;
  extraInfo: string;
}

const EMPTY: Answers = {
  agentName: '', companyName: '', segment: '', product: '',
  goal: '', qualifyQuestions: '', pains: '', benefits: '',
  tone: 'cordial, direto, sem emojis exagerados',
  rules: '', extraInfo: '',
};

function buildPrompt(a: Answers): string {
  const lines: string[] = [];
  const persona = `Você é ${a.agentName || 'o(a) assistente'}, SDR da empresa ${a.companyName || '[empresa]'}${
    a.segment ? ` (${a.segment})` : ''
  }.`;
  lines.push(persona);
  if (a.product) lines.push(`\nProduto/serviço: ${a.product}`);
  if (a.goal) lines.push(`\nObjetivo: ${a.goal}`);

  const qs = a.qualifyQuestions
    .split('\n').map((s) => s.trim()).filter(Boolean);
  if (qs.length) {
    lines.push('\nFaça nesta ordem:');
    lines.push('1) Cumprimente pelo nome ({name}) e agradeça o contato.');
    qs.forEach((q, i) => lines.push(`${i + 2}) Pergunte: ${q}`));
    if (a.pains) lines.push(`${qs.length + 2}) Identifique a dor principal entre: ${a.pains}.`);
    if (a.benefits) lines.push(`${qs.length + 3}) Apresente um benefício específico relacionado à dor citada: ${a.benefits}.`);
    lines.push(`${qs.length + 4}) Ofereça 2 horários para reunião nos próximos 2 dias úteis.`);
  }

  lines.push('\nRegras:');
  if (a.tone) lines.push(`- Tom: ${a.tone}.`);
  lines.push('- Mensagens curtas (máx. 3 linhas).');
  lines.push('- Use português brasileiro.');
  lines.push('- Nunca invente preço; se perguntarem, diga que o vendedor traz proposta personalizada.');
  lines.push('- Se o lead pedir humano ou estiver irritado, peça desculpas e diga que vai transferir.');
  if (a.rules) {
    a.rules.split('\n').map((s) => s.trim()).filter(Boolean).forEach((r) => {
      lines.push(`- ${r}`);
    });
  }

  if (a.extraInfo) {
    lines.push('\nInformações da empresa:');
    a.extraInfo.split('\n').map((s) => s.trim()).filter(Boolean).forEach((r) => {
      lines.push(`- ${r}`);
    });
  }

  lines.push('\nVariáveis disponíveis: {name} (nome do contato), {agent_name} (seu nome).');
  return lines.join('\n');
}

interface StepDef {
  title: string;
  description: string;
  render: (a: Answers, set: (p: Partial<Answers>) => void) => React.ReactNode;
}

const STEPS: StepDef[] = [
  {
    title: 'Identidade do SDR',
    description: 'Quem é o assistente e onde ele trabalha.',
    render: (a, set) => (
      <div className="space-y-3">
        <div>
          <Label>Nome do SDR</Label>
          <Input value={a.agentName} onChange={(e) => set({ agentName: e.target.value })} placeholder="Ex: Ana" />
        </div>
        <div>
          <Label>Nome da empresa</Label>
          <Input value={a.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Ex: XPTO" />
        </div>
        <div>
          <Label>Segmento / mercado</Label>
          <Input value={a.segment} onChange={(e) => set({ segment: e.target.value })} placeholder="Ex: software de gestão para clínicas" />
        </div>
      </div>
    ),
  },
  {
    title: 'Produto e objetivo',
    description: 'O que vocês vendem e o que o SDR precisa alcançar.',
    render: (a, set) => (
      <div className="space-y-3">
        <div>
          <Label>Produto / serviço</Label>
          <Textarea rows={3} value={a.product} onChange={(e) => set({ product: e.target.value })}
            placeholder="Descreva brevemente o que a empresa vende." />
        </div>
        <div>
          <Label>Objetivo do SDR</Label>
          <Textarea rows={2} value={a.goal} onChange={(e) => set({ goal: e.target.value })}
            placeholder="Ex: qualificar o lead e agendar reunião de 20 min com um vendedor." />
        </div>
      </div>
    ),
  },
  {
    title: 'Qualificação do lead',
    description: 'Perguntas que o SDR deve fazer, uma por linha.',
    render: (a, set) => (
      <div className="space-y-3">
        <div>
          <Label>Perguntas de qualificação (uma por linha)</Label>
          <Textarea rows={5} value={a.qualifyQuestions} onChange={(e) => set({ qualifyQuestions: e.target.value })}
            placeholder={'nome da clínica\nnúmero de profissionais\nqual sistema usa hoje'} />
        </div>
        <div>
          <Label>Principais dores que vocês resolvem</Label>
          <Input value={a.pains} onChange={(e) => set({ pains: e.target.value })}
            placeholder="Ex: agenda, prontuário, financeiro" />
        </div>
        <div>
          <Label>Benefícios / diferenciais para citar</Label>
          <Textarea rows={2} value={a.benefits} onChange={(e) => set({ benefits: e.target.value })}
            placeholder="Ex: agenda integrada com WhatsApp, prontuário em nuvem, suporte 24/7" />
        </div>
      </div>
    ),
  },
  {
    title: 'Tom e regras',
    description: 'Como o SDR deve se comportar.',
    render: (a, set) => (
      <div className="space-y-3">
        <div>
          <Label>Tom de voz</Label>
          <Input value={a.tone} onChange={(e) => set({ tone: e.target.value })}
            placeholder="Ex: cordial, direto, sem emojis exagerados" />
        </div>
        <div>
          <Label>Regras adicionais (uma por linha, opcional)</Label>
          <Textarea rows={4} value={a.rules} onChange={(e) => set({ rules: e.target.value })}
            placeholder={'Não prometa prazos sem confirmar com humano\nSempre confirme o e-mail antes de agendar'} />
        </div>
        <div>
          <Label>Informações extras da empresa (opcional, uma por linha)</Label>
          <Textarea rows={3} value={a.extraInfo} onChange={(e) => set({ extraInfo: e.target.value })}
            placeholder={'Site: https://...\nHorário: Seg-Sex 9h-18h\nCasos de sucesso: ...'} />
        </div>
      </div>
    ),
  },
];

export function SdrPromptWizard({
  open, onOpenChange, onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (prompt: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [preview, setPreview] = useState<string | null>(null);

  const set = (p: Partial<Answers>) => setAnswers((s) => ({ ...s, ...p }));
  const total = STEPS.length;
  const isLast = step === total - 1;

  const handleNext = () => {
    if (isLast) setPreview(buildPrompt(answers));
    else setStep((s) => Math.min(total - 1, s + 1));
  };

  const handleApply = () => {
    onApply(preview ?? buildPrompt(answers));
    onOpenChange(false);
    setTimeout(() => { setStep(0); setAnswers(EMPTY); setPreview(null); }, 200);
  };

  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente de prompt do SDR
          </DialogTitle>
          <DialogDescription>
            Responda algumas perguntas e geramos um prompt completo para você editar depois.
          </DialogDescription>
        </DialogHeader>

        {preview === null ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Etapa {step + 1} de {total} — {current.title}</span>
            </div>
            <Progress value={((step + 1) / total) * 100} className="h-1.5" />
            <p className="text-sm text-muted-foreground">{current.description}</p>
            <div className="pt-2">{current.render(answers, set)}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Prévia do prompt gerado</Label>
            <Textarea
              rows={16}
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Você pode ajustar aqui ou aplicar e continuar editando no editor principal.
            </p>
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {preview === null && step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
            )}
            {preview !== null && (
              <Button variant="outline" onClick={() => setPreview(null)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Editar respostas
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {preview === null ? (
              <Button onClick={handleNext}>
                {isLast ? <>Gerar prompt <Sparkles className="h-3.5 w-3.5 ml-1" /></> : <>Próximo <ArrowRight className="h-3.5 w-3.5 ml-1" /></>}
              </Button>
            ) : (
              <Button onClick={handleApply}>
                <Check className="h-3.5 w-3.5 mr-1" /> Aplicar no editor
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}