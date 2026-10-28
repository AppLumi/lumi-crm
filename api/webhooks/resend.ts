// POST /api/webhooks/resend — status de entrega, abertura e clique (assinatura Svix verificada)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { admin, corpoCru, env } from '../_lib.js';

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
  const corpo = await corpoCru(req);
  const ok = assinaturaValida(env('RESEND_WEBHOOK_SECRET'), String(req.headers['svix-id'] ?? ''),
    String(req.headers['svix-timestamp'] ?? ''), corpo, String(req.headers['svix-signature'] ?? ''));
  if (!ok) return res.status(401).json({ erro: 'assinatura inválida' });
  const ev = JSON.parse(corpo) as { type: string; created_at: string; data: { email_id: string } };
  const m = MAPA[ev.type];
  if (!m) return res.status(200).json({ ignorado: ev.type });
  const db = admin();
  const { data: email } = await db.from('emails').select('*').eq('resend_id', ev.data.email_id).maybeSingle();
  if (!email) return res.status(200).json({ ok: true });
  const upd: Record<string, unknown> = {};
  if (m.campo && !email[m.campo]) upd[m.campo] = ev.created_at;
  // status só avança (aberto não volta a "entregue"); devolução e reclamação sempre valem
  if (!ORDEM.includes(m.status) || ORDEM.indexOf(m.status) > ORDEM.indexOf(email.status)) upd.status = m.status;
  if (Object.keys(upd).length) await db.from('emails').update(upd).eq('id', email.id);
  // sinais de interesse para a nota do lead
  if ((ev.type === 'email.opened' || ev.type === 'email.clicked') && email.lead_id && m.campo && !email[m.campo]) {
    await db.from('eventos').insert({ nome: ev.type === 'email.opened' ? 'email_aberto' : 'email_clique', origem: 'email', lead_id: email.lead_id, conta_id: email.conta_id });
  }
  if (ev.type === 'email.complained' && email.contato_id) {
    await db.from('contatos').update({ descadastrado_em: new Date().toISOString(), aceita_marketing: false }).eq('id', email.contato_id);
  }
  return res.status(200).json({ ok: true });
}
