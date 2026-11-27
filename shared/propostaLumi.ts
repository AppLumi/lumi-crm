// Proposta do Lumi: slides que a pessoa escolhe para a apresentação e serviços adicionais (por ora, o workshop NR-1).
// Puro: usado pelo gerador, pela prévia, pela página pública e pelos testes.
type Plano = 'starter' | 'premium';

export interface ItemServico {
  chave: string;
  nome: string;
  unidade: string; // "turma" / "turmas"
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  detalhe: string | null; // ex.: "até 25 líderes por turma, online"
}

export interface ServicoCatalogo {
  chave: string;
  nome: string;
  resumo: string;
  unidade: [singular: string, plural: string];
}

/** Serviços que entram na proposta do Lumi. Os outros do cardápio entram aqui depois, já com o layout do Lumi. */
export const SERVICOS: ServicoCatalogo[] = [
  {
    chave: 'workshop_nr1_liderancas',
    nome: 'Workshop NR-1 aplicada às lideranças',
    resumo: '6 horas em 3 encontros de 2h, presencial ou online, para lideranças formais e potenciais.',
    unidade: ['turma', 'turmas'],
  },
];

export const servicoDe = (chave: string) => SERVICOS.find((s) => s.chave === chave) ?? null;

export interface SlideInfo {
  chave: string;
  nome: string;
  padrao: boolean;
  fixo?: boolean; // sempre aparece (capa e investimento)
  premium?: boolean; // só faz sentido no Premium (o Starter não tem o app)
  servico?: string; // só aparece quando o serviço está na proposta
}

/** Ordem da apresentação. */
export const SLIDES: SlideInfo[] = [
  { chave: 'capa', nome: 'Capa', padrao: true, fixo: true },
  { chave: 'nr1', nome: 'O que mudou na NR-1', padrao: true },
  { chave: 'custo', nome: 'O custo de não agir (com o tamanho do time)', padrao: true },
  { chave: 'ideia', nome: 'Saúde mental e performance', padrao: false },
  { chave: 'produto', nome: 'Um só produto: painel e aplicativo', padrao: true },
  { chave: 'empresa', nome: 'Painel da empresa', padrao: true },
  { chave: 'colaborador', nome: 'Aplicativo do colaborador', padrao: true, premium: true },
  { chave: 'ciclo', nome: 'Como funciona: do diagnóstico ao cuidado', padrao: true },
  { chave: 'escopo', nome: 'O que o Lumi entrega na NR-1', padrao: true },
  { chave: 'ws_abertura', nome: 'Workshop: abertura', padrao: true, servico: 'workshop_nr1_liderancas' },
  { chave: 'ws_objetivos', nome: 'Workshop: objetivos', padrao: true, servico: 'workshop_nr1_liderancas' },
  { chave: 'ws_conteudo', nome: 'Workshop: conteúdo', padrao: true, servico: 'workshop_nr1_liderancas' },
  { chave: 'ws_escopo', nome: 'Workshop: o que está incluído', padrao: true, servico: 'workshop_nr1_liderancas' },
  { chave: 'investimento', nome: 'Investimento', padrao: true, fixo: true },
  { chave: 'proximos', nome: 'Próximos passos', padrao: true },
];

const disponivel = (s: SlideInfo, plano: Plano, servicos: string[]) =>
  (!s.premium || plano === 'premium') && (!s.servico || servicos.includes(s.servico));

/** Slides que podem ser escolhidos para este plano e estes serviços (sem os fixos). */
export const slidesEscolhiveis = (plano: Plano, servicos: string[]) =>
  SLIDES.filter((s) => !s.fixo && disponivel(s, plano, servicos));

/**
 * Slides da apresentação, na ordem. `escolha` guarda só o que a pessoa mudou em relação ao padrão.
 * Capa e investimento sempre aparecem; o app some no Starter; slides de serviço só com o serviço.
 */
export function montarSlides(plano: Plano, servicos: string[], escolha: Record<string, boolean> = {}): string[] {
  return SLIDES.filter((s) => disponivel(s, plano, servicos) && (s.fixo || (escolha[s.chave] ?? s.padrao))).map((s) => s.chave);
}

/** Slides que a página mostra. Propostas antigas (sem apresentação) mostram só capa e investimento. */
export function slidesVisiveis(salvos: string[] | null | undefined, plano: Plano, servicos: string[]): string[] {
  const set = new Set(salvos ?? []);
  return SLIDES.filter((s) => disponivel(s, plano, servicos) && (s.fixo || set.has(s.chave))).map((s) => s.chave);
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function itemServico(chave: string, quantidade: number, valorUnitario: number, detalhe?: string | null): ItemServico {
  const s = servicoDe(chave);
  if (!s) throw new Error('Serviço desconhecido');
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) throw new Error(`Informe de 1 a 100 ${s.unidade[1]}`);
  if (!(valorUnitario > 0) || valorUnitario > 10_000_000) throw new Error(`Informe o valor por ${s.unidade[0]}`);
  return {
    chave, nome: s.nome, unidade: quantidade === 1 ? s.unidade[0] : s.unidade[1], quantidade,
    valor_unitario: centavos(valorUnitario), valor_total: centavos(quantidade * valorUnitario), detalhe: detalhe?.trim() || null,
  };
}

export const totalServicos = (itens: ItemServico[]) => centavos(itens.reduce((s, i) => s + Number(i.valor_total), 0));

/** Lê a coluna jsonb com segurança (dado vindo do banco). */
export function lerServicos(x: unknown): ItemServico[] {
  if (!Array.isArray(x)) return [];
  return x.filter((i): i is ItemServico => !!i && typeof i === 'object' && typeof (i as ItemServico).nome === 'string'
    && Number.isFinite(Number((i as ItemServico).valor_total)));
}

/**
 * Custo de não agir, com as premissas do site (applumi.io): presenteísmo de 3,4% da folha (20% das pessoas × 7,5h de 44h),
 * afastamentos (1,2% do time ao ano × 15 dias pagos) e rotatividade (saídas × 50% do salário anual × 15% atribuível).
 * Sem multa na conta: as sanções ligadas aos fatores psicossociais estão suspensas no STF (ADPF 1316).
 */
export function custoNaoAgir(vidas: number, salario = 4000, rotatividade = 0.3) {
  const folha = vidas * salario * 12;
  const presenteismo = folha * 0.034;
  const afastamentos = vidas * 0.012 * salario * 0.5;
  const saidas = vidas * rotatividade * (salario * 12 * 0.5) * 0.15;
  return { presenteismo, afastamentos, rotatividade: saidas, total: presenteismo + afastamentos + saidas, salario, taxaRotatividade: rotatividade };
}
