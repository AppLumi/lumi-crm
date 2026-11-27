import { describe, it, expect } from 'vitest';
import { custoNaoAgir, itemServico, lerServicos, montarSlides, slidesEscolhiveis, slidesVisiveis, totalServicos } from '../shared/propostaLumi.js';

const WS = 'workshop_nr1_liderancas';

describe('proposta do Lumi', () => {
  it('padrão sem workshop: sem slides do workshop, com capa e investimento', () => {
    const s = montarSlides('premium', []);
    expect(s[0]).toBe('capa');
    expect(s).toContain('investimento');
    expect(s).toContain('colaborador');
    expect(s.some((x) => x.startsWith('ws_'))).toBe(false);
    expect(s).not.toContain('ideia');
  });

  it('com workshop entram os 4 slides do workshop antes do investimento', () => {
    const s = montarSlides('premium', [WS]);
    const i = s.indexOf('investimento');
    expect(s.filter((x) => x.startsWith('ws_'))).toEqual(['ws_abertura', 'ws_objetivos', 'ws_conteudo', 'ws_escopo']);
    expect(s.indexOf('ws_escopo')).toBeLessThan(i);
  });

  it('Starter não mostra o app, mesmo se escolhido', () => {
    expect(montarSlides('starter', [], { colaborador: true })).not.toContain('colaborador');
    expect(slidesEscolhiveis('starter', []).map((x) => x.chave)).not.toContain('colaborador');
    expect(slidesVisiveis(['colaborador', 'nr1'], 'starter', [])).toEqual(['capa', 'nr1', 'investimento']);
  });

  it('escolha liga e desliga slides, mas não os fixos', () => {
    const s = montarSlides('premium', [WS], { ideia: true, nr1: false, capa: false, investimento: false, ws_conteudo: false });
    expect(s).toContain('ideia');
    expect(s).not.toContain('nr1');
    expect(s).not.toContain('ws_conteudo');
    expect(s).toContain('capa');
    expect(s).toContain('investimento');
  });

  it('proposta antiga (sem slides) mostra só capa e investimento; slide de workshop sem o serviço some', () => {
    expect(slidesVisiveis(null, 'premium', [])).toEqual(['capa', 'investimento']);
    expect(slidesVisiveis(['ws_abertura', 'nr1'], 'premium', [])).toEqual(['capa', 'nr1', 'investimento']);
  });

  it('item de serviço calcula total, unidade e valida', () => {
    const i = itemServico(WS, 2, 7500.5, '  até 25 líderes  ');
    expect(i).toMatchObject({ quantidade: 2, unidade: 'turmas', valor_total: 15001, detalhe: 'até 25 líderes' });
    expect(itemServico(WS, 1, 100).unidade).toBe('turma');
    expect(() => itemServico(WS, 0, 100)).toThrow();
    expect(() => itemServico(WS, 1, 0)).toThrow();
    expect(() => itemServico('outro', 1, 100)).toThrow();
    expect(totalServicos([i, itemServico(WS, 1, 0.1)])).toBe(15001.1);
  });

  it('lerServicos ignora lixo', () => {
    expect(lerServicos(null)).toEqual([]);
    expect(lerServicos([{ nome: 'x', valor_total: 10 }, 3, { foo: 1 }])).toHaveLength(1);
  });

  it('custo de não agir bate com o site para 200 pessoas', () => {
    const c = custoNaoAgir(200);
    expect(Math.round(c.presenteismo)).toBe(326400);
    expect(Math.round(c.afastamentos)).toBe(4800);
    expect(Math.round(c.rotatividade)).toBe(216000);
    expect(Math.round(c.total)).toBe(547200);
  });
});
