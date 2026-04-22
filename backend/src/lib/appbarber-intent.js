const PROFESSIONAL_KEYWORDS = [
  'barbeiro', 'barbeiros', 'profissional', 'profissionais', 'atendente', 'atendentes',
  'quem atende', 'quem trabalha', 'lista de barbeiros', 'lista de profissionais',
];

const AVAILABILITY_KEYWORDS = [
  'horário', 'horarios', 'disponibilidade', 'agenda', 'vaga', 'vagas', 'disponível', 'disponiveis',
];

const SERVICE_KEYWORDS = [
  'preço', 'precos', 'preço da', 'valor', 'quanto custa', 'quanto é', 'quanto sai',
  'serviço', 'serviços', 'corte', 'barba', 'bigode', 'sobrancelha', 'tintura', 'hidratação',
  'selagem', 'progressiva', 'pigmentação', 'luzes', 'escova', 'manicure', 'pedicure',
];

export function detectAppBarberRequiredTool(message) {
  const normalized = String(message || '').trim().toLowerCase();
  if (!normalized) return null;

  if (PROFESSIONAL_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return 'appbarber_professionals';
  }

  if (AVAILABILITY_KEYWORDS.some(keyword => normalized.includes(keyword)) && /\d{4}-\d{2}-\d{2}|hoje|amanhã|amanha|sexta|sábado|sabado|segunda|terça|terca|quarta|quinta|domingo/.test(normalized)) {
    return 'appbarber_availability';
  }

  if (SERVICE_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return 'appbarber_services';
  }

  return null;
}

export function inferAppBarberToolSource(toolName) {
  switch (toolName) {
    case 'appbarber_services':
      return 'tabela_local';
    case 'appbarber_professionals':
    case 'appbarber_availability':
    case 'appbarber_appointment':
    case 'appbarber_history':
      return 'api_appbarber';
    default:
      return 'desconhecida';
  }
}

export function isAppBarberToolResultFailure(result) {
  const text = String(result || '').trim().toLowerCase();
  if (!text) return true;

  return [
    'erro',
    'nenhum profissional encontrado',
    'nenhum serviço cadastrado',
    'nenhum serviço encontrado',
    'nenhum horário disponível',
    'nenhuma informação encontrada',
    'credenciais appbarber não configuradas',
    'erro na integração appbarber',
  ].some(pattern => text.includes(pattern));
}

export function buildAppBarberGuardrailResponse(requiredTool, toolResult) {
  const source = inferAppBarberToolSource(requiredTool);
  const readableSource = source === 'tabela_local' ? 'a tabela local sincronizada' : 'a API do AppBarber';

  if (toolResult && !isAppBarberToolResultFailure(toolResult)) {
    return null;
  }

  if (toolResult) {
    return `Não consegui confirmar essa informação em ${readableSource}. Resultado bruto da consulta: ${toolResult}`;
  }

  return `Não consegui confirmar essa informação porque a consulta obrigatória (${requiredTool}) não foi executada. Verifique no log se a IA chamou ${readableSource} antes de responder.`;
}

export function getAppBarberToolResultStatus(result) {
  const text = String(result || '').trim();
  if (!text) return 'not_executed';

  const normalized = text.toLowerCase();

  if (
    normalized.includes('erro') ||
    normalized.includes('credenciais appbarber não configuradas') ||
    normalized.includes('erro na integração appbarber')
  ) {
    return 'error';
  }

  if (
    normalized.includes('nenhum profissional encontrado') ||
    normalized.includes('nenhum serviço cadastrado') ||
    normalized.includes('nenhum serviço encontrado') ||
    normalized.includes('nenhum horário disponível') ||
    normalized.includes('nenhuma informação encontrada')
  ) {
    return 'empty';
  }

  return 'ok';
}