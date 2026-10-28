import { describe, it, expect } from 'vitest';
import { calcular } from '../shared/precos.js';
import { cnpjValido, notaPerfil, pisoDaFaixa } from '../shared/pontuacao.js';

describe('preços', () => {
  it('bate com a calculadora do site', () => {
    expect(calcular('starter', 30).primeiroAno).toBe(4264);
    expect(calcular('premium', 30).primeiroAno).toBe(11464);
    expect(calcular('starter', 200).primeiroAno).toBe(20160);
    expect(calcular('premium', 500).primeiroAno).toBe(132900);
    expect(calcular('starter', 1000).primeiroAno).toBe(60700);
    expect(calcular('premium', 3000).primeiroAno).toBe(575000);
  });
  it('aplica o piso entre faixas', () => {
    const c = calcular('starter', 51);
    expect(c.mensalTabela).toBe(495);
    expect(c.pisoAplicado).toBe(true);
    expect(calcular('starter', 5200).mensalTabela).toBe(14500); // piso: 5.000 × 2,90
  });
  it('exige aprovação acima de 10% ou de 5.000 vidas', () => {
    expect(calcular('premium', 300, 10).precisaAprovacao).toBe(false);
    expect(calcular('premium', 300, 12).precisaAprovacao).toBe(true);
    expect(calcular('premium', 6000).precisaAprovacao).toBe(true);
    expect(() => calcular('premium', 300, 25)).toThrow();
  });
});

describe('pontuação', () => {
  it('valida CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
  });
  it('dá nota alta para RH de empresa grande', () => {
    expect(notaPerfil({ colaboradores: 1500, cargo: 'Diretora de RH', cnae: '8610101', cnpjValido: true, temWhatsapp: true })).toBe(100);
    expect(notaPerfil({ colaboradores: 10, cargo: 'estagiário' })).toBe(14);
  });
});

describe('porte informado em faixa no site', () => {
  it('usa o menor número da faixa só para a nota', () => {
    expect(['1 a 50', '51 a 200', '201 a 500', '501 a 1.000', 'Mais de 1.000'].map(pisoDaFaixa)).toEqual([1, 51, 201, 501, 1000]);
    expect(pisoDaFaixa('')).toBeNull();
    expect(notaPerfil({ colaboradores: pisoDaFaixa('Mais de 1.000') })).toBe(40);
    expect(notaPerfil({ colaboradores: pisoDaFaixa('201 a 500') })).toBe(32);
  });
});
