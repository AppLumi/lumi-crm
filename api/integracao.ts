// POST /api/integracao — integração com o Sales Coach.
//
// Duas portas no mesmo endereço:
// 1) Sales Coach (Authorization: Bearer lumi_…): acha o negócio/empresa/contato de uma reunião pelo e-mail,
//    grava os campos da análise, a nota com o resumo e a tarefa do próximo passo. Mesmo contrato do conector
//    "nexa" do Sales Coach (actions: info, campos, criar_campo, por_email, buscar, negocio, atualizar, nota, tarefa).
// 2) Time do CRM (sessão normal): gerar, listar e revogar tokens (actions: tokens, gerar_token, revogar_token).
//
// "Negócio" para o Sales Coach: uma oportunidade (id) ou, quando a pessoa não tem negócio aberto, a empresa
// ("conta:<id>"), o contato ("contato:<id>") ou o lead ("lead:<id>"). Assim toda reunião fica ligada a alguém.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, exigirTime, texto } from './_lib.js';

type Json = Record<string, unknown>;
interface Negocio { id: string; name: string; status: string | null; fields: Json }

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
/** Texto para busca com .or() (sem vírgulas e parênteses, que quebram o filtro). */
const literal = (s: string) => s.replace(/[\\%_,()]/g, ' ');
/** E-mail exato num ilike: escapa os curingas. */
const exato = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const STATUS: Record<string, string> = { ganha: 'won', perdida: 'lost' };

class Erro extends Error { constructor(public codigo: number, msg: string) { super(msg); } }

async function oportunidades(db: SupabaseClient, filtro: { contas?: string[]; ids?: string[] }): Promise<Negocio[]> {
  let q = db.from('oportunidades').select('id, titulo, etapa, conta_id, sales_coach, contas(nome)').order('criado_em', { ascending: false }).limit(30);
  if (filtro.contas) q = q.in('conta_id', filtro.contas);
  if (filtro.ids) q = q.in('id', filtro.ids);
  const { data } = await q;
  return ((data ?? []) as unknown as { id: string; titulo: string; etapa: string; sales_coach: Json; contas: { nome: string } | null }[])
    .map((o) => ({ id: o.id, name: `${o.titulo}${o.contas?.nome && !o.titulo.includes(o.contas.nome) ? ` (${o.contas.nome})` : ''}`, status: STATUS[o.etapa] ?? 'ongoing', fields: o.sales_coach ?? {} }))
    .sort((a, b) => (a.status === 'ongoing' ? 0 : 1) - (b.status === 'ongoing' ? 0 : 1));
}

async function porEmail(db: SupabaseClient, email: string): Promise<Negocio[]> {
  const e = email.trim().toLowerCase();
  const [c, l] = await Promise.all([
    db.from('contatos').select('id, nome, conta_id, contas(nome, sales_coach)').ilike('email', exato(e)).limit(5),
    db.from('leads').select('id, nome, conta_id, oportunidade_id').ilike('email', exato(e)).order('criado_em', { ascending: false }).limit(5),
  ]);
  const contatos = (c.data ?? []) as unknown as { id: string; nome: string; conta_id: string | null; contas: { nome: string; sales_coach: Json } | null }[];
  const leads = (l.data ?? []) as { id: string; nome: string; conta_id: string | null; oportunidade_id: string | null }[];
  const contas = [...new Set([...contatos.map((x) => x.conta_id), ...leads.map((x) => x.conta_id)].filter(Boolean))] as string[];
  const ids = leads.map((x) => x.oportunidade_id).filter(Boolean) as string[];
  const ops = [...(contas.length ? await oportunidades(db, { contas }) : []), ...(ids.length ? await oportunidades(db, { ids }) : [])]
    .filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i);
  if (ops.some((o) => o.status === 'ongoing')) return ops;
  // sem negócio aberto: liga à empresa; sem empresa, ao contato ou ao lead
  const extra: Negocio[] = [];
  if (contas.length) {
    const { data } = await db.from('contas').select('id, nome, sales_coach').in('id', contas);
    ((data ?? []) as { id: string; nome: string; sales_coach: Json }[]).forEach((x) => extra.push({ id: `conta:${x.id}`, name: `Empresa: ${x.nome} (sem negócio aberto)`, status: 'ongoing', fields: x.sales_coach ?? {} }));
  } else if (contatos.length) {
    contatos.forEach((x) => extra.push({ id: `contato:${x.id}`, name: `Contato: ${x.nome}`, status: 'ongoing', fields: {} }));
  } else {
    leads.forEach((x) => extra.push({ id: `lead:${x.id}`, name: `Lead: ${x.nome}`, status: 'ongoing', fields: {} }));
  }
  return [...extra, ...ops];
}

