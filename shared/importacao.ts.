/** Leitura de listas coladas de planilhas (CSV, ponto e vírgula ou tabulação) para importar leads.
 *  Se a primeira linha tiver títulos (Nome, E-mail, Celular…), as colunas são achadas pelo título,
 *  em qualquer ordem. Sem títulos, vale a ordem: nome; e-mail; WhatsApp; empresa; cargo; colaboradores. */

export type CampoLead = 'nome' | 'email' | 'whatsapp' | 'empresa' | 'cargo' | 'colaboradores';
export interface LinhaImportada { nome: string; email: string | null; whatsapp: string | null; empresa: string | null; cargo: string | null; colaboradores: number | null }
export interface Leitura {
  linhas: LinhaImportada[];
  /** título da planilha → campo do CRM (vazio quando a lista não tinha títulos) */
  colunas: { titulo: string; campo: CampoLead }[];
  porTitulo: boolean;
  /** linhas puladas e o motivo */
  puladas: { linha: number; motivo: string }[];
}

const ORDEM: CampoLead[] = ['nome', 'email', 'whatsapp', 'empresa', 'cargo', 'colaboradores'];

const SINONIMOS: Record<CampoLead, string[]> = {
  nome: ['nome', 'nome completo', 'name', 'full name', 'participante', 'contato'],
  email: ['email', 'e-mail', 'e mail', 'mail', 'email corporativo', 'e-mail corporativo'],
  whatsapp: ['whatsapp', 'whats', 'celular', 'telefone', 'fone', 'telefone celular', 'phone', 'mobile', 'contato telefonico'],
  empresa: ['empresa', 'company', 'organizacao', 'instituicao', 'razao social', 'nome da empresa'],
  cargo: ['cargo', 'funcao', 'job title', 'title', 'posicao'],
  colaboradores: ['colaboradores', 'funcionarios', 'n de colaboradores', 'numero de colaboradores', 'porte', 'vidas', 'tamanho da empresa'],
};

const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[º°ª.]/g, '').replace(/\s+/g, ' ').trim();

function campoDoTitulo(t: string): CampoLead | null {
  const n = normaliza(t);
  for (const c of ORDEM) if (SINONIMOS[c].includes(n)) return c;
  return null;
}

/** Divide o texto em células, respeitando aspas ("Silva; Souza" fica numa célula só). */
export function celulas(texto: string): string[][] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const prim = linhas[0];
  const sep = prim.includes('\t') ? '\t' : prim.includes(';') ? ';' : ',';
  return linhas.map((l) => {
    const out: string[] = [];
    let atual = '', aspas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (aspas && l[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
      else if (ch === sep && !aspas) { out.push(atual.trim()); atual = ''; }
      else atual += ch;
    }
    out.push(atual.trim());
    return out;
  });
}

/** Nome que na verdade é data/hora ou título: sinal de coluna trocada. */
export const nomeSuspeito = (nome: string | null | undefined) =>
  /^\s*("?\d{1,2}\/\d{1,2}(\/\d{2,4})?(\s+\d{1,2}:\d{2}(:\d{2})?)?"?|"?data"?)\s*$/i.test(nome ?? '');

export function lerLista(texto: string): Leitura {
  const cel = celulas(texto);
  const puladas: Leitura['puladas'] = [];
  if (!cel.length) return { linhas: [], colunas: [], porTitulo: false, puladas };

  const mapa = cel[0].map(campoDoTitulo);
  const achados = new Set(mapa.filter(Boolean));
  const porTitulo = achados.has('nome') && (achados.has('email') || achados.has('whatsapp'));
  const idx: Partial<Record<CampoLead, number>> = {};
  if (porTitulo) mapa.forEach((c, i) => { if (c && idx[c] === undefined) idx[c] = i; });
  else ORDEM.forEach((c, i) => { idx[c] = i; });
  const colunas = porTitulo
    ? ORDEM.filter((c) => idx[c] !== undefined).map((c) => ({ titulo: cel[0][idx[c]!], campo: c }))
    : [];
  const corpo = porTitulo ? cel.slice(1) : cel;
  const inicio = porTitulo ? 2 : 1;

  const linhas: LinhaImportada[] = [];
  corpo.forEach((c, k) => {
    const v = (campo: CampoLead) => (idx[campo] !== undefined ? (c[idx[campo]!] ?? '').trim() : '');
    const nome = v('nome').replace(/\s+/g, ' ');
    if (!porTitulo && k === 0 && /^nome$/i.test(nome)) return; // título "nome;email;…" na ordem padrão
    const email = v('email').toLowerCase();
    const whatsapp = v('whatsapp').replace(/\D/g, '');
    if (!nome) { puladas.push({ linha: k + inicio, motivo: 'sem nome' }); return; }
    if (nomeSuspeito(nome)) { puladas.push({ linha: k + inicio, motivo: `nome parece data ("${nome}"): confira a ordem das colunas` }); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { puladas.push({ linha: k + inicio, motivo: `e-mail inválido ("${email}")` }); return; }
    if (!email && !whatsapp) { puladas.push({ linha: k + inicio, motivo: 'sem e-mail e sem WhatsApp' }); return; }
    linhas.push({
      nome, email: email || null, whatsapp: whatsapp || null,
      empresa: v('empresa') || null, cargo: v('cargo') || null,
      colaboradores: Number(v('colaboradores').replace(/\D/g, '')) || null,
    });
  });
  return { linhas, colunas, porTitulo, puladas };
}
