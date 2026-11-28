import { describe, expect, it } from 'vitest';
import {
  assuntoResposta, cabecalho, cabecalhosResposta, citar, ehAutomatico, enderecoDe, enderecoResposta, extrairResposta,
  htmlParaTexto, idsDaConversa, localDoEmail, nomeDe, prazoResponder,
} from '../shared/emailRecebido.js';

describe('endereço de resposta', () => {
  it('usa o domínio de respostas quando configurado', () => {
    expect(enderecoResposta('Bruna.Salazar@applumi.io', 'respostas.applumi.io')).toBe('bruna.salazar@respostas.applumi.io');
    expect(enderecoResposta('bruna@applumi.io', '@respostas.applumi.io')).toBe('bruna@respostas.applumi.io');
  });
  it('sem domínio configurado, continua no e-mail da pessoa', () => {
    expect(enderecoResposta('bruna@applumi.io', '')).toBe('bruna@applumi.io');
    expect(enderecoResposta('bruna@applumi.io', undefined)).toBe('bruna@applumi.io');
  });
  it('limpa a parte local', () => {
    expect(localDoEmail('Ana+teste@exemplo.invalid')).toBe('anateste');
  });
});

describe('remetente', () => {
  it('separa nome e endereço', () => {
    expect(enderecoDe('"Ana Lima" <Ana@Exemplo.invalid>')).toBe('ana@exemplo.invalid');
    expect(enderecoDe('ana@exemplo.invalid')).toBe('ana@exemplo.invalid');
    expect(nomeDe('"Ana Lima" <ana@exemplo.invalid>')).toBe('Ana Lima');
    expect(nomeDe('Ana Lima <ana@exemplo.invalid>')).toBe('Ana Lima');
    expect(nomeDe('ana@exemplo.invalid')).toBeNull();
  });
  it('lê cabeçalho sem diferenciar maiúsculas, inclusive em lista', () => {
    expect(cabecalho({ 'In-Reply-To': '<a@x>' }, 'in-reply-to')).toBe('<a@x>');
    expect(cabecalho({ references: ['<a@x>', '<b@x>'] }, 'References')).toBe('<a@x> <b@x>');
    expect(cabecalho(undefined, 'x')).toBe('');
  });
});

describe('conversa', () => {
  it('pega primeiro a mensagem respondida e depois as mais recentes', () => {
    expect(idsDaConversa('<c@x>', '<a@x> <b@x> <c@x>')).toEqual(['<c@x>', '<b@x>', '<a@x>']);
    expect(idsDaConversa('', '')).toEqual([]);
  });
  it('monta os cabeçalhos pra responder na mesma conversa', () => {
    expect(cabecalhosResposta('<c@x>', '<a@x> <b@x>')).toEqual({ 'In-Reply-To': '<c@x>', References: '<a@x> <b@x> <c@x>' });
    expect(cabecalhosResposta(null, '<a@x>')).toEqual({});
  });
  it('não empilha Re:', () => {
    expect(assuntoResposta('Proposta Lumi')).toBe('Re: Proposta Lumi');
    expect(assuntoResposta('RE: Proposta Lumi')).toBe('RE: Proposta Lumi');
    expect(assuntoResposta('Res: Proposta')).toBe('Res: Proposta');
    expect(assuntoResposta('')).toBe('Re: (sem assunto)');
  });
});

describe('texto da resposta', () => {
  it('corta o histórico do Gmail em português', () => {
    const t = 'Oi Bruna, pode ser na quinta às 10h.\n\nAbs,\nAna\n\nEm seg., 2 de dez. de 2026 às 10:00, Bruna Salazar <bruna@respostas.applumi.io> escreveu:\n> Oi Ana, tudo bem?';
    expect(extrairResposta(t)).toBe('Oi Bruna, pode ser na quinta às 10h.\n\nAbs,\nAna');
  });
  it('corta quando o "escreveu:" quebra em duas linhas', () => {
    const t = 'Pode sim.\n\nEm seg., 2 de dez. de 2026 às 10:00, Bruna Salazar <\nbruna@respostas.applumi.io> escreveu:\n> antes';
    expect(extrairResposta(t)).toBe('Pode sim.');
  });
  it('corta o histórico do Outlook e o "Enviado do meu iPhone"', () => {
    expect(extrairResposta('Recebido, obrigada.\n\n-----Mensagem Original-----\nDe: Bruna')).toBe('Recebido, obrigada.');
    expect(extrairResposta('Fechado!\n\nEnviado do meu iPhone\n\nOn Mon, Bruna wrote:')).toBe('Fechado!');
    expect(extrairResposta('Ok\n________________________________\nDe: bruna@respostas.applumi.io')).toBe('Ok');
  });
  it('sem histórico, devolve tudo', () => {
    expect(extrairResposta('Só isso.')).toBe('Só isso.');
    expect(extrairResposta('> tudo citado')).toBe('> tudo citado');
  });
  it('converte HTML em texto', () => {
    expect(htmlParaTexto('<style>p{}</style><p>Oi&nbsp;Bruna</p><p>Lista:</p><ul><li>um</li><li>dois</li></ul>')).toBe('Oi Bruna\nLista:\n- um\n- dois');
  });
  it('cita a mensagem anterior', () => {
    expect(citar('linha 1\nlinha 2', 'Ana', new Date('2026-12-02T13:00:00Z'))).toBe('Em 02/12/2026, Ana escreveu:\n> linha 1\n> linha 2');
  });
});

describe('respostas automáticas', () => {
  it('reconhece pelo cabeçalho', () => {
    expect(ehAutomatico({ 'Auto-Submitted': 'auto-replied' }, 'Re: Proposta')).toBe(true);
    expect(ehAutomatico({ 'auto-submitted': 'no' }, 'Re: Proposta')).toBe(false);
    expect(ehAutomatico({ Precedence: 'auto_reply' }, 'x')).toBe(true);
    expect(ehAutomatico({ 'X-Autoreply': 'yes' }, 'x')).toBe(true);
  });
  it('reconhece pelo assunto', () => {
    expect(ehAutomatico({}, 'Resposta automática: Proposta Lumi')).toBe(true);
    expect(ehAutomatico({}, 'Automatic reply: Proposta')).toBe(true);
    expect(ehAutomatico({}, 'Fora do escritório')).toBe(true);
    expect(ehAutomatico({}, 'Re: Proposta Lumi')).toBe(false);
    expect(ehAutomatico({}, 'Re: férias coletivas e a NR-1')).toBe(false);
    expect(ehAutomatico({}, 'Férias até 10/01')).toBe(true);
    expect(ehAutomatico({}, 'Ausente do escritório')).toBe(true);
  });
});

describe('prazo pra responder', () => {
  it('próximo dia útil ao meio-dia de Brasília', () => {
    expect(prazoResponder(new Date('2026-12-01T13:00:00Z'))).toBe('2026-12-02T15:00:00.000Z'); // terça → quarta
    expect(prazoResponder(new Date('2026-12-04T20:00:00Z'))).toBe('2026-12-07T15:00:00.000Z'); // sexta → segunda
    expect(prazoResponder(new Date('2026-12-05T02:00:00Z'))).toBe('2026-12-07T15:00:00.000Z'); // sexta 23h em Brasília → segunda
  });
});
