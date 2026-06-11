export interface CopilotActionTemplate {
  name: string;
  icon: string;
  prompt: string;
}

export const COPILOT_ACTION_TEMPLATES: CopilotActionTemplate[] = [
  {
    name: 'Resumir conversa',
    icon: 'FileText',
    prompt: 'Resuma em até 5 bullets o que o cliente quer, o que já foi oferecido e o estado atual da negociação. Termine com "Próxima ação sugerida:".',
  },
  {
    name: 'Sugerir resposta',
    icon: 'MessageSquare',
    prompt: 'Escreva uma resposta pronta para enviar ao cliente agora, em português, cordial, objetiva, sem prometer prazos. Use o tom da conversa.',
  },
  {
    name: 'Próximo passo',
    icon: 'ArrowRight',
    prompt: 'Indique o próximo passo concreto que o vendedor deve dar para avançar essa negociação. Liste 1-3 opções priorizadas.',
  },
  {
    name: 'Tratar objeção',
    icon: 'Shield',
    prompt: 'Identifique a principal objeção do cliente e gere uma resposta persuasiva, baseada em valor, respeitosa, em português, pronta para envio.',
  },
  {
    name: 'Detectar interesse',
    icon: 'TrendingUp',
    prompt: 'Analise o nível de interesse do cliente (frio/morno/quente) e justifique em 2 frases. Sugira ação imediata.',
  },
  {
    name: 'Follow-up',
    icon: 'Bell',
    prompt: 'Gere uma mensagem de follow-up curta, simpática e que reabra a conversa sem ser invasiva.',
  },
];

export interface AutoReplyTemplate {
  name: string;
  description: string;
  message: string;
}

export const AUTOREPLY_TEMPLATES: AutoReplyTemplate[] = [
  {
    name: 'Em reunião',
    description: 'Secretária educada avisando que você está em reunião',
    message: 'Olá! Estou em reunião agora e retorno o quanto antes. Posso anotar o motivo do seu contato para já trazer uma resposta pronta?',
  },
  {
    name: 'Fora do expediente',
    description: 'Responde fora do horário comercial',
    message: 'Olá! Nosso atendimento é de segunda a sexta, das 9h às 18h. Já registrei sua mensagem e retornaremos no próximo horário comercial.',
  },
  {
    name: 'Em viagem',
    description: 'Aviso de viagem com retorno previsto',
    message: 'Oi! Estou viajando esta semana com acesso limitado. Retorno todas as mensagens assim que possível — obrigado pela paciência.',
  },
];