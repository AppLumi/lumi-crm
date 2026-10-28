// Tabela de preços do Lumi (applumi.io/planos) e regras do gerador de propostas.
export type Plano = 'starter' | 'premium';

export interface Faixa {
  min: number;
  max: number; // Infinity na última
  starter: number;
  premium: number;
  implementacao: number;
}

export const FAIXAS: Faixa[] = [
  { min: 1, max: 30, starter: 9.9, premium: 29.9, implementacao: 700 },
  { min: 31, max: 50, starter: 9.9, premium: 29.9, implementacao: 900 },
  { min: 51, max: 200, starter: 7.9, premium: 25.9, implementacao: 1200 },
  { min: 201, max: 500, starter: 5.9, premium: 21.9, implementacao: 1500 },
  { min: 501, max: 1000, starter: 4.9, premium: 18.9, implementacao: 1900 },
  { min: 1001, max: 3000, starter: 3.9, premium: 15.9, implementacao: 2600 },
  { min: 3001, max: 5000, starter: 2.9, premium: 13.9, implementacao: 3500 },
  { min: 5001, max: Infinity, starter: 1.9, premium: 12.9, implementacao: 4500 },
];

export const LIMITE_DESCONTO_SEM_APROVACAO = 10;
export const LIMITE_DESCONTO = 20;
export const LIMITE_DESCONTO_IMPLEMENTACAO = 50;
export const VIDAS_SOB_APROVACAO = 5000;

const centavos = (v: number) => Math.round(v * 100) / 100;

export function faixaDe(vidas: number): Faixa {
  const f = FAIXAS.find((x) => vidas >= x.min && vidas <= x.max);
  if (!f) throw new Error('Número de vidas inválido');
  return f;
}

export interface Calculo {
  plano: Plano;
  vidas: number;
  faixa: Faixa;
  precoVida: number;
  mensalTabela: number; // já com o piso entre faixas
  pisoAplicado: boolean;
  descontoPct: number;
  mensal: number;
  implementacaoTabela: number;
  descontoImplementacaoPct: number;
  implementacao: number;
  primeiroAno: number;
  precisaAprovacao: boolean;
  motivosAprovacao: string[];
  pertoDaProximaFaixa: boolean;
}

/**
 * Piso entre faixas: o mensal nunca fica abaixo do teto da faixa anterior
 * (limite da faixa anterior × preço dela). Evita que mais vidas custem menos.
 */
export function calcular(plano: Plano, vidas: number, descontoPct = 0, descontoImplementacaoPct = 0): Calculo {
  if (!Number.isInteger(vidas) || vidas < 1) throw new Error('Informe um número inteiro de vidas maior que zero');
  if (descontoPct < 0 || descontoPct > LIMITE_DESCONTO) throw new Error(`Desconto entre 0 e ${LIMITE_DESCONTO}%`);
  if (descontoImplementacaoPct < 0 || descontoImplementacaoPct > LIMITE_DESCONTO_IMPLEMENTACAO)
    throw new Error(`Desconto na implementação entre 0 e ${LIMITE_DESCONTO_IMPLEMENTACAO}%`);
  const i = FAIXAS.findIndex((x) => vidas >= x.min && vidas <= x.max);
  const faixa = FAIXAS[i];
  const precoVida = faixa[plano];
  const bruto = centavos(vidas * precoVida);
  const anterior = i > 0 ? FAIXAS[i - 1] : null;
  const piso = anterior ? centavos(anterior.max * anterior[plano]) : 0;
  const mensalTabela = Math.max(bruto, piso);
  const mensal = centavos(mensalTabela * (1 - descontoPct / 100));
  const implementacao = centavos(faixa.implementacao * (1 - descontoImplementacaoPct / 100));
  const motivos: string[] = [];
  if (descontoPct > LIMITE_DESCONTO_SEM_APROVACAO) motivos.push(`desconto acima de ${LIMITE_DESCONTO_SEM_APROVACAO}%`);
  if (vidas > VIDAS_SOB_APROVACAO) motivos.push('mais de 5.000 vidas');
  return {
    plano, vidas, faixa, precoVida, mensalTabela, pisoAplicado: piso > bruto, descontoPct, mensal,
    implementacaoTabela: faixa.implementacao, descontoImplementacaoPct, implementacao,
    primeiroAno: centavos(mensal * 12 + implementacao),
    precisaAprovacao: motivos.length > 0, motivosAprovacao: motivos,
    pertoDaProximaFaixa: Number.isFinite(faixa.max) && faixa.max - vidas < Math.ceil(faixa.max * 0.1),
  };
}

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const rotuloFaixa = (f: Faixa) =>
  Number.isFinite(f.max) ? `${f.min.toLocaleString('pt-BR')} a ${f.max.toLocaleString('pt-BR')}` : `acima de ${(f.min - 1).toLocaleString('pt-BR')}`;
