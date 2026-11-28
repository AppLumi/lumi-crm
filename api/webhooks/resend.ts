// POST /api/webhooks/resend — status de entrega, abertura e clique, e respostas recebidas (assinatura Svix verificada)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, corpoCru, enviarEmail, env, lerResend, textoParaHtml } from '../_lib.js';
import { cabecalho, ehAutomatico, enderecoDe, extrairResposta, htmlParaTexto, idsDaConversa, localDoEmail, nomeDe, prazoResponder } from '../../shared/emailRecebido.js';

export const config = { api: { bodyParser: false } };

function assinaturaValida(segredo: string, id: string, ts: string, corpo: string, cabecalho: string): boolean {
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64');
  const esperado = createHmac('sha256', chave).update(`${id}.${ts}.${corpo}`).digest();
  return cabecalho.split(' ').some((p) => {
    const [, sig] = p.split(',');
    if (!sig) return false;
    const b = Buffer.from(sig, 'base64');
    return b.length === esperado.length && timingSafeEqual(b, esperado);
  });
}

const MAPA: Record<string, { status: string; campo?: string }> = {
  'email.delivered': { status: 'entregue', campo: 'entregue_em' },
  'email.opened': { status: 'aberto', campo: 'aberto_em' },
  'email.clicked': { status: 'clicado', campo: 'clicado_em' },
  'email.bounced': { status: 'devolvido' },
  'email.complained': { status: 'reclamacao' },
};
const ORDEM = ['enviando', 'enviado', 'entregue', 'aberto', 'clicado'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const segredo = env('RESEND_WEBHOOK_SECRET', false);
  if (!segredo) return res.status(503).json({ erro: 'RESEND_WEBHOOK_SECRET não configurado' });
  const corpo = await corpoCru(req);
  const ok = assinaturaValida(segredo, String(req.headers['svix-id'] ?? ''),
    String(req.headers['svix-timestamp'] ?? ''), corpo, String(req.headers['svix-signature'] ?? ''));
  if (!ok) return res.status(401).json({ erro: 'assinatura inválida' });
  const ev = JSON.parse(corpo) as { type: string; created_at: string; data: { email_id: string; message_id?: string } & Record<string, unknown> };
  const db = admin();
  if (ev.type === 'email.received') {
    try { return res.status(200).json(await receber(db, ev.data)); } catch (e) {
      console.error('resposta recebida:', (e as Error).message);
      return res.status(500).json({ erro: 'falha ao registrar a resposta' }); // o Resend tenta de novo
    }
  }
  const m = MAPA[ev.type];
  const { data: email } = await db.from('emails').select('*').eq('resend_id', ev.data.email_id).maybeSingle();
  if (!email) return res.status(200).json({ ok: true });
  // guarda o Message-ID do enviado: é por ele que a resposta encontra a conversa
  if (ev.data.message_id && !email.message_id && 'message_id' in email) {
    await db.from('emails').update({ message_id: String(ev.data.message_id).slice(0, 300) }).eq('id', email.id);
  }
  if (!m) return res.status(200).json({ ignorado: ev.type });
  const upd: Record<string, unknown> = {};
  if (m.campo && !email[m.campo]) upd[m.campo] = ev.created_at;
  // status só avança (aberto não volta a "entregue"); devolução e reclamação sempre valem
  if (!ORDEM.includes(m.status) || ORDEM.indexOf(m.status) > ORDEM.indexOf(email.status)) upd.status = m.status;
  if (Object.keys(upd).length) await db.from('emails').update(upd).eq('id', email.id);
  // sinais de interesse para a nota do lead
  if ((ev.type === 'email.opened' || ev.type === 'email.clicked') && email.lead_id && m.campo && !email[m.campo]) {
    await db.from('eventos').insert({ nome: ev.type === 'email.opened' ? 'email_aberto' : 'email_clique', origem: 'email', lead_id: email.lead_id, conta_id: email.conta_id });
  }
  if (ev.type === 'email.complained' && email.lead_id) {
    await db.from('eventos').insert({ nome: 'descadastro', origem: 'email', lead_id: email.lead_id, propriedades: { motivo: 'marcou_spam' } });
    await db.from('leads').update({ aceita_marketing: false }).eq('id', email.lead_id);
  }
  if (ev.type === 'email.complained' && email.contato_id) {
    await db.from('contatos').update({ descadastrado_em: new Date().toISOString(), aceita_marketing: false }).eq('id', email.contato_id);
  }
  return res.status(200).json({ ok: true });
}

interface Recebido {
  from?: string; to?: string[]; subject?: string; text?: string | null; html?: string | null; message_id?: string;
  headers?: Record<string, unknown>; created_at?: string; received_for?: string[]; authentication?: Record<string, unknown>;
  attachments?: { id: string; filename: string; content_type: string; size?: number }[];
}

