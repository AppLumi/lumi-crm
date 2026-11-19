import { describe, expect, it } from 'vitest';
import { dominioDoEmail, dominioDoSite, dominiosDaConta } from '../shared/empresas.js';

describe('domínio da empresa', () => {
  it('pega o domínio corporativo do e-mail e ignora e-mail pessoal', () => {
    expect(dominioDoEmail(' Ana@Acme.com.br ')).toBe('acme.com.br');
    expect(dominioDoEmail('ana@gmail.com')).toBeNull();
    expect(dominioDoEmail('ana@hotmail.com.br')).toBeNull();
    expect(dominioDoEmail('sem-arroba')).toBeNull();
  });
  it('lê o domínio do site em qualquer formato', () => {
    expect(dominioDoSite('https://www.acme.com.br/contato')).toBe('acme.com.br');
    expect(dominioDoSite('acme.com.br')).toBe('acme.com.br');
    expect(dominioDoSite('instagram')).toBeNull();
  });
  it('junta site e e-mails dos contatos sem repetir', () => {
    expect(dominiosDaConta('www.acme.com.br', ['rh@acme.com.br', 'joao@gmail.com', 'ti@acmegroup.com', null])).toEqual(['acme.com.br', 'acmegroup.com']);
  });
});
