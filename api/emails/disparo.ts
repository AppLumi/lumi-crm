// POST /api/emails/disparo — e-mail em massa para leads selecionados (nutrição, listas de evento…).
// modo "previa": só conta quem recebe e quem fica de fora. "teste": manda um exemplo para quem está disparando.
// "enviar": manda para todos, um e-mail por pessoa, personalizado, com link de descadastro, e registra na linha do tempo.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, enviarEmail, enviarLote, env, esc, exigirTime, linkDescadastro, texto, textoParaHtml } from '../_lib.js';
import { LIMITE_DISPARO, preencher, problemasDoTexto, separarDestinatarios, variaveisDoLead, type LeadDisparo } from '../../shared/disparo.js';

export const config = { maxDuration: 60 };

const LOTE = 100;
const uuid = /^[0-9a-f-]{36}$/i;
const pausa = (ms: number) => new Promise((s) => setTimeout(s, ms));

function rodape(link: string) {
  return {
    texto: `\n\n—\nNão quer mais receber estes e-mails do Lumi? Descadastre-se: ${link}`,
    html: `<p style="margin:28px 0 0;padding-top:14px;border-top:1px solid #E3E8F2;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6B7A99">Não quer mais receber estes e-mails do Lumi? <a href="${esc(link)}" style="color:#6B7A99">Descadastre-se</a>.</p>`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const quem = await exigirTime(req, res);
  if (!quem) return;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const modo = b.modo === 'enviar' || b.modo === 'teste' ? b.modo : 'previa';
  const ids = [...new Set((Array.isArray(b.lead_ids) ? b.lead_ids : []).map(String).filter((s) => uuid.test(s)))];
  if (!ids.length) return res.status(400).json({ erro: 'Selecione os leads' });
  if (ids.length > LIMITE_DISPARO) return res.status(400).json({ erro: `Máximo de ${LIMITE_DISPARO} leads por disparo` });
  const assunto = texto(b.assunto, 200) ?? '';
  const corpo = texto(b.corpo, 20000) ?? '';
  const modeloId = texto(b.modelo_id, 40);
  const soComAceite = b.so_com_aceite === true;
  const problemas = problemasDoTexto(assunto, corpo);
  if (modo !== 'previa' && problemas.length) return res.status(400).json({ erro: problemas[0] });

  const db = admin();
  // leads selecionados
  const leads: LeadDisparo[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('leads').select('id, nome, email, empresa, status, aceita_marketing').in('id', ids.slice(i, i + 200));
    if (error) return res.status(500).json({ erro: error.message });
    leads.push(...((data ?? []) as LeadDisparo[]));
  }
  // quem pediu para sair: descadastro pelo link, contato descadastrado ou e-mail marcado como spam
  const emails = [...new Set(leads.map((l) => l.email?.trim().toLowerCase()).filter(Boolean))] as string[];
  const descadastrados = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('eventos').select('lead_id').eq('nome', 'descadastro').in('lead_id', ids.slice(i, i + 200));
    (data ?? []).forEach((e: { lead_id: string }) => descadastrados.add(e.lead_id));
  }
  for (let i = 0; i < emails.length; i += 200) {
    const parte = emails.slice(i, i + 200);
    const [c, r] = await Promise.all([
      db.from('contatos').select('email').not('descadastrado_em', 'is', null).in('email', parte),
      db.from('emails').select('para').eq('status', 'reclamacao').in('para', parte),
    ]);
    (c.data ?? []).forEach((x: { email: string }) => descadastrados.add(x.email.toLowerCase()));
    (r.data ?? []).forEach((x: { para: string }) => descadastrados.add(x.para.toLowerCase()));
  }
  const { enviar, fora } = separarDestinatarios(leads, { descadastrados, soComAceite });
  const semAceite = enviar.filter((l) => !l.aceita_marketing).length;

  if (modo === 'previa') {
    return res.status(200).json({ ok: true, selecionados: ids.length, recebem: enviar.length, fora, sem_aceite: semAceite, problemas });
  }
  if (!enviar.length) return res.status(400).json({ erro: 'Ninguém da seleção pode receber este e-mail' });

  const dominio = env('EMAIL_DOMINIO', false) || 'applumi.io';
  const de = `${quem.perfil.nome} · Lumi <comercial@${dominio}>`;
  const montar = (l: LeadDisparo) => {
    const v = variaveisDoLead(l, quem.perfil.nome);
    const a = preencher(assunto, v), c = preencher(corpo, v);
    const link = linkDescadastro(l.id);
    const r = rodape(link);
    const html = textoParaHtml(c).replace(/<\/div>$/, `${r.html}</div>`);
    return {
      assunto: a, corpo: c, html, texto: c + r.texto,
      cabecalhos: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    };
  };

  if (modo === 'teste') {
    const m = montar(enviar[0]);
    await enviarEmail({ para: [quem.perfil.email], assunto: `[Teste] ${m.assunto}`, texto: m.texto, html: m.html, de, responderPara: quem.perfil.email });
    return res.status(200).json({ ok: true, para: quem.perfil.email, exemplo_de: enviar[0].nome });
  }

  // envio: a chave do disparo vem da tela e impede mandar duas vezes no clique duplo
  const chave = texto(b.chave, 40);
  if (!chave || !uuid.test(chave)) return res.status(400).json({ erro: 'Abra o disparo de novo e tente outra vez' });
  const { data: jaFoi } = await db.from('auditoria').select('id').eq('acao', 'disparo_email').eq('registro', chave).maybeSingle();
  if (jaFoi) return res.status(409).json({ erro: 'Este disparo já foi enviado' });
  const { data: reg, error: errReg } = await db.from('auditoria').insert({
    quem: quem.perfil.id, acao: 'disparo_email', tabela: 'emails', registro: chave,
    detalhe: { assunto, autor: quem.perfil.nome, selecionados: ids.length, recebem: enviar.length, fora, so_com_aceite: soComAceite, modelo_id: modeloId, emails: [] },
  }).select('id').single();
  if (errReg) return res.status(500).json({ erro: errReg.message });

  const agora = () => new Date().toISOString();
  const idsEmails: string[] = [];
  let enviados = 0, falhas = 0;
  for (let i = 0; i < enviar.length; i += LOTE) {
    const lote = enviar.slice(i, i + LOTE);
    const msgs = lote.map(montar);
    const { data: linhas, error } = await db.from('emails').insert(lote.map((l, k) => ({
      para: l.email!, assunto: msgs[k].assunto, corpo: msgs[k].corpo, modelo_id: modeloId, autor: quem.perfil.id, lead_id: l.id,
    }))).select('id');
    if (error || !linhas || linhas.length !== lote.length) { falhas += lote.length; continue; }
    idsEmails.push(...linhas.map((x: { id: string }) => x.id));
    try {
      const resendIds = await enviarLote(lote.map((l, k) => ({
        para: l.email!, assunto: msgs[k].assunto, html: msgs[k].html, texto: msgs[k].texto, de,
        responderPara: quem.perfil.email, cabecalhos: msgs[k].cabecalhos,
      })));
      const quando = agora();
      await Promise.all(linhas.map((x: { id: string }, k: number) =>
        db.from('emails').update({ status: 'enviado', resend_id: resendIds[k], enviado_em: quando }).eq('id', x.id)));
      await db.from('atividades').insert(lote.map((l, k) => ({
        tipo: 'email', titulo: `E-mail em massa: ${msgs[k].assunto}`, descricao: msgs[k].corpo, autor: quem.perfil.id, lead_id: l.id,
      })));
      const novos = lote.filter((l) => l.status === 'novo').map((l) => l.id);
      if (novos.length) await db.from('leads').update({ status: 'em_contato' }).in('id', novos);
      await db.from('leads').update({ primeiro_contato_em: quando }).in('id', lote.map((l) => l.id)).is('primeiro_contato_em', null);
      enviados += lote.length;
    } catch (e) {
      falhas += lote.length;
      await db.from('emails').update({ status: 'falhou', erro: (e as Error).message.slice(0, 300) }).in('id', linhas.map((x: { id: string }) => x.id));
    }
    if (i + LOTE < enviar.length) await pausa(600);
  }
  await db.from('auditoria').update({
    detalhe: { assunto, autor: quem.perfil.nome, selecionados: ids.length, recebem: enviar.length, fora, so_com_aceite: soComAceite, modelo_id: modeloId, emails: idsEmails, enviados, falhas },
  }).eq('id', reg.id);
  return res.status(200).json({ ok: true, enviados, falhas, fora });
}
