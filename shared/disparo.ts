// Regras do disparo em massa de e-mail: quem recebe, quem fica de fora e como o texto é personalizado.
// Usado pela tela (prévia) e pelo servidor (envio), para os dois contarem igual.

export const LIMITE_DISPARO = 1000;
export const VARIAVEIS_DISPARO = ['primeiro_nome', 'nome', 'empresa', 'remetente'] as const;

export interface LeadDisparo {
  id: string; nome: string; email: string | null; empresa: string | null;
  status: string; aceita_marketing: boolean;
}

export type MotivoFora = 'sem_email' | 'descadastrado' | 'sem_aceite' | 'descartado' | 'repetido';
export const NOMES_MOTIVO: Record<MotivoFora, string> = {
  sem_email: 'sem e-mail válido',
  descadastrado: 'pediram para não receber',
  sem_aceite: 'não autorizaram conteúdos',
  descartado: 'descartados',
  repetido: 'e-mail repetido na seleção',
};

const emailOk = (v: string | null | undefined): v is string => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const primeiro = (n: string) => n.trim().split(/\s+/)[0] ?? '';
const capitaliza = (s: string) => (s && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);

export function separarDestinatarios(
  leads: LeadDisparo[],
  opcoes: { descadastrados: Set<string>; soComAceite: boolean },
): { enviar: LeadDisparo[]; fora: Record<MotivoFora, number> } {
  const fora: Record<MotivoFora, number> = { sem_email: 0, descadastrado: 0, sem_aceite: 0, descartado: 0, repetido: 0 };
  const vistos = new Set<string>();
  const enviar: LeadDisparo[] = [];
  for (const l of leads) {
    const email = l.email?.trim().toLowerCase() ?? '';
    if (!emailOk(email)) { fora.sem_email++; continue; }
    if (opcoes.descadastrados.has(email) || opcoes.descadastrados.has(l.id)) { fora.descadastrado++; continue; }
    if (l.status === 'descartado') { fora.descartado++; continue; }
    if (opcoes.soComAceite && !l.aceita_marketing) { fora.sem_aceite++; continue; }
    if (vistos.has(email)) { fora.repetido++; continue; }
    vistos.add(email);
    enviar.push({ ...l, email });
  }
  return { enviar, fora };
}

export function variaveisDoLead(l: Pick<LeadDisparo, 'nome' | 'empresa'>, remetente: string): Record<string, string> {
  return {
    primeiro_nome: capitaliza(primeiro(l.nome)),
    nome: l.nome.trim(),
    empresa: l.empresa?.trim() || 'sua empresa',
    remetente,
  };
}

export const preencher = (t: string, v: Record<string, string>) =>
  t.replace(/\{\{\s*(\w+)\s*\}\}/g, (todo, k: string) => (k in v ? v[k] : todo));

/** Problemas que impedem o disparo: variáveis que não existem no envio em massa e trechos [entre colchetes]. */
export function problemasDoTexto(assunto: string, corpo: string): string[] {
  const p: string[] = [];
  if (!assunto.trim()) p.push('Falta o assunto');
  if (!corpo.trim()) p.push('Falta a mensagem');
  const desconhecidas = [...new Set([...`${assunto}\n${corpo}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))]
    .filter((k) => !(VARIAVEIS_DISPARO as readonly string[]).includes(k));
  if (desconhecidas.length) p.push(`No envio em massa só valem ${VARIAVEIS_DISPARO.map((v) => `{{${v}}}`).join(', ')}. Troque ${desconhecidas.map((k) => `{{${k}}}`).join(', ')}`);
  if (/\[[^\]\n]+\]/.test(`${assunto}\n${corpo}`)) p.push('Troque os trechos entre [colchetes] antes de enviar');
  return p;
}
