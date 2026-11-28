// E-mails recebidos (respostas) na tela: o tipo e como abrir o "Responder".
import { assuntoResposta } from '../../shared/emailRecebido';
import type { DestinoEmail } from '../components/EnviarEmail';

export interface Recebido {
  id: string; de: string; de_nome: string | null; assunto: string | null; resposta: string | null; texto?: string | null;
  anexos: { nome: string }[]; automatico: boolean; em_resposta_a: string | null; responsavel: string | null; tarefa_id: string | null;
  lead_id: string | null; contato_id: string | null; conta_id: string | null; oportunidade_id: string | null; card_id: string | null;
  respondido_em: string | null; arquivado_em: string | null; recebido_em: string;
}

export const CAMPOS_RECEBIDO = 'id, de, de_nome, assunto, resposta, anexos, automatico, em_resposta_a, responsavel, tarefa_id, lead_id, contato_id, conta_id, oportunidade_id, card_id, respondido_em, arquivado_em, recebido_em';

export const destinoResposta = (r: Recebido): DestinoEmail => ({
  para: r.de, nome: r.de_nome || r.de, responde_a: r.id,
  lead_id: r.lead_id ?? undefined, contato_id: r.contato_id ?? undefined, conta_id: r.conta_id ?? undefined,
  oportunidade_id: r.oportunidade_id ?? undefined, card_id: r.card_id ?? undefined,
  inicial: { assunto: assuntoResposta(r.assunto), corpo: '' },
});

export const linkRecebido = (r: Recebido) => r.card_id ? `/cards/${r.card_id}` : r.oportunidade_id ? `/oportunidades/${r.oportunidade_id}`
  : r.lead_id ? `/leads/${r.lead_id}` : r.conta_id ? `/contas/${r.conta_id}` : null;

export function situacao(r: Recebido): { nome: string; cor: string } {
  if (r.respondido_em) return { nome: 'Respondido', cor: 'verde' };
  if (r.arquivado_em) return { nome: 'Arquivado', cor: '' };
  if (r.automatico) return { nome: 'Automática', cor: '' };
  if (!r.tarefa_id) return { nome: 'Sem vínculo', cor: 'amarelo' };
  return { nome: 'Aguardando resposta', cor: 'vermelho' };
}
