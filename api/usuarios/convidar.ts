// POST /api/usuarios/convidar { nome, email, papel, aprova_desconto } — só sócias convidam
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, emailValido, exigirTime, texto } from '../_lib.js';

const PAPEIS = ['socia', 'negocios', 'marketing', 'tecnologia'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const quem = await exigirTime(req, res);
  if (!quem) return;
  if (quem.perfil.papel !== 'socia') return res.status(403).json({ erro: 'Só as sócias convidam pessoas' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const nome = texto(b.nome, 120);
  const email = texto(b.email, 160)?.toLowerCase() ?? null;
  const papel = PAPEIS.includes(String(b.papel)) ? String(b.papel) : 'negocios';
  if (!nome || !emailValido(email)) return res.status(400).json({ erro: 'Informe nome e e-mail' });
  const db = admin();
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.CRM_URL ?? 'https://crm.applumi.io'}/definir-senha`, data: { nome },
  });
  if (error || !data.user) return res.status(400).json({ erro: error?.message ?? 'Convite falhou' });
  const { error: e2 } = await db.from('perfis').upsert({ id: data.user.id, nome, email, papel, aprova_desconto: b.aprova_desconto === true, ativo: true });
  if (e2) return res.status(500).json({ erro: e2.message });
  return res.status(200).json({ ok: true });
}
