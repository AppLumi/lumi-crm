// GET /api/proposta?t=token — dados públicos da proposta (link enviado ao cliente)
// POST /api/proposta { t, resposta: 'aceita' | 'recusada', nome } — resposta do cliente
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, texto } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = texto(req.method === 'GET' ? req.query.t : (req.body as Record<string, unknown>)?.t, 80);
  if (!token || !/^[a-f0-9]{36}$/.test(token)) return res.status(404).json({ erro: 'Proposta não encontrada' });
  const db = admin();
  const { data: p } = await db.from('propostas')
    .select('id, versao, plano, vidas, preco_vida, mensal_tabela, desconto_pct, mensal, implementacao_tabela, desconto_implementacao_pct, implementacao, primeiro_ano, validade, observacoes, status, criado_em, oportunidade_id, oportunidades(conta_id, contas(nome), dono, perfis:dono(nome, email))')
    .eq('token', token).maybeSingle();
  if (!p || !['enviada', 'aceita', 'recusada', 'expirada'].includes(p.status)) return res.status(404).json({ erro: 'Proposta não encontrada' });
  const op = p.oportunidades as unknown as { conta_id: string; contas: { nome: string }; perfis: { nome: string; email: string } | null };
  const vencida = new Date(p.validade + 'T23:59:59-03:00') < new Date();

  if (req.method === 'GET') {
    if (!vencida) await db.from('propostas').update({ visualizada_em: new Date().toISOString() }).eq('id', p.id).is('visualizada_em', null);
    const { oportunidade_id: _o, oportunidades: _x, id: _i, ...publico } = p;
    return res.status(200).json({ ...publico, empresa: op.contas.nome, responsavel: op.perfis, vencida });
  }
  if (req.method === 'POST') {
    const b = req.body as Record<string, unknown>;
    const resposta = b.resposta === 'aceita' ? 'aceita' : b.resposta === 'recusada' ? 'recusada' : null;
    const nome = texto(b.nome, 120);
    if (!resposta || !nome) return res.status(400).json({ erro: 'Informe seu nome e a resposta' });
    if (p.status !== 'enviada' || vencida) return res.status(409).json({ erro: 'Esta proposta não pode mais ser respondida' });
    await db.from('propostas').update({ status: resposta, respondida_em: new Date().toISOString() }).eq('id', p.id);
    await db.from('atividades').insert({ tipo: 'sistema', titulo: `Proposta v${p.versao} ${resposta} por ${nome}`, conta_id: op.conta_id, oportunidade_id: p.oportunidade_id });
    if (resposta === 'aceita') {
      await db.from('atividades').insert({ tipo: 'tarefa', titulo: 'Proposta aceita: enviar contrato e marcar como ganha', conta_id: op.conta_id,
        oportunidade_id: p.oportunidade_id, responsavel: (op as unknown as { dono: string }).dono, vence_em: new Date(Date.now() + 864e5).toISOString() });
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
