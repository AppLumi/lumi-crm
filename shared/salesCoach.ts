// Organiza os campos que o Sales Coach grava no negócio (oportunidades.sales_coach) ou na empresa (contas.sales_coach).
// As chaves vêm do nome do campo (ex.: "Nota da reunião" → nota_da_reuniao); o nome e o tipo ficam em salescoach_campos.

export interface CampoSC { key: string; label: string; type: string }
export interface ItemSC { label: string; valor: string | number; tipo: string }
export interface ResumoSC {
  nota: number | null; temperatura: string | null; nivel: 'fria' | 'morna' | 'quente' | 'muito_quente' | null;
  resumo: string | null; dores: string | null; proximo: string | null; dataProximo: string | null;
  dataReuniao: string | null; fala: number | null; link: string | null; atualizado: string | null;
  criterios: ItemSC[]; outros: ItemSC[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'campo';

/** Campos conhecidos, pelo nome com que o Sales Coach os cria. */
const PAPEIS: Record<string, keyof ResumoSC> = {
  'nota da reuniao': 'nota', temperatura: 'temperatura', 'resumo da reuniao': 'resumo', 'dores identificadas': 'dores',
  'proximo passo': 'proximo', 'data do proximo passo': 'dataProximo', 'data da reuniao': 'dataReuniao',
  'fala de quem conduz (%)': 'fala', 'link da analise': 'link',
};

const vazio = (v: unknown) => v == null || (typeof v === 'string' && !v.trim());
const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function nivelTemperatura(t: string | null): ResumoSC['nivel'] {
  if (!t) return null;
  const n = norm(t);
  if (n.includes('muito')) return 'muito_quente';
  if (n.includes('quente')) return 'quente';
  if (n.includes('morna') || n.includes('morno')) return 'morna';
  if (n.includes('fria') || n.includes('frio')) return 'fria';
  return null;
}

export function organizarSalesCoach(valores: Record<string, unknown> | null | undefined, campos: CampoSC[]): ResumoSC | null {
  const v = valores ?? {};
  const r: ResumoSC = { nota: null, temperatura: null, nivel: null, resumo: null, dores: null, proximo: null, dataProximo: null,
    dataReuniao: null, fala: null, link: null, atualizado: typeof v.atualizado_em === 'string' ? v.atualizado_em : null, criterios: [], outros: [] };
  // campos sem cadastro (ex.: criados antes) ainda aparecem, com a chave como nome
  const porChave = new Map(campos.map((c) => [c.key, c]));
  for (const k of Object.keys(v)) if (k !== 'atualizado_em' && !porChave.has(k)) porChave.set(k, { key: k, label: k.replace(/_/g, ' '), type: 'text' });
  let algum = false;
  for (const c of porChave.values()) {
    const bruto = v[c.key];
    if (vazio(bruto)) continue;
    algum = true;
    const nome = norm(c.label);
    const papel = PAPEIS[nome] ?? Object.entries(PAPEIS).find(([l]) => slug(l) === c.key)?.[1];
    if (papel === 'nota' || papel === 'fala') { (r[papel] as number | null) = num(bruto); continue; }
    if (papel && papel !== 'criterios' && papel !== 'outros' && papel !== 'nivel') { (r[papel] as string | null) = String(bruto); continue; }
    if (nome.startsWith('criterio:') || c.key.startsWith('criterio_')) {
      r.criterios.push({ label: c.label.replace(/^crit[ée]rio:\s*/i, ''), valor: num(bruto) ?? String(bruto), tipo: 'number' });
      continue;
    }
    r.outros.push({ label: c.label.replace(/^info:\s*/i, ''), valor: typeof bruto === 'number' ? bruto : String(bruto), tipo: c.type });
  }
  if (!algum) return null;
  r.nivel = nivelTemperatura(r.temperatura);
  return r;
}

/** Temperatura do negócio para o card do funil (só o rótulo e o nível). */
export function temperaturaDe(valores: Record<string, unknown> | null | undefined, campos: CampoSC[]) {
  const c = campos.find((x) => norm(x.label) === 'temperatura') ?? { key: 'temperatura' };
  const t = valores?.[c.key];
  return typeof t === 'string' && t.trim() ? { rotulo: t, nivel: nivelTemperatura(t) } : null;
}
