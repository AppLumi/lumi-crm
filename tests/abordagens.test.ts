import { describe, it, expect } from 'vitest';
import { cadenciaPara, preencherTexto, proximoPasso, zapComTexto } from '../shared/abordagens.js';

describe('abordagens', () => {
  const c = cadenciaPara('prospeccao_clientes_grou')!;
  it('só a origem dos clientes Grou tem cadência', () => {
    expect(c.passos.map((p: { dia: number }) => p.dia)).toEqual([0, 2, 5, 7, 10, 14]);
    expect(cadenciaPara('lista_fria')).toBeNull();
  });
  it('preenche os textos sem deixar {{…}} nem colchetes', () => {
    const v = { primeiro_nome: 'Ana', nome: 'Ana Souza', empresa: 'Exemplo SA', remetente: 'Bruna' };
    for (const p of c.passos) {
      const t = preencherTexto(p.texto + (p.assunto ?? ''), v);
      expect(t).not.toMatch(/\{\{|\[[^\]]+\]/);
      expect(t).not.toMatch(/\ba Lumi\b|\bda Lumi\b/);
    }
    expect(preencherTexto(c.passos[0].texto, v)).toContain('Oi, Ana');
  });
  it('próximo passo e atraso', () => {
    expect(proximoPasso(c, new Set(), 0)).toMatchObject({ passo: { id: 'email1' }, situacao: 'hoje' });
    expect(proximoPasso(c, new Set(['email1']), 4)).toMatchObject({ passo: { id: 'linkedin1' }, situacao: 'atrasado' });
    expect(proximoPasso(c, new Set(c.passos.map((p: { id: string }) => p.id)), 20)).toBeNull();
  });
  it('link do WhatsApp com texto', () => {
    expect(zapComTexto('51999990000', 'Oi, tudo bem?')).toBe('https://wa.me/5551999990000?text=Oi%2C%20tudo%20bem%3F');
    expect(zapComTexto(null, 'x')).toBeNull();
  });
});
