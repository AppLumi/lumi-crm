// Empresas (contas) e seus contatos: domínio corporativo, achar a empresa de uma pessoa e vincular.
// Usado pelo servidor (captura do site) e pela tela (vínculo manual, importação, qualificação).
import type { SupabaseClient } from '@supabase/supabase-js';

/** Provedores de e-mail pessoal: o domínio não diz nada sobre a empresa. */
export const PROVEDORES_PESSOAIS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br', 'live.com', 'live.com.br', 'msn.com',
  'yahoo.com', 'yahoo.com.br', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com', 'r7.com', 'zipmail.com.br', 'oi.com.br',
  'yandex.com', 'mail.com', 'zoho.com', 'tutanota.com', 'hey.com',
]);

/** Domínio corporativo de um e-mail ("ana@acme.com.br" → "acme.com.br"); null para Gmail, Hotmail etc. */
export function dominioDoEmail(email: string | null | undefined): string | null {
  const m = String(email ?? '').trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) return null;
  const d = m[1].replace(/^www\./, '');
  return PROVEDORES_PESSOAIS.has(d) ? null : d;
}

/** Domínio de um site ("https://www.acme.com.br/contato" → "acme.com.br"). */
export function dominioDoSite(site: string | null | undefined): string | null {
  const s = String(site ?? '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) && !PROVEDORES_PESSOAIS.has(s) ? s : null;
}

/** Domínios de uma empresa: o do site e os dos e-mails corporativos dos contatos. */
export function dominiosDaConta(site: string | null | undefined, emails: (string | null | undefined)[]): string[] {
  const d = new Set<string>();
  const s = dominioDoSite(site);
  if (s) d.add(s);
  emails.forEach((e) => { const x = dominioDoEmail(e); if (x) d.add(x); });
  return [...d];
}

/** Escapa % e _ para usar um texto literal num ilike. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

export interface ContaResumo { id: string; nome: string; cnpj: string | null }

/** Empresas com esse domínio (por contato com e-mail @dominio ou pelo site). */
export async function contasPorDominio(db: SupabaseClient, dominio: string): Promise<ContaResumo[]> {
  const [ct, cs] = await Promise.all([
    db.from('contatos').select('conta_id, email').ilike('email', `%@${literal(dominio)}`).not('conta_id', 'is', null).limit(200),
    db.from('contas').select('id, nome, cnpj, site').ilike('site', `%${literal(dominio)}%`).limit(50),
  ]);
  const ids = new Set<string>();
  (ct.data ?? []).forEach((c: { conta_id: string; email: string }) => { if (dominioDoEmail(c.email) === dominio) ids.add(c.conta_id); });
  (cs.data ?? []).forEach((c: { id: string; site: string }) => { if (dominioDoSite(c.site) === dominio) ids.add(c.id); });
  if (!ids.size) return [];
  const { data } = await db.from('contas').select('id, nome, cnpj').in('id', [...ids]);
  return (data ?? []) as ContaResumo[];
}

/** Empresa de um lead quando dá para ter certeza: mesmo CNPJ ou um único dono do domínio. */
export async function contaCertaDoLead(db: SupabaseClient, l: { cnpj?: string | null; email?: string | null }): Promise<{ conta: ContaResumo; motivo: string } | null> {
  if (l.cnpj) {
    const { data } = await db.from('contas').select('id, nome, cnpj').eq('cnpj', l.cnpj).maybeSingle();
    if (data) return { conta: data as ContaResumo, motivo: 'mesmo CNPJ' };
  }
  const dominio = dominioDoEmail(l.email);
  if (!dominio) return null;
  const contas = await contasPorDominio(db, dominio);
  return contas.length === 1 ? { conta: contas[0], motivo: `mesmo domínio @${dominio}` } : null;
}

interface LeadVinculo {
  id: string; nome: string; email: string | null; whatsapp: string | null; cargo: string | null;
  aceita_marketing: boolean; consentimento_em?: string | null; contato_id?: string | null;
}

/**
 * Vincula um lead a uma empresa: ele vira (ou reaproveita) um contato dessa empresa e o histórico do lead passa a
 * aparecer na empresa. `moverContato`: se o e-mail já é contato de outra empresa, traz para esta (vínculo manual);
 * sem isso, deixa como está (vínculo automático não tira ninguém de onde a equipe colocou).
 */
export async function vincularLeadAConta(db: SupabaseClient, lead: LeadVinculo, conta: ContaResumo,
  opcoes: { autor?: string | null; motivo: string; moverContato: boolean }): Promise<{ contatoId: string | null; moveu: boolean }> {
  let contatoId: string | null = null, moveu = false;
  const email = lead.email?.trim().toLowerCase() || null;
  const { data: existente } = email
    ? await db.from('contatos').select('id, conta_id').ilike('email', literal(email)).maybeSingle()
    : lead.contato_id ? await db.from('contatos').select('id, conta_id').eq('id', lead.contato_id).maybeSingle() : { data: null };
  if (existente) {
    contatoId = existente.id;
    if (existente.conta_id !== conta.id && (opcoes.moverContato || !existente.conta_id)) {
      const r = await db.from('contatos').update({ conta_id: conta.id }).eq('id', existente.id);
      if (r.error) throw new Error(r.error.message);
      moveu = !!existente.conta_id;
    }
  } else {
    const r = await db.from('contatos').insert({
      conta_id: conta.id, nome: lead.nome, cargo: lead.cargo, email, whatsapp: lead.whatsapp,
      aceita_marketing: lead.aceita_marketing, consentimento_em: lead.consentimento_em ?? null, papel: 'outro',
    }).select('id').single();
    if (r.error) throw new Error(r.error.message);
    contatoId = r.data.id;
  }
  const r = await db.from('leads').update({ conta_id: conta.id, contato_id: contatoId }).eq('id', lead.id);
  if (r.error) throw new Error(r.error.message);
  await db.from('atividades').update({ conta_id: conta.id }).eq('lead_id', lead.id).is('oportunidade_id', null);
  await db.from('eventos').update({ conta_id: conta.id }).eq('lead_id', lead.id);
  await db.from('atividades').insert({
    tipo: 'sistema', titulo: `${lead.nome} vinculado(a) à empresa ${conta.nome}`, descricao: `Motivo: ${opcoes.motivo}.`,
    lead_id: lead.id, conta_id: conta.id, contato_id: contatoId, autor: opcoes.autor ?? null,
  });
  return { contatoId, moveu };
}
