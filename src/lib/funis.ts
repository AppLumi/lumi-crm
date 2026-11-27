// Colocar pessoas (leads ou contatos) num funil: o de vendas do Lumi ou um funil próprio.
// Usado na qualificação do lead, na seleção em massa e ao mover cards/oportunidades entre funis.
import { ok, supabase } from './supabase';
import { vincularLeadAConta, type ContaResumo } from '../../shared/empresas';

export const VENDAS = 'vendas';

export interface DestinoFunil { id: string; nome: string; dono_padrao?: string | null }

/** Funis para onde dá para mandar alguém: Vendas Lumi primeiro, depois os funis próprios ativos. */
export async function funisDisponiveis(): Promise<DestinoFunil[]> {
  const { data } = await supabase.from('funis').select('id, nome, dono_padrao').eq('ativo', true).order('ordem');
  return [{ id: VENDAS, nome: 'Vendas Lumi' }, ...((data ?? []) as DestinoFunil[])];
}

export interface PessoaFunil {
  tipo: 'lead' | 'contato';
  id: string; nome: string; email: string | null; whatsapp: string | null; cargo: string | null;
  empresa: string | null; conta_id: string | null; contato_id: string | null; lead_id: string | null;
  oportunidade_id?: string | null; aceita_marketing: boolean; consentimento_em?: string | null;
  colaboradores?: number | null; dono?: string | null; primeiro_contato_em?: string | null;
}

export type Resultado = { ok: true; link: string } | { ok: false; motivo: string; link?: string };

const atividade = (campos: Record<string, unknown>) => supabase.from('atividades').insert({ tipo: 'sistema', ...campos });

/** Abre um negócio no funil de vendas (sem perguntar plano: o plano só entra na proposta). */
async function paraVendas(p: PessoaFunil, autor: string | null): Promise<Resultado> {
  if (p.tipo === 'lead') {
    if (p.oportunidade_id) return { ok: false, motivo: 'já está no funil de vendas', link: `/oportunidades/${p.oportunidade_id}` };
    if (!p.conta_id) {
      // sem empresa: a função do banco cria (ou acha pelo CNPJ) a empresa, o contato e o negócio
      const op = ok(await supabase.rpc('qualificar_lead', { p_lead: p.id })) as string;
      const { data: l } = await supabase.from('leads').select('contato_id').eq('id', p.id).maybeSingle();
      if (l?.contato_id) await supabase.from('oportunidades').update({ decisor_id: l.contato_id }).eq('id', op);
      return { ok: true, link: `/oportunidades/${op}` };
    }
    const { data: conta } = await supabase.from('contas').select('id, nome, cnpj, colaboradores').eq('id', p.conta_id).single();
    let contatoId = p.contato_id;
    if (!contatoId) contatoId = (await vincularLeadAConta(supabase, { ...p, contato_id: null }, conta as ContaResumo, { autor, motivo: 'entrou no funil de vendas', moverContato: false })).contatoId;
    const op = ok(await supabase.from('oportunidades').insert({
      conta_id: p.conta_id, titulo: `Lumi · ${(conta as ContaResumo).nome}`, vidas: p.colaboradores ?? (conta as { colaboradores: number | null }).colaboradores,
      dono: p.dono ?? autor, decisor_id: contatoId,
    }).select('id').single())!;
    await supabase.from('contas').update({ estagio: 'oportunidade' }).eq('id', p.conta_id).in('estagio', ['lead', 'prospeccao']);
    ok(await supabase.from('leads').update({ status: 'qualificado', contato_id: contatoId, oportunidade_id: op.id,
      primeiro_contato_em: p.primeiro_contato_em ?? new Date().toISOString() }).eq('id', p.id));
    await supabase.from('atividades').update({ conta_id: p.conta_id, oportunidade_id: op.id }).eq('lead_id', p.id);
    await atividade({ titulo: 'Entrou no funil de vendas', conta_id: p.conta_id, lead_id: p.id, oportunidade_id: op.id, autor });
    return { ok: true, link: `/oportunidades/${op.id}` };
  }
  // contato
  if (!p.conta_id) return { ok: false, motivo: 'contato sem empresa (vincule a uma empresa antes)' };
  const { data: aberta } = await supabase.from('oportunidades').select('id').eq('conta_id', p.conta_id).not('etapa', 'in', '(ganha,perdida)').limit(1);
  if (aberta?.length) return { ok: false, motivo: 'a empresa já tem um negócio aberto no funil de vendas', link: `/oportunidades/${aberta[0].id}` };
  const { data: conta } = await supabase.from('contas').select('id, nome, colaboradores, estagio').eq('id', p.conta_id).single();
  const c = conta as { id: string; nome: string; colaboradores: number | null };
  const op = ok(await supabase.from('oportunidades').insert({
    conta_id: c.id, titulo: `Lumi · ${c.nome}`, vidas: c.colaboradores, dono: p.dono ?? autor, decisor_id: p.id,
  }).select('id').single())!;
  await supabase.from('contas').update({ estagio: 'oportunidade' }).eq('id', c.id).in('estagio', ['lead', 'prospeccao']);
  await atividade({ titulo: `${p.nome} entrou no funil de vendas`, conta_id: c.id, contato_id: p.id, oportunidade_id: op.id, autor });
  return { ok: true, link: `/oportunidades/${op.id}` };
}

