import type { Etapa, StatusLead, StatusProposta, TipoAtividade } from './tipos';

export const ETAPAS: { id: Etapa; nome: string; prazo: number | null }[] = [
  { id: 'qualificacao', nome: 'Qualificação', prazo: 5 },
  { id: 'diagnostico', nome: 'Diagnóstico', prazo: 10 },
  { id: 'demo', nome: 'Demo', prazo: 7 },
  { id: 'piloto', nome: 'Piloto', prazo: 45 },
  { id: 'proposta', nome: 'Proposta', prazo: 7 },
  { id: 'negociacao', nome: 'Negociação', prazo: 15 },
  { id: 'ganha', nome: 'Ganha', prazo: null },
  { id: 'perdida', nome: 'Perdida', prazo: null },
];
export const nomeEtapa = (e: Etapa) => ETAPAS.find((x) => x.id === e)?.nome ?? e;

export const STATUS_LEAD: Record<StatusLead, { nome: string; cor: string }> = {
  novo: { nome: 'Novo', cor: 'azul' },
  em_contato: { nome: 'Em contato', cor: 'amarelo' },
  qualificado: { nome: 'Qualificado', cor: 'verde' },
  nutricao: { nome: 'Nutrição', cor: '' },
  descartado: { nome: 'Descartado', cor: 'vermelho' },
};

export const STATUS_PROPOSTA: Record<StatusProposta, { nome: string; cor: string }> = {
  rascunho: { nome: 'Rascunho', cor: '' },
  aguardando_aprovacao: { nome: 'Aguardando aprovação', cor: 'amarelo' },
  aprovada: { nome: 'Aprovada', cor: 'azul' },
  enviada: { nome: 'Enviada', cor: 'azul' },
  aceita: { nome: 'Aceita', cor: 'verde' },
  recusada: { nome: 'Recusada', cor: 'vermelho' },
  expirada: { nome: 'Expirada', cor: '' },
};

export const MOTIVOS_PERDA: Record<string, string> = {
  preco: 'Preço', timing: 'Momento', concorrente: 'Concorrente', sem_decisor: 'Sem decisor',
  sem_orcamento: 'Sem orçamento', sem_resposta: 'Sem resposta', outro: 'Outro',
};

export const TIPOS_ATIVIDADE: Record<TipoAtividade, { nome: string; icone: string }> = {
  nota: { nome: 'Nota', icone: '✎' }, email: { nome: 'E-mail', icone: '✉' }, ligacao: { nome: 'Ligação', icone: '☎' },
  reuniao: { nome: 'Reunião', icone: '◷' }, whatsapp: { nome: 'WhatsApp', icone: '◉' }, tarefa: { nome: 'Tarefa', icone: '☐' },
  sistema: { nome: 'Sistema', icone: '•' },
};

export const PAPEIS_CONTATO: Record<string, string> = {
  decisor: 'Decisor', influenciador: 'Influenciador', usuario_painel: 'Usuário do painel', outro: 'Outro',
};

const ORIGENS: Record<string, string> = {
  site: 'Site', evento: 'Evento', indicacao: 'Indicação', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', prospeccao: 'Prospecção',
  parceiro: 'Parceiro', manual: 'Cadastro manual', outro: 'Outro',
};
export const nomeOrigem = (o: string | null | undefined) => (o ? ORIGENS[o] ?? o : '—');

export const brl = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (v: number | null | undefined) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
export const data = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
export const dataHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const cnpjFmt = (c: string | null) =>
  c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—';
export const zapLink = (n: string | null) => (n ? `https://wa.me/${n.startsWith('55') ? n : '55' + n}` : null);
export const linkProposta = (token: string) => `${location.origin}/p/${token}`;
export const primeiroNome = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] ?? '';

export function relativo(v: string | null | undefined): string {
  if (!v) return '—';
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export { horasUteis } from '../../shared/tempo';
