// POST /api/emails/enviar — o time envia um e-mail a um lead ou contato; fica registrado na linha do tempo.
// Com responde_a (id de um e-mail recebido), sai na mesma conversa, com o histórico citado, e fecha a tarefa "responder".
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, emailValido, enviarEmail, env, exigirTime, responderPara, texto, textoParaHtml } from '../_lib.js';
import { cabecalhosResposta, citar } from '../../shared/emailRecebido.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const quem = await exigirTime(req, res);
  if (!quem) return;
  const b = (req.body ?? {}) as Record<string, unknown>;
  // um ou vários destinatários (até 10), de dentro ou de fora do CRM
  const lista = [...new Set(String(texto(b.para, 1600) ?? '').toLowerCase().split(/[\s,;]+/).filter(Boolean))];
  const assunto = texto(b.assunto, 200);
  const corpo = texto(b.corpo, 20000);
  if (!lista.length || lista.length > 10 || !lista.every((e) => emailValido(e)) || !assunto || !corpo) return res.status(400).json({ erro: 'Preencha destinatário(s), assunto e mensagem (até 10 e-mails válidos)' });
  const para = lista.join(', ');
  const db = admin();

  // respeita descadastro de cada destinatário
  let contato: { id: string; descadastrado_em: string | null } | null = null;
  for (const e of lista) {
    const { data: c } = await db.from('contatos').select('id, descadastrado_em').ilike('email', e).maybeSingle();
    if (c?.descadastrado_em) return res.status(409).json({ erro: `${e} pediu para não receber e-mails` });
    if (!contato && c) contato = c;
  }
  const leadId = texto(b.lead_id, 40);
  if (leadId) {
    const { data: saiu } = await db.from('eventos').select('id').eq('nome', 'descadastro').eq('lead_id', leadId).limit(1);
    if (saiu?.length) return res.status(409).json({ erro: 'Este lead pediu para não receber e-mails' });
  }

  // resposta a um e-mail recebido: mesma conversa e mesmo vínculo (lead, conta, card)
  const respondeA = texto(b.responde_a, 40);
  let original: Record<string, string | null> | null = null;
  if (respondeA) {
    const { data: o } = await db.from('emails_recebidos')
      .select('id, de, de_nome, resposta, message_id, referencias, recebido_em, tarefa_id, lead_id, contato_id, conta_id, oportunidade_id, card_id')
      .eq('id', respondeA).maybeSingle();
    if (!o) return res.status(404).json({ erro: 'E-mail recebido não encontrado' });
    original = o;
  }
  const cardId = texto(b.card_id, 40) ?? original?.card_id ?? null;
  const ref = {
    lead_id: leadId ?? original?.lead_id ?? null, contato_id: texto(b.contato_id, 40) ?? contato?.id ?? original?.contato_id ?? null,
    conta_id: texto(b.conta_id, 40) ?? original?.conta_id ?? null, oportunidade_id: texto(b.oportunidade_id, 40) ?? original?.oportunidade_id ?? null,
  };
  const base = { para, assunto, corpo, modelo_id: texto(b.modelo_id, 40), autor: quem.perfil.id, ...ref };
  let { data: reg, error } = await db.from('emails').insert({ ...base, card_id: cardId, responde_a: original?.id ?? null }).select('id').single();
  // banco ainda sem a migração 0008: envia do jeito antigo
  if (error && ['PGRST204', '42703'].includes(String(error.code))) ({ data: reg, error } = await db.from('emails').insert(base).select('id').single());
  if (!reg) return res.status(500).json({ erro: error?.message ?? 'Falha ao registrar o e-mail' });

  const dominio = env('EMAIL_DOMINIO', false) || 'applumi.io';
  const de = `${quem.perfil.nome} · Lumi <comercial@${dominio}>`;
  try {
    const citacao = original ? citar(original.resposta ?? '', original.de_nome || original.de || '', new Date(original.recebido_em ?? Date.now())) : '';
    const textoFinal = citacao ? `${corpo}\n\n${citacao}` : corpo;
    const html = citacao
      ? textoParaHtml(corpo).replace(/<\/div>$/, `<blockquote style="margin:16px 0 0;padding-left:12px;border-left:3px solid #d0d7e2;color:#5b6674">${textoParaHtml(citacao).replace(/^<div[^>]*>|<\/div>$/g, '')}</blockquote></div>`)
      : textoParaHtml(corpo);
    const id = await enviarEmail({
      para: lista, assunto, texto: textoFinal, html, responderPara: responderPara(quem.perfil.email), de,
      cabecalhos: original ? cabecalhosResposta(original.message_id, original.referencias) : undefined,
    });
    const agora = new Date().toISOString();
    await db.from('emails').update({ status: 'enviado', resend_id: id, enviado_em: agora }).eq('id', reg.id);
    await db.from('atividades').insert({ tipo: 'email', titulo: `${original ? 'Resposta enviada' : 'E-mail enviado'}: ${assunto}`, descricao: corpo, autor: quem.perfil.id, ...ref, ...(cardId ? { card_id: cardId } : {}) });
    if (original) {
      await db.from('emails_recebidos').update({ respondido_em: agora }).eq('id', original.id).is('respondido_em', null);
      if (original.tarefa_id) await db.from('atividades').update({ concluida_em: agora }).eq('id', original.tarefa_id).is('concluida_em', null);
    }
    if (ref.lead_id) await db.from('leads').update({ status: 'em_contato', primeiro_contato_em: new Date().toISOString() })
      .eq('id', ref.lead_id).is('primeiro_contato_em', null);
    return res.status(200).json({ ok: true, id: reg.id });
  } catch (e) {
    await db.from('emails').update({ status: 'falhou', erro: (e as Error).message.slice(0, 300) }).eq('id', reg.id);
    return res.status(502).json({ erro: 'O envio falhou. Tente de novo em instantes.' });
  }
}
