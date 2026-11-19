import { describe, expect, it } from 'vitest';
import { preencher, problemasDoTexto, separarDestinatarios, variaveisDoLead, type LeadDisparo } from '../shared/disparo.js';

const lead = (id: string, email: string | null, extra: Partial<LeadDisparo> = {}): LeadDisparo =>
  ({ id, nome: 'Ana Souza', email, empresa: 'Acme', status: 'nutricao', aceita_marketing: true, ...extra });

describe('separarDestinatarios', () => {
  it('tira quem não tem e-mail, quem se descadastrou, descartados e repetidos', () => {
    const r = separarDestinatarios([
      lead('1', 'ana@acme.com'),
      lead('2', null),
      lead('3', 'sem-arroba'),
      lead('4', 'saiu@acme.com'),
      lead('5', 'ANA@acme.com '),
      lead('6', 'x@acme.com', { status: 'descartado' }),
      lead('7', 'y@acme.com'),
    ], { descadastrados: new Set(['saiu@acme.com', '7']), soComAceite: false });
    expect(r.enviar.map((l) => l.id)).toEqual(['1']);
    expect(r.fora).toEqual({ sem_email: 2, descadastrado: 2, sem_aceite: 0, descartado: 1, repetido: 1 });
  });
  it('com "só quem autorizou", deixa de fora quem não marcou o aceite', () => {
    const r = separarDestinatarios([lead('1', 'a@a.com'), lead('2', 'b@b.com', { aceita_marketing: false })],
      { descadastrados: new Set(), soComAceite: true });
    expect(r.enviar.map((l) => l.id)).toEqual(['1']);
    expect(r.fora.sem_aceite).toBe(1);
  });
});

describe('texto do disparo', () => {
  it('personaliza por pessoa', () => {
    const v = variaveisDoLead({ nome: 'MARIA clara silva', empresa: null }, 'Bruna');
    expect(preencher('Oi, {{primeiro_nome}}! A {{ empresa }} já viu? — {{remetente}}', v)).toBe('Oi, Maria! A sua empresa já viu? — Bruna');
  });
  it('recusa variáveis que só existem no envio individual e trechos entre colchetes', () => {
    expect(problemasDoTexto('Oi {{primeiro_nome}}', 'Proposta: {{link_proposta}}')[0]).toContain('{{link_proposta}}');
    expect(problemasDoTexto('Oi', '- [próximo passo]')).toEqual(['Troque os trechos entre [colchetes] antes de enviar']);
    expect(problemasDoTexto('Oi {{primeiro_nome}}', 'Texto da {{empresa}}')).toEqual([]);
  });
});
