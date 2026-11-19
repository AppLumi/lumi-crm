// Funis personalizados: modelos prontos, campos próprios e validação do que chega (tela e formulário público).

export type TipoCampo = 'texto' | 'texto_longo' | 'numero' | 'data' | 'opcoes' | 'multiplas' | 'sim_nao' | 'link';
export type TipoEtapa = 'aberta' | 'ganha' | 'perdida';

export interface CampoFunil {
  chave: string; rotulo: string; tipo: TipoCampo;
  obrigatorio?: boolean; publico?: boolean; opcoes?: string[]; ajuda?: string;
}
export interface EtapaModelo { nome: string; tipo: TipoEtapa; prazo_dias?: number | null }
export interface ModeloFunil {
  id: string; nome: string; descricao: string; etapas: EtapaModelo[]; campos: CampoFunil[];
  mostra_valor: boolean; pede_empresa: boolean;
  formulario?: { publico: boolean; slug: string; titulo: string; texto: string; obrigado: string };
}

export const TIPOS_CAMPO: Record<TipoCampo, string> = {
  texto: 'Texto curto', texto_longo: 'Texto longo', numero: 'Número', data: 'Data',
  opcoes: 'Escolha uma opção', multiplas: 'Várias opções', sim_nao: 'Sim ou não', link: 'Link',
};
export const TIPOS_ETAPA: Record<TipoEtapa, string> = { aberta: 'Em andamento', ganha: 'Concluída (ganho)', perdida: 'Encerrada (perda)' };

export const chaveDe = (rotulo: string) =>
  rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'campo';
export const slugDe = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const MODELOS_FUNIL: ModeloFunil[] = [
  {
    id: 'parceiros', nome: 'Parceiros', mostra_valor: false, pede_empresa: true,
    descricao: 'Consultorias, corretoras e clínicas que indicam ou revendem o Lumi.',
    etapas: [
      { nome: 'Mapeado', tipo: 'aberta' }, { nome: 'Primeira conversa', tipo: 'aberta', prazo_dias: 14 },
      { nome: 'Proposta de parceria', tipo: 'aberta', prazo_dias: 14 }, { nome: 'Contrato em assinatura', tipo: 'aberta', prazo_dias: 10 },
      { nome: 'Parceiro ativo', tipo: 'ganha' }, { nome: 'Não seguiu', tipo: 'perdida' },
    ],
    campos: [
      { chave: 'tipo_parceiro', rotulo: 'Tipo de parceiro', tipo: 'opcoes', opcoes: ['Consultoria de RH', 'Corretora de benefícios', 'Clínica de SST', 'Contabilidade', 'Associação ou sindicato', 'Outro'] },
      { chave: 'modelo', rotulo: 'Modelo da parceria', tipo: 'opcoes', opcoes: ['Indicação', 'Revenda', 'Co-venda', 'Conteúdo e eventos'] },
      { chave: 'comissao_pct', rotulo: 'Comissão (%)', tipo: 'numero' },
      { chave: 'carteira', rotulo: 'Empresas na carteira', tipo: 'numero' },
      { chave: 'regiao', rotulo: 'Região de atuação', tipo: 'texto' },
    ],
  },
  {
    id: 'b2b', nome: 'B2B', mostra_valor: true, pede_empresa: true,
    descricao: 'Funil de vendas para empresas de um negócio ou produto específico.',
    etapas: [
      { nome: 'Novo', tipo: 'aberta', prazo_dias: 2 }, { nome: 'Qualificação', tipo: 'aberta', prazo_dias: 7 },
      { nome: 'Reunião feita', tipo: 'aberta', prazo_dias: 7 }, { nome: 'Proposta enviada', tipo: 'aberta', prazo_dias: 10 },
      { nome: 'Negociação', tipo: 'aberta', prazo_dias: 14 }, { nome: 'Ganho', tipo: 'ganha' }, { nome: 'Perdido', tipo: 'perdida' },
    ],
    campos: [
      { chave: 'segmento', rotulo: 'Segmento', tipo: 'texto' },
      { chave: 'colaboradores', rotulo: 'Colaboradores', tipo: 'numero' },
      { chave: 'decisor', rotulo: 'Decisor', tipo: 'texto' },
      { chave: 'proximo_passo', rotulo: 'Próximo passo', tipo: 'texto' },
    ],
  },
  {
    id: 'especialistas', nome: 'Especialistas de telepsicologia', mostra_valor: false, pede_empresa: false,
    descricao: 'Credenciamento de psicólogas e psicólogos que vão atender pela telepsicologia do Lumi.',
    etapas: [
      { nome: 'Cadastro recebido', tipo: 'aberta', prazo_dias: 3 }, { nome: 'Análise de documentos', tipo: 'aberta', prazo_dias: 5 },
      { nome: 'Entrevista', tipo: 'aberta', prazo_dias: 7 }, { nome: 'Contrato e integração', tipo: 'aberta', prazo_dias: 7 },
      { nome: 'Credenciado', tipo: 'ganha' }, { nome: 'Não aprovado', tipo: 'perdida' },
    ],
    campos: [
      { chave: 'crp', rotulo: 'CRP (número e região)', tipo: 'texto', obrigatorio: true, publico: true, ajuda: 'Ex.: 07/12345' },
      { chave: 'epsi', rotulo: 'Tem cadastro ativo no e-Psi (CFP)?', tipo: 'sim_nao', obrigatorio: true, publico: true },
      { chave: 'abordagem', rotulo: 'Abordagem principal', tipo: 'opcoes', obrigatorio: true, publico: true, opcoes: ['TCC', 'Psicanálise', 'Humanista', 'Sistêmica', 'ACT', 'Gestalt', 'Analítica', 'Outra'] },
      { chave: 'especialidades', rotulo: 'Temas que atende', tipo: 'multiplas', publico: true, opcoes: ['Ansiedade', 'Depressão', 'Burnout e estresse no trabalho', 'Luto', 'Relacionamentos', 'Dependência química', 'Infância e adolescência', 'LGBTQIA+', 'Neurodivergência'] },
      { chave: 'anos_experiencia', rotulo: 'Anos de experiência clínica', tipo: 'numero', obrigatorio: true, publico: true },
      { chave: 'horas_semana', rotulo: 'Horas por semana disponíveis', tipo: 'numero', publico: true },
      { chave: 'cidade_uf', rotulo: 'Cidade/UF', tipo: 'texto', publico: true },
      { chave: 'curriculo', rotulo: 'Currículo ou LinkedIn', tipo: 'link', publico: true, ajuda: 'Link para o currículo (Drive, LinkedIn…)' },
      { chave: 'apresentacao', rotulo: 'Conte um pouco sobre você', tipo: 'texto_longo', publico: true },
      { chave: 'avaliacao', rotulo: 'Avaliação da entrevista', tipo: 'texto_longo', publico: false },
    ],
    formulario: {
      publico: true, slug: 'especialistas',
      titulo: 'Seja especialista da telepsicologia Lumi',
      texto: 'Atenda colaboradores das empresas parceiras do Lumi pela telepsicologia. Preencha seu cadastro: nossa equipe analisa e entra em contato.',
      obrigado: 'Recebemos seu cadastro. Nossa equipe vai analisar e retornar pelo e-mail ou WhatsApp informado.',
    },
  },
  {
    id: 'branco', nome: 'Em branco', mostra_valor: true, pede_empresa: true,
    descricao: 'Comece com quatro etapas e monte o resto.',
    etapas: [{ nome: 'Novo', tipo: 'aberta' }, { nome: 'Em andamento', tipo: 'aberta' }, { nome: 'Concluído', tipo: 'ganha' }, { nome: 'Perdido', tipo: 'perdida' }],
    campos: [],
  },
];