async function buscar(db: SupabaseClient, termo: string): Promise<Negocio[]> {
  const t = literal(termo.trim());
  if (t.length < 2) return [];
  const [o, cs, ct] = await Promise.all([
    db.from('oportunidades').select('id').ilike('titulo', `%${t}%`).limit(15),
    db.from('contas').select('id, nome, sales_coach').ilike('nome', `%${t}%`).limit(15),
    db.from('contatos').select('id, nome, conta_id, contas(nome)').or(`nome.ilike.%${t}%,email.ilike.%${t}%`).limit(15),
  ]);
  const contas = (cs.data ?? []) as { id: string; nome: string; sales_coach: Json }[];
  const ops = await oportunidades(db, { ids: [...new Set([...((o.data ?? []) as { id: string }[]).map((x) => x.id)])] }).catch(() => []);
  const daConta = contas.length ? await oportunidades(db, { contas: contas.map((x) => x.id) }) : [];
  const lista: Negocio[] = [...ops, ...daConta].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);
  contas.forEach((x) => lista.push({ id: `conta:${x.id}`, name: `Empresa: ${x.nome}`, status: 'ongoing', fields: x.sales_coach ?? {} }));
  ((ct.data ?? []) as unknown as { id: string; nome: string; contas: { nome: string } | null }[])
    .forEach((x) => lista.push({ id: `contato:${x.id}`, name: `Contato: ${x.nome}${x.contas ? ` (${x.contas.nome})` : ''}`, status: 'ongoing', fields: {} }));
  return lista.slice(0, 40);
}

