// POST /api/emails/enviar — o time envia um e-mail a um lead ou contato; fica registrado na linha do tempo
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, emailValido, enviarEmail, env, exigirTime, texto, textoParaHtml } from '../_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const quem = await exigirTime(req, res);
  if (!quem) return;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const para = texto(b.para, 160)?.toLowerCase() ?? null;
  const assunto = texto(b.assunto, 200);
  const corpo = texto(b.corpo, 20000);
  if (!emailValido(para) || !assunto || !corpo) return res.status(400).json({ erro: 'Preencha destinatário, assunto e mensagem' });
  const db = admin();

  // respeita descadastro
  const { data: contato } = await db.from('contatos').select('id, descadastrado_em').ilike('email', para).maybeSingle();
  if (contato?.descadastrado_em) return res.status(409).json({ erro: 'Este contato pediu para não receber e-mails' });

  const ref = {
    lead_id: texto(b.lead_id, 40), contato_id: texto(b.contato_id, 40) ?? contato?.id ?? null,
    conta_id: texto(b.conta_id, 40), oportunidade_id: texto(b.oportunidade_id, 40),
  };
  const { data: reg, error } = await db.from('emails').insert({
    para, assunto, corpo, modelo_id: texto(b.modelo_id, 40), autor: quem.perfil.id, ...ref,
  }).select('id').single();
  if (error) return res.status(500).json({ erro: error.message });

  const dominio = env('EMAIL_DOMINIO', false) || 'applumi.io';
  const de = `${quem.perfil.nome} · Lumi <comercial@${dominio}>`;
  try {
    const id = await enviarEmail({ para: [para], assunto, texto: corpo, html: textoParaHtml(corpo), responderPara: quem.perfil.email, de });
    await db.from('emails').update({ status: 'enviado', resend_id: id, enviado_em: new Date().toISOString() }).eq('id', reg.id);
    await db.from('atividades').insert({ tipo: 'email', titulo: `E-mail enviado: ${assunto}`, descricao: corpo, autor: quem.perfil.id, ...ref });
    if (ref.lead_id) await db.from('leads').update({ status: 'em_contato', primeiro_contato_em: new Date().toISOString() })
      .eq('id', ref.lead_id).is('primeiro_contato_em', null);
    return res.status(200).json({ ok: true, id: reg.id });
  } catch (e) {
    await db.from('emails').update({ status: 'falhou', erro: (e as Error).message.slice(0, 300) }).eq('id', reg.id);
    return res.status(502).json({ erro: 'O envio falhou. Tente de novo em instantes.' });
  }
}
