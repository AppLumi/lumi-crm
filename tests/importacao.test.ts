import { describe, it, expect } from 'vitest';
import { lerLista, nomeSuspeito } from '../shared/importacao.js';

describe('importação de lista', () => {
  it('lê a planilha do painel do evento pelos títulos, em qualquer ordem', () => {
    const csv = [
      'Data;Nome;E-mail;Celular;Empresa;Cargo;Tipo;Cupom',
      '10/11/2026 09:41;Julia Pereira;julia.pereira@safepark.com.br;(51) 99873-2752;Safepark;Analista de RH;convidado;',
      '"11/11/2026 10:02";"Silva; Souza";"ana@x.com.br";51 99999-0000;"Empresa, Ltda";Gerente;pagante;CUPOM',
    ].join('\n');
    const r = lerLista(csv);
    expect(r.porTitulo).toBe(true);
    expect(r.colunas.map((c) => c.campo)).toEqual(['nome', 'email', 'whatsapp', 'empresa', 'cargo']);
    expect(r.linhas[0]).toEqual({ nome: 'Julia Pereira', email: 'julia.pereira@safepark.com.br', whatsapp: '51998732752', empresa: 'Safepark', cargo: 'Analista de RH', colaboradores: null });
    expect(r.linhas[1].nome).toBe('Silva; Souza');
    expect(r.linhas[1].empresa).toBe('Empresa, Ltda');
  });

  it('aceita o modelo antigo "nome;email;…" com título', () => {
    const r = lerLista('nome;email;whatsapp;empresa;cargo;colaboradores\nAna;ana@a.com;51999990000;A;RH;120');
    expect(r.linhas).toEqual([{ nome: 'Ana', email: 'ana@a.com', whatsapp: '51999990000', empresa: 'A', cargo: 'RH', colaboradores: 120 }]);
  });

  it('sem títulos, usa a ordem padrão', () => {
    const r = lerLista('Ana;ana@a.com;51999990000;A;RH;120\nBia;bia@b.com;;B;;');
    expect(r.porTitulo).toBe(false);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0].colaboradores).toBe(120);
  });

  it('cola da planilha (tabulação) com títulos', () => {
    const r = lerLista('Nome\tWhatsApp\tEmpresa\nBeto\t(51) 98888-7777\tB');
    expect(r.linhas).toEqual([{ nome: 'Beto', email: null, whatsapp: '51988887777', empresa: 'B', cargo: null, colaboradores: null }]);
  });

  it('não deixa entrar lead com data no lugar do nome', () => {
    const r = lerLista('10/11;Julia;julia@x.com');
    expect(r.linhas).toHaveLength(0);
    expect(r.puladas[0].motivo).toMatch(/parece data/);
    expect(nomeSuspeito('12/11')).toBe(true);
    expect(nomeSuspeito('Data')).toBe(true);
    expect(nomeSuspeito('10/11/2026 14:22')).toBe(true);
    expect(nomeSuspeito('Maria 12')).toBe(false);
  });
});