/** Onde gravar: oportunidade, empresa, contato ou lead (com a empresa de cada um, quando houver). */
async function alvo(db: SupabaseClient, id: string): Promise<{ tipo: 'op' | 'conta' | 'contato' | 'lead'; id: string; conta_id: string | null; contato_id: string | null; lead_id: string | null; oportunidade_id: string | null; dono: string | null; nome: string }> {
  const [tipo, ref] = id.includes(':') ? id.split(':', 2) : ['op', id];
  if (!/^[0-9a-f-]{36}$/i.test(ref)) throw new Erro(404, 'Negócio não encontrado');
  if (tipo === 'op') {
    const { data } = await db.from('oportunidades').select('id, titulo, conta_id, decisor_id, dono').eq('id', ref).maybeSingle();
    if (!data) throw new Erro(404, 'Negócio não encontrado');
    return { tipo: 'op', id: ref, conta_id: data.conta_id, contato_id: data.decisor_id, lead_id: null, oportunidade_id: ref, dono: data.dono, nome: data.titulo };
  }
  if (tipo === 'conta') {
    const { data } = await db.from('contas').select('id, nome, dono').eq('id', ref).maybeSingle();
    if (!data) throw new Erro(404, 'Empresa não encontrada');
    return { tipo: 'conta', id: ref, conta_id: ref, contato_id: null, lead_id: null, oportunidade_id: null, dono: data.dono, nome: data.nome };
  }
  if (tipo === 'contato') {
    const { data } = await db.from('contatos').select('id, nome, conta_id, contas(dono)').eq('id', ref).maybeSingle();
    if (!data) throw new Erro(404, 'Contato não encontrado');
    return { tipo: 'contato', id: ref, conta_id: data.conta_id, contato_id: ref, lead_id: null, oportunidade_id: null, dono: (data as unknown as { contas: { dono: string | null } | null }).contas?.dono ?? null, nome: data.nome };
  }
  if (tipo === 'lead') {
    const { data } = await db.from('leads').select('id, nome, conta_id, contato_id, oportunidade_id, dono').eq('id', ref).maybeSingle();
    if (!data) throw new Erro(404, 'Lead não encontrado');
    return { tipo: 'lead', id: ref, conta_id: data.conta_id, contato_id: data.contato_id, lead_id: ref, oportunidade_id: data.oportunidade_id, dono: data.dono, nome: data.nome };
  }
  throw new Erro(404, 'Negócio não encontrado');
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'campo';

async function acaoSalesCoach(db: SupabaseClient, b: Json): Promise<Json> {
  const acao = String(b.action ?? '');
  if (acao === 'info') return { conta: 'CRM do Lumi' };
  if (acao === 'campos') {
    const { data } = await db.from('salescoach_campos').select('key, label, type, options').order('criado_em');
    return { campos: data ?? [] };
  }
  if (acao === 'criar_campo') {
    const label = texto(b.label, 80);
    if (!label) throw new Erro(400, 'Informe o nome do campo');
    let key = slug(label);
    const { data: ja } = await db.from('salescoach_campos').select('key').like('key', `${key}%`);
    if ((ja ?? []).some((x: { key: string }) => x.key === key)) key = `${key}_${(ja ?? []).length + 1}`;
    const campo = { key, label, type: texto(b.type, 20) ?? 'text', options: Array.isArray(b.options) ? b.options.map(String).slice(0, 50) : null };
    const { error } = await db.from('salescoach_campos').insert(campo);
    if (error) throw new Erro(500, error.message);
    return { campo };
  }
  if (acao === 'por_email') {
    const email = texto(b.email, 160);
    if (!email) throw new Erro(400, 'Informe o e-mail');
    return { negocios: await porEmail(db, email) };
  }
  if (acao === 'buscar') return { negocios: await buscar(db, String(b.termo ?? '')) };

  const id = texto(b.id, 60);
  if (!id) throw new Erro(400, 'Informe o negócio');
  const a = await alvo(db, id);
  if (acao === 'negocio') {
    let fields: Json = {};
    if (a.oportunidade_id && a.tipo === 'op') fields = ((await db.from('oportunidades').select('sales_coach').eq('id', a.id).single()).data?.sales_coach ?? {}) as Json;
    else if (a.conta_id) fields = ((await db.from('contas').select('sales_coach').eq('id', a.conta_id).single()).data?.sales_coach ?? {}) as Json;
    let status = 'ongoing';
    if (a.tipo === 'op') { const { data } = await db.from('oportunidades').select('etapa').eq('id', a.id).single(); status = STATUS[(data as { etapa: string }).etapa] ?? 'ongoing'; }
    return { negocio: { id, name: a.nome, status, fields } };
  }
  if (acao === 'atualizar') {
    const valores = (b.valores && typeof b.valores === 'object' ? b.valores : {}) as Json;
    const tabela = a.tipo === 'op' ? 'oportunidades' : a.conta_id ? 'contas' : null;
    const chave = a.tipo === 'op' ? a.id : a.conta_id;
    if (!tabela || !chave) return { ok: true, ignorado: 'sem empresa para guardar os campos' };
    const { data } = await db.from(tabela).select('sales_coach').eq('id', chave).single();
    const { error } = await db.from(tabela).update({ sales_coach: { ...((data?.sales_coach ?? {}) as Json), ...valores, atualizado_em: new Date().toISOString() } }).eq('id', chave);
    if (error) throw new Erro(500, error.message);
    return { ok: true };
  }
  const ligacao = { conta_id: a.conta_id, contato_id: a.contato_id, lead_id: a.lead_id, oportunidade_id: a.oportunidade_id };
  if (acao === 'nota') {
    const t = texto(b.texto, 20000);
    if (!t) throw new Erro(400, 'Nota vazia');
    const { error } = await db.from('atividades').insert({ tipo: 'reuniao', titulo: 'Reunião analisada no Sales Coach', descricao: t, ...ligacao });
    if (error) throw new Erro(500, error.message);
    return { ok: true };
  }
  if (acao === 'tarefa') {
    const nome = texto(b.nome, 200) ?? 'Próximo passo';
    const venc = texto(b.vencimento, 40);
    const { error } = await db.from('atividades').insert({ tipo: 'tarefa', titulo: nome, descricao: texto(b.descricao, 5000), responsavel: a.dono,
      vence_em: venc && !Number.isNaN(Date.parse(venc)) ? new Date(venc).toISOString() : null, ...ligacao });
    if (error) throw new Erro(500, error.message);
    return { ok: true };
  }
  throw new Erro(400, 'Ação desconhecida');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST', erro: 'Use POST' });
  const b = (req.body ?? {}) as Json;
  const auth = String(req.headers.authorization ?? '');
  const db = admin();
  try {
    // 1) chamada do Sales Coach
    if (/^Bearer lumi_[A-Za-z0-9]{20,}$/.test(auth)) {
      const token = auth.slice(7);
      const { data: t } = await db.from('integracao_tokens').select('id').eq('hash', hash(token)).is('revogado_em', null).maybeSingle();
      if (!t) return res.status(401).json({ error: 'Token inválido ou revogado', erro: 'Token inválido ou revogado' });
      await db.from('integracao_tokens').update({ usado_em: new Date().toISOString() }).eq('id', (t as { id: string }).id);
      return res.status(200).json(await acaoSalesCoach(db, b));
    }
    // 2) time do CRM gerenciando os tokens
    const quem = await exigirTime(req, res);
    if (!quem) return;
    const acao = String(b.action ?? '');
    if (acao === 'tokens') {
      const { data } = await db.from('integracao_tokens').select('id, nome, prefixo, criado_em, usado_em, revogado_em').order('criado_em', { ascending: false });
      return res.status(200).json({ tokens: data ?? [] });
    }
    if (acao === 'gerar_token') {
      const token = `lumi_${randomBytes(24).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}`;
      const { error } = await db.from('integracao_tokens').insert({ nome: texto(b.nome, 80) ?? 'Sales Coach', prefixo: token.slice(0, 10), hash: hash(token), criado_por: quem.perfil.id });
      if (error) throw new Erro(500, error.message);
      return res.status(200).json({ token, endereco: `https://${req.headers.host}/api/integracao` });
    }
    if (acao === 'revogar_token') {
      const { error } = await db.from('integracao_tokens').update({ revogado_em: new Date().toISOString() }).eq('id', String(b.id ?? ''));
      if (error) throw new Erro(500, error.message);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Ação desconhecida', erro: 'Ação desconhecida' });
  } catch (e) {
    const codigo = e instanceof Erro ? e.codigo : 500;
    if (codigo >= 500) console.error('integracao:', (e as Error).message);
    return res.status(codigo).json({ error: (e as Error).message, erro: (e as Error).message });
  }
}
