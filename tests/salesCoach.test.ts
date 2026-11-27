import { describe, it, expect } from 'vitest';
import { organizarSalesCoach, temperaturaDe, nivelTemperatura } from '../shared/salesCoach.js';

const campos = [
  { key: 'nota_da_reuniao', label: 'Nota da reunião', type: 'number' },
  { key: 'temperatura', label: 'Temperatura', type: 'option' },
  { key: 'resumo_da_reuniao', label: 'Resumo da reunião', type: 'text' },
  { key: 'dores_identificadas', label: 'Dores identificadas', type: 'text' },
  { key: 'proximo_passo', label: 'Próximo passo', type: 'text' },
  { key: 'data_do_proximo_passo', label: 'Data do próximo passo', type: 'date' },
  { key: 'fala_de_quem_conduz', label: 'Fala de quem conduz (%)', type: 'number' },
  { key: 'data_da_reuniao', label: 'Data da reunião', type: 'date' },
  { key: 'link_da_analise', label: 'Link da análise', type: 'url' },
  { key: 'criterio_dor_e_situacao_da_nr_1', label: 'Critério: Dor e situação da NR-1', type: 'number' },
  { key: 'criterio_decisor_e_processo_de_compra', label: 'Critério: Decisor e processo de compra', type: 'number' },
];

describe('Sales Coach no CRM', () => {
  it('organiza os campos gravados pela análise', () => {
    const r = organizarSalesCoach({
      nota_da_reuniao: 72, temperatura: 'Quente', resumo_da_reuniao: 'Boa conversa.', dores_identificadas: 'NR-1; clima',
      proximo_passo: 'Demo com o diretor', data_do_proximo_passo: '2026-12-03', fala_de_quem_conduz: '41', data_da_reuniao: '2026-11-27',
      link_da_analise: 'https://exemplo.invalid/a/1', criterio_dor_e_situacao_da_nr_1: 20, criterio_decisor_e_processo_de_compra: 8,
      campo_novo: 'algo', atualizado_em: '2026-11-27T15:00:00Z',
    }, campos)!;
    expect(r).toMatchObject({ nota: 72, temperatura: 'Quente', nivel: 'quente', fala: 41, proximo: 'Demo com o diretor', dataProximo: '2026-12-03', link: 'https://exemplo.invalid/a/1', atualizado: '2026-11-27T15:00:00Z' });
    expect(r.criterios).toEqual([
      { label: 'Dor e situação da NR-1', valor: 20, tipo: 'number' },
      { label: 'Decisor e processo de compra', valor: 8, tipo: 'number' },
    ]);
    expect(r.outros).toEqual([{ label: 'campo novo', valor: 'algo', tipo: 'text' }]);
  });

  it('sem análise devolve null', () => {
    expect(organizarSalesCoach({}, campos)).toBeNull();
    expect(organizarSalesCoach({ atualizado_em: 'x', resumo_da_reuniao: '  ' }, campos)).toBeNull();
    expect(organizarSalesCoach(null, campos)).toBeNull();
  });

  it('reconhece os campos mesmo sem o cadastro de campos', () => {
    const r = organizarSalesCoach({ nota_da_reuniao: '55', temperatura: 'Morna' }, [])!;
    expect(r.nota).toBe(55);
    expect(r.nivel).toBe('morna');
  });

  it('temperatura do card e níveis', () => {
    expect(temperaturaDe({ temperatura: 'Muito quente' }, campos)).toEqual({ rotulo: 'Muito quente', nivel: 'muito_quente' });
    expect(temperaturaDe({}, campos)).toBeNull();
    expect(nivelTemperatura('Fria')).toBe('fria');
    expect(nivelTemperatura('Outra')).toBeNull();
  });
});
