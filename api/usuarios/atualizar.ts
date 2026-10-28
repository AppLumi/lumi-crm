// POST /api/usuarios/atualizar { id, papel?, aprova_desconto?, ativo? } — só sócias mudam papel e permissões
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, exigirTime, texto } from '../_lib.js';

const PAPEIS = ['socia', 'negocios', 'marketing', 'tecnologia'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const quem = await exigirTime(req, res);
  if (!quem) return;
  if (quem.perfil.papel !== 'socia') return res.status(403).json({ erro: 'Só as sócias mudam permissões' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const id = texto(b.id, 40);
  if (!id) return res.status(400).json({ erro: 'Informe a pessoa' });
  if (id === quem.perfil.id && (b.ativo === false || (b.papel && b.papel !== 'socia'))) {
    return res.status(400).json({ erro: 'Você não pode tirar o próprio acesso de sócia' });
  }
  const campos: Record<string, unknown> = {};
  if (typeof b.papel === 'string' && PAPEIS.includes(b.papel)) campos.papel = b.papel;
  if (typeof b.aprova_desconto === 'boolean') campos.aprova_desconto = b.aprova_desconto;
  if (typeof b.ativo === 'boolean') campos.ativo = b.ativo;
  if (!Object.keys(campos).length) return res.status(400).json({ erro: 'Nada para mudar' });
  const db = admin();
  const { error } = await db.from('perfis').update(campos).eq('id', id);
  if (error) return res.status(500).json({ erro: error.message });
  await db.from('auditoria').insert({ quem: quem.perfil.id, acao: 'permissoes', tabela: 'perfis', registro: id, detalhe: campos });
  return res.status(200).json({ ok: true });
}