/** Uma resposta chegou: guarda, liga ao lead/conta/card, põe na linha do tempo, cria a tarefa e avisa quem enviou. */
export async function receber(db: SupabaseClient, dados: Record<string, unknown>) {
  const resendId = String(dados.email_id ?? '');
  if (!resendId) return { ignorado: 'sem id' };
  const { data: ja } = await db.from('emails_recebidos').select('id').eq('resend_id', resendId).maybeSingle();
  if (ja) return { ok: true, repetido: true };

  // o webhook traz só o envelope; o conteúdo vem da API
  const r = (await lerResend<Recebido>(`/emails/receiving/${encodeURIComponent(resendId)}`)) ?? (dados as Recebido);
  const de = enderecoDe(String(r.from ?? dados.from ?? ''));
  const deNome = nomeDe(cabecalho(r.headers, 'from')) ?? null;
  const assunto = String(r.subject ?? dados.subject ?? '').slice(0, 300);
  const texto = (r.text?.trim() ? r.text : htmlParaTexto(r.html ?? '')).slice(0, 50000);
  const resposta = extrairResposta(texto).slice(0, 8000);
  const para = [...(r.to ?? []), ...((dados.received_for as string[]) ?? r.received_for ?? [])].map(enderecoDe);
  const conversa = idsDaConversa(cabecalho(r.headers, 'in-reply-to'), cabecalho(r.headers, 'references'));
  const dominioRespostas = env('EMAIL_RESPOSTAS_DOMINIO', false).toLowerCase();

  // quem é a pessoa do time dona do endereço (bruna@respostas... → perfil da Bruna)
  const { data: time } = await db.from('perfis').select('id, nome, email, ativo');
  const perfis = (time ?? []) as { id: string; nome: string; email: string; ativo: boolean }[];
  const doEndereco = perfis.find((p) => p.ativo && para.some((a) => a.endsWith(`@${dominioRespostas}`) && localDoEmail(a) === localDoEmail(p.email)));
  // e-mail do próprio time (ou do nosso domínio) não é resposta de cliente: evita laço
  const doTime = perfis.some((p) => p.email.toLowerCase() === de) || (dominioRespostas && de.endsWith(`@${dominioRespostas}`));

  // a qual e-mail enviado responde: pela conversa (Message-ID) e, se não der, pelo último enviado a esse endereço
  type Enviado = { id: string; autor: string | null; lead_id: string | null; contato_id: string | null; conta_id: string | null; oportunidade_id: string | null; card_id?: string | null };
  let enviado: Enviado | null = null;
  if (conversa.length) {
    const { data } = await db.from('emails').select('id, autor, lead_id, contato_id, conta_id, oportunidade_id, card_id, criado_em')
      .in('message_id', conversa).order('criado_em', { ascending: false }).limit(1);
    enviado = (data?.[0] as Enviado) ?? null;
  }
  if (!enviado && de) {
    const desde = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data } = await db.from('emails').select('id, autor, lead_id, contato_id, conta_id, oportunidade_id, card_id, criado_em, para')
      .ilike('para', `%${de.replace(/[%_]/g, '')}%`).gte('criado_em', desde).not('enviado_em', 'is', null)
      .order('criado_em', { ascending: false }).limit(5);
    enviado = ((data ?? []) as (Enviado & { para: string })[]).find((e) => e.para.toLowerCase().split(/,\s*/).includes(de)) ?? null;
  }

  // vínculo: o do e-mail enviado; senão, pelo endereço de quem respondeu
  const vinc = { lead_id: enviado?.lead_id ?? null, contato_id: enviado?.contato_id ?? null, conta_id: enviado?.conta_id ?? null, oportunidade_id: enviado?.oportunidade_id ?? null, card_id: enviado?.card_id ?? null };
  if (!vinc.contato_id && de) {
    const { data: c } = await db.from('contatos').select('id, conta_id').ilike('email', de).limit(1);
    if (c?.[0]) { vinc.contato_id = c[0].id; vinc.conta_id ??= c[0].conta_id; }
  }
  if (!vinc.lead_id && de) {
    const { data: l } = await db.from('leads').select('id, conta_id, oportunidade_id').ilike('email', de).order('criado_em', { ascending: false }).limit(1);
    if (l?.[0]) { vinc.lead_id = l[0].id; vinc.conta_id ??= l[0].conta_id; vinc.oportunidade_id ??= l[0].oportunidade_id; }
  }
  const responsavel = doEndereco?.id ?? enviado?.autor ?? null;
  // devolução de e-mail (mailer-daemon) e no-reply também não viram tarefa
  const automatico = ehAutomatico(r.headers, assunto) || !!doTime || /^(mailer-daemon|postmaster|no-?reply|nao-?responda)@/.test(de);
  // remetente que não passou em nenhuma verificação (SPF e DKIM): pode ser falsificado, então os anexos não seguem no aviso
  const aut = r.authentication ?? {};
  const suspeito = ['spf', 'dkim'].every((k) => /fail/i.test(JSON.stringify(aut[k] ?? '')));
  const vinculado = !!(enviado || vinc.lead_id || vinc.contato_id || vinc.conta_id);
  const anexos = (r.attachments ?? []).map((a) => ({ id: a.id, nome: a.filename, tipo: a.content_type, tamanho: a.size ?? null }));

  const { data: reg, error } = await db.from('emails_recebidos').insert({
    resend_id: resendId, de, de_nome: deNome, para: para.join(', ').slice(0, 1000), assunto, texto, resposta,
    message_id: r.message_id ?? (dados.message_id as string) ?? null, referencias: conversa.reverse().join(' ').slice(0, 4000) || null,
    anexos, automatico, em_resposta_a: enviado?.id ?? null, ...vinc, responsavel,
    recebido_em: r.created_at ?? new Date().toISOString(),
  }).select('id').single();
  if (error) {
    if (error.code === '23505') return { ok: true, repetido: true };
    throw new Error(error.message);
  }
  const quem = deNome || de;
  // aviso pra quem enviou, com os anexos (links temporários do Resend) e o atalho pra responder pelo CRM
  const avisar = async () => {
  const dono = perfis.find((p) => p.id === responsavel && p.ativo);
  if (dono) {
    const crm = (env('CRM_URL', false) || 'https://crm.applumi.io').replace(/\/$/, '');
    const onde = vinc.card_id ? `/cards/${vinc.card_id}` : vinc.oportunidade_id ? `/oportunidades/${vinc.oportunidade_id}` : vinc.lead_id ? `/leads/${vinc.lead_id}` : vinc.conta_id ? `/contas/${vinc.conta_id}` : '/emails';
    let arquivos: { filename: string; path: string }[] = [];
    if (anexos.length && !suspeito) {
      const lista = await lerResend<{ data?: { filename: string; size?: number; download_url?: string }[] }>(`/emails/receiving/${encodeURIComponent(resendId)}/attachments`);
      const comLink = (lista?.data ?? []).filter((a) => a.download_url);
      const total = comLink.reduce((t, a) => t + (a.size ?? 0), 0);
      if (total < 15 * 1024 * 1024) arquivos = comLink.map((a) => ({ filename: a.filename, path: a.download_url! }));
    }
    const alerta = suspeito ? '\n\nAtenção: este e-mail não passou na verificação do remetente (pode ser falsificado). Os anexos não foram encaminhados.' : '';
    const corpo = `${quem} respondeu "${assunto || '(sem assunto)'}":\n\n${resposta}${alerta}\n\nResponda pelo CRM, para a conversa ficar registrada: ${crm}${onde}`;
    const dominio = env('EMAIL_DOMINIO', false) || 'applumi.io';
    try {
      await enviarEmail({
        para: [dono.email], assunto: `Resposta de ${quem}: ${assunto || '(sem assunto)'}`, texto: corpo,
        html: textoParaHtml(corpo),
        de: `CRM Lumi <comercial@${dominio}>`, anexos: arquivos,
      });
    } catch (e) {
      console.warn('aviso de resposta não enviado:', (e as Error).message); // a resposta já está no CRM
    }
  }
  };
  if (!vinculado) {
    // escreveram direto pro endereço de alguém do time, de um e-mail que o CRM não conhece: avisa, sem tarefa
    if (doEndereco && !automatico) await avisar();
    return { ok: true, id: reg.id, vinculado: false };
  }

  // linha do tempo (sempre) e tarefa "responder" (quando não é automática)
  const alvo = { ...vinc, card_id: vinc.card_id ?? undefined };
  if (!alvo.card_id) delete alvo.card_id;
  const nAnexos = anexos.length ? `\n\n📎 ${anexos.length === 1 ? '1 anexo' : `${anexos.length} anexos`}: ${anexos.map((a) => a.nome).join(', ')}` : '';
  await db.from('atividades').insert({
    tipo: 'email', titulo: `${doTime ? 'E-mail do time' : automatico ? 'Resposta automática' : 'Resposta recebida'} de ${quem}: ${assunto || '(sem assunto)'}`,
    descricao: (resposta + nAnexos).slice(0, 8000), email_recebido_id: reg.id, ...alvo,
  });
  if (automatico) return { ok: true, id: reg.id, automatico: true };

  const { data: tarefa } = await db.from('atividades').insert({
    tipo: 'tarefa', titulo: `Responder e-mail de ${quem}`, descricao: assunto || null, responsavel,
    vence_em: prazoResponder(new Date()), email_recebido_id: reg.id, ...alvo,
  }).select('id').single();
  if (tarefa) await db.from('emails_recebidos').update({ tarefa_id: tarefa.id }).eq('id', reg.id);
  if (vinc.lead_id) {
    await db.from('eventos').insert({ nome: 'email_respondido', origem: 'email', lead_id: vinc.lead_id, conta_id: vinc.conta_id });
    await db.from('leads').update({ status: 'em_contato' }).eq('id', vinc.lead_id).eq('status', 'novo');
  }
  await avisar();

  return { ok: true, id: reg.id };
}
