import { describe, expect, it } from 'vitest';
import { MODELOS_FUNIL, chaveDe, slugDe, validarDados, valorLegivel, type CampoFunil } from '../shared/funis.js';

const esp = MODELOS_FUNIL.find((m) => m.id === 'especialistas')!;

describe('campos dos funis', () => {
  it('exige os obrigatórios e normaliza os tipos', () => {
    const r = validarDados(esp.campos, { crp: ' 07/12345 ', epsi: 'true', abordagem: 'TCC', anos_experiencia: '6,5', especialidades: ['Ansiedade', 'Inventado'], curriculo: 'linkedin.com/in/ana' }, { publico: true });
    expect(r.erros).toEqual([]);
    expect(r.dados).toMatchObject({ crp: '07/12345', epsi: true, abordagem: 'TCC', anos_experiencia: 6.5, especialidades: ['Ansiedade'], curriculo: 'https://linkedin.com/in/ana' });
    const falta = validarDados(esp.campos, { abordagem: 'Astrologia' }, { publico: true });
    expect(falta.erros).toEqual(expect.arrayContaining(['CRP (número e região): obrigatório', 'Abordagem principal: escolha uma das opções']));
  });
  it('o formulário público não grava campo interno', () => {
    const r = validarDados(esp.campos, { crp: '1', epsi: true, abordagem: 'TCC', anos_experiencia: 1, avaliacao: 'aprovada' }, { publico: true });
    expect(r.dados.avaliacao).toBeUndefined();
    expect(validarDados(esp.campos, { crp: '1', epsi: true, abordagem: 'TCC', anos_experiencia: 1, avaliacao: 'ok' }).dados.avaliacao).toBe('ok');
  });
  it('recusa número, data e link inválidos', () => {
    const campos: CampoFunil[] = [{ chave: 'n', rotulo: 'N', tipo: 'numero' }, { chave: 'd', rotulo: 'D', tipo: 'data' }, { chave: 'l', rotulo: 'L', tipo: 'link' }];
    expect(validarDados(campos, { n: 'abc', d: '31/12/2026', l: 'não é link' }).erros).toEqual(['N: use só números', 'D: data inválida', 'L: link inválido']);
  });
  it('gera chaves e endereços limpos e mostra valores legíveis', () => {
    expect(chaveDe('Horas por semana disponíveis')).toBe('horas_por_semana_disponiveis');
    expect(slugDe('Especialistas de Telepsicologia!')).toBe('especialistas-de-telepsicologia');
    expect(valorLegivel({ chave: 'x', rotulo: 'x', tipo: 'sim_nao' }, false)).toBe('Não');
    expect(valorLegivel({ chave: 'x', rotulo: 'x', tipo: 'data' }, '2026-11-19')).toBe('19/11/2026');
  });
  it('todo modelo tem etapa em andamento e chaves únicas', () => {
    for (const m of MODELOS_FUNIL) {
      expect(m.etapas.some((e) => e.tipo === 'aberta')).toBe(true);
      expect(new Set(m.campos.map((c) => c.chave)).size).toBe(m.campos.length);
    }
  });
});