const URL_OK = /^https?:\/\/[^\s]+\.[^\s]+$/i;

/**
 * Valida e normaliza os valores dos campos próprios. `publico`: só aceita campos marcados para o formulário.
 * Devolve os dados limpos e a lista de erros (rótulo + motivo).
 */
export function validarDados(campos: CampoFunil[], entrada: Record<string, unknown>, opcoes: { publico?: boolean } = {}): { dados: Record<string, unknown>; erros: string[] } {
  const dados: Record<string, unknown> = {};
  const erros: string[] = [];
  for (const c of campos) {
    if (opcoes.publico && !c.publico) continue;
    const bruto = entrada[c.chave];
    const vazio = bruto == null || bruto === '' || (Array.isArray(bruto) && bruto.length === 0);
    if (vazio) { if (c.obrigatorio) erros.push(`${c.rotulo}: obrigatório`); continue; }
    switch (c.tipo) {
      case 'numero': {
        const n = Number(String(bruto).replace(',', '.'));
        if (!Number.isFinite(n)) erros.push(`${c.rotulo}: use só números`); else dados[c.chave] = n;
        break;
      }
      case 'data': {
        const s = String(bruto).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) erros.push(`${c.rotulo}: data inválida`); else dados[c.chave] = s;
        break;
      }
      case 'sim_nao':
        dados[c.chave] = bruto === true || bruto === 'true' || bruto === 'sim';
        break;
      case 'opcoes': {
        const s = String(bruto);
        if (c.opcoes?.length && !c.opcoes.includes(s)) erros.push(`${c.rotulo}: escolha uma das opções`); else dados[c.chave] = s.slice(0, 200);
        break;
      }
      case 'multiplas': {
        const lista = (Array.isArray(bruto) ? bruto : [bruto]).map(String);
        const validas = c.opcoes?.length ? lista.filter((x) => c.opcoes!.includes(x)) : lista;
        if (!validas.length && c.obrigatorio) erros.push(`${c.rotulo}: escolha ao menos uma opção`); else dados[c.chave] = [...new Set(validas)].slice(0, 30);
        break;
      }
      case 'link': {
        let s = String(bruto).trim();
        if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
        if (!URL_OK.test(s)) erros.push(`${c.rotulo}: link inválido`); else dados[c.chave] = s.slice(0, 500);
        break;
      }
      default:
        dados[c.chave] = String(bruto).trim().slice(0, c.tipo === 'texto_longo' ? 5000 : 300);
    }
  }
  return { dados, erros };
}

/** Texto legível de um valor de campo (cartão, e-mail de aviso). */
export function valorLegivel(c: CampoFunil, v: unknown): string {
  if (v == null || v === '') return '—';
  if (c.tipo === 'sim_nao') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.join(', ');
  if (c.tipo === 'data') return String(v).split('-').reverse().join('/');
  return String(v);
}
