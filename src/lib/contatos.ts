// Contatos: pessoas de listas de prospecção, frias ou importadas (não são leads).
// Lead é só quem converteu (site, formulário, anúncio) ou foi cadastrado à mão como lead.
import { ok, supabase } from './supabase';
import { contasPorDominio, dominioDoEmail } from '../../shared/empresas';
import type { Lead } from './tipos';

const literal = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

/** Insere contatos; se a migração 0003 (origem/evento/dono) ainda não rodou, grava sem esses campos. */
export async function inserirContatos(linhas: Record<string, unknown>[]): Promise<{ id: string; email: string | null }[]> {
  if (!linhas.length) return [];
  const r = await supabase.from('contatos').insert(linhas).select('id, email');
  if (!r.error) return (r.data ?? []) as { id: string; email: string | null }[];
  if (!/origem|evento|dono/.test(r.error.message)) throw new Error(r.error.message);
  const sem = linhas.map(({ origem: _o, evento: _e, dono: _d, ...resto }) => resto);
  return (ok(await supabase.from('contatos').insert(sem).select('id, email')) ?? []) as { id: string; email: string | null }[];
}

/** Acha (ou cria) a empresa pelo nome, CNPJ ou domínio do e-mail. Guarda em cache por nome na mesma importação. */
export async function empresaPara(dados: { empresa?: string | null; cnpj?: string | null; email?: string | null; colaboradores?: number | null; origem?: string | null; dono?: string | null },
  cache: Map<string, string | null> = new Map()): Promise<string | null> {
  const nome = (dados.empresa ?? '').trim();
  const chave = nome.toLowerCase();
  if (chave && cache.has(chave)) return cache.get(chave)!;
  let id: string | null = null;
  if (dados.cnpj) {
    const { data } = await supabase.from('contas').select('id').eq('cnpj', dados.cnpj).maybeSingle();
    id = (data as { id: string } | null)?.id ?? null;
  }
  if (!id && nome) {
    const { data } = await supabase.from('contas').select('id').ilike('nome', literal(nome)).limit(1);
    id = (data as { id: string }[] | null)?.[0]?.id ?? null;
  }
  if (!id) {
    const dom = dominioDoEmail(dados.email);
    if (dom) { const cs = await contasPorDominio(supabase, dom); if (cs.length === 1) id = cs[0].id; }
  }
  if (!id && nome) {
    const r = ok(await supabase.from('contas').insert({ nome, cnpj: dados.cnpj || null, colaboradores: dados.colaboradores ?? null, origem: dados.origem ?? 'importacao', dono: dados.dono ?? null }).select('id').single());
    id = (r as { id: string }).id;
  }
  if (chave) cache.set(chave, id);
  return id;
}

/** Transforma leads (ex.: listas importadas antes) em contatos: ficam na empresa e saem da lista de leads. */
export async function leadsParaContatos(leads: Lead[], autor: string | null): Promise<{ convertidos: number; pulados: number }> {
  const cache = new Map<string, string | null>();
  let convertidos = 0, pulados = 0;
  for (const l of leads) {
    if (l.oportunidade_id) { pulados++; continue; }
    const contaId = l.conta_id ?? await empresaPara({ empresa: l.empresa, cnpj: l.cnpj, email: l.email, colaboradores: l.colaboradores, origem: l.origem, dono: l.dono }, cache);
    let contatoId = l.contato_id;
    if (!contatoId && l.email) {
      const { data } = await supabase.from('contatos').select('id, conta_id').ilike('email', literal(l.email)).maybeSingle();
      if (data) {
        contatoId = (data as { id: string }).id;
        if (!(data as { conta_id: string | null }).conta_id && contaId) await supabase.from('contatos').update({ conta_id: contaId }).eq('id', contatoId);
      }
    }
    if (!contatoId) {
      const [c] = await inserirContatos([{
        conta_id: contaId, nome: l.nome, cargo: l.cargo, email: l.email?.toLowerCase() ?? null, whatsapp: l.whatsapp, aceita_marketing: l.aceita_marketing,
        consentimento_em: (l as Lead & { consentimento_em?: string | null }).consentimento_em ?? null, papel: 'outro', origem: l.origem, evento: l.evento, dono: l.dono,
      }]);
      contatoId = c.id;
    }
    ok(await supabase.from('leads').update({ status: 'convertido', conta_id: contaId, contato_id: contatoId }).eq('id', l.id));
    if (contaId) await supabase.from('atividades').update({ conta_id: contaId }).eq('lead_id', l.id).is('conta_id', null);
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: 'Lead transformado em contato', lead_id: l.id, conta_id: contaId, contato_id: contatoId, autor });
    convertidos++;
  }
  return { convertidos, pulados };
}