/** Cria um card na primeira etapa de um funil próprio. */
async function paraFunilProprio(f: DestinoFunil, p: PessoaFunil, autor: string | null): Promise<Resultado> {
  const filtro = p.tipo === 'lead' ? `lead_id.eq.${p.id}` : `contato_id.eq.${p.id}${p.lead_id ? `,lead_id.eq.${p.lead_id}` : ''}`;
  const { data: ja } = await supabase.from('funil_cards').select('id').eq('funil_id', f.id).or(filtro).is('fechado_em', null).limit(1);
  if (ja?.length) return { ok: false, motivo: `já está no funil ${f.nome}`, link: `/cards/${ja[0].id}` };
  const { data: et } = await supabase.from('funil_etapas').select('id').eq('funil_id', f.id).eq('tipo', 'aberta').order('ordem').limit(1);
  if (!et?.length) throw new Error(`O funil ${f.nome} não tem etapa em andamento`);
  const r = ok(await supabase.from('funil_cards').insert({
    funil_id: f.id, etapa_id: et[0].id, titulo: p.nome, nome: p.nome, email: p.email, whatsapp: p.whatsapp, empresa: p.empresa,
    conta_id: p.conta_id, contato_id: p.tipo === 'contato' ? p.id : p.contato_id, lead_id: p.tipo === 'lead' ? p.id : p.lead_id,
    aceita_marketing: p.aceita_marketing, consentimento_em: p.consentimento_em ?? null, dono: f.dono_padrao ?? p.dono ?? autor, origem: 'crm',
  }).select('id').single())!;
  await atividade({ titulo: `Entrou no funil ${f.nome}`, card_id: r.id, conta_id: p.conta_id, lead_id: p.tipo === 'lead' ? p.id : p.lead_id,
    contato_id: p.tipo === 'contato' ? p.id : p.contato_id, autor });
  return { ok: true, link: `/cards/${r.id}` };
}

export async function colocarNoFunil(f: DestinoFunil, p: PessoaFunil, autor: string | null): Promise<Resultado> {
  return f.id === VENDAS ? paraVendas(p, autor) : paraFunilProprio(f, p, autor);
}

/** Converte linhas de lead/contato do banco no formato comum. */
export const pessoaDeLead = (l: {
  id: string; nome: string; email: string | null; whatsapp: string | null; cargo: string | null; empresa: string | null; conta_id: string | null;
  contato_id: string | null; oportunidade_id: string | null; aceita_marketing: boolean; colaboradores: number | null; dono: string | null;
  primeiro_contato_em: string | null; consentimento_em?: string | null;
}): PessoaFunil => ({ tipo: 'lead', ...l, lead_id: l.id });

export const pessoaDeContato = (c: {
  id: string; nome: string; email: string | null; whatsapp: string | null; cargo: string | null; conta_id: string | null;
  aceita_marketing: boolean; dono?: string | null; consentimento_em?: string | null; conta_nome?: string | null;
}): PessoaFunil => ({
  tipo: 'contato', id: c.id, nome: c.nome, email: c.email, whatsapp: c.whatsapp, cargo: c.cargo, empresa: c.conta_nome ?? null,
  conta_id: c.conta_id, contato_id: c.id, lead_id: null, aceita_marketing: c.aceita_marketing, consentimento_em: c.consentimento_em ?? null, dono: c.dono ?? null,
});
