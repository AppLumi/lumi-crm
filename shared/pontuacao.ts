// Nota de perfil (fit) do lead, de 0 a 100. A nota de interesse vem dos eventos (view v_leads, meia-vida de 30 dias).
export interface DadosPerfil {
  colaboradores?: number | null;
  cargo?: string | null;
  cnae?: string | null;
  cnpjValido?: boolean;
  temWhatsapp?: boolean;
}

// setores com alta exposição a riscos psicossociais (seções/divisões CNAE)
const CNAE_ALTO = [/^1|^2|^3/, /^49|^50|^51|^52|^53/, /^86|^87|^88/, /^64|^65|^66/, /^47/, /^82/, /^84/, /^85/];

export function notaPerfil(d: DadosPerfil): number {
  let n = 0;
  const c = d.colaboradores ?? null;
  n += c == null ? 10 : c >= 1000 ? 40 : c >= 200 ? 32 : c >= 51 ? 24 : c >= 30 ? 14 : 6;
  const cargo = (d.cargo ?? '').toLowerCase();
  if (/(rh|recursos humanos|pessoas|people|gente|sesmt|seguran[cç]a do trabalho|sst|ceo|diretor|diretora|s[oó]ci|presidente|founder|fundador|dho|cultura)/.test(cargo)) n += 30;
  else if (/(gerente|gestor|gestora|coordenador|coordenadora|head|l[ií]der|supervisor)/.test(cargo)) n += 18;
  else if (cargo) n += 8;
  const cnae = (d.cnae ?? '').replace(/\D/g, '');
  if (cnae) n += CNAE_ALTO.some((r) => r.test(cnae)) ? 15 : 8;
  if (d.cnpjValido) n += 10;
  if (d.temWhatsapp) n += 5;
  return Math.min(100, n);
}

/** Menor número de uma faixa de porte digitada como texto ("51 a 200", "Mais de 1.000"). */
export function pisoDaFaixa(faixa: string | null | undefined): number | null {
  const m = (faixa ?? '').match(/\d[\d.]*/);
  return m ? Number(m[0].replace(/\./g, '')) || null : null;
}

export function cnpjValido(cnpj: string): boolean {
  const s = cnpj.replace(/\D/g, '');
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((a, ch, i) => a + Number(ch) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(s.slice(0, 12));
  const d2 = dv(s.slice(0, 12) + d1);
  return s.endsWith(`${d1}${d2}`);
}

export const PESOS_EVENTOS: Record<string, number> = {
  demo_solicitada: 40, presenca_evento: 25, formulario_contato: 25, inscricao_evento: 20, download_material: 15,
  whatsapp_resposta: 15, visita_planos: 10, email_clique: 8, visita_site: 3, email_aberto: 3,
};
