import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { cnpjFmt } from '../lib/formato';
import type { ContaResumo } from '../../shared/empresas';
import { Modal } from './ui';

export interface Sugestao { conta: ContaResumo; motivo: string }

/** Procura uma empresa pelo nome, razão social, CNPJ ou site; mostra antes as sugestões (mesmo domínio, CNPJ…). */
export default function EscolherConta({ titulo, aberto, fechar, escolher, sugestoes = [], excluir, acao = 'Vincular', ocupado, aviso }: {
  titulo: string; aberto: boolean; fechar: () => void; escolher: (c: ContaResumo, motivo: string) => void;
  sugestoes?: Sugestao[]; excluir?: string; acao?: string; ocupado?: boolean; aviso?: ReactNode;
}) {
  const [busca, setBusca] = useState('');
  const [achadas, setAchadas] = useState<ContaResumo[]>([]);

  useEffect(() => { if (!aberto) setBusca(''); }, [aberto]);
  useEffect(() => {
    const b = busca.trim();
    if (b.length < 2) { setAchadas([]); return; }
    const t = setTimeout(async () => {
      const digitos = b.replace(/\D/g, '');
      const termo = b.replace(/[%_,()]/g, ' ');
      const ou = [`nome.ilike.%${termo}%`, `razao_social.ilike.%${termo}%`, `site.ilike.%${termo}%`];
      if (digitos.length >= 5) ou.push(`cnpj.like.%${digitos}%`);
      const { data } = await supabase.from('contas').select('id, nome, cnpj').or(ou.join(',')).order('nome').limit(20);
      setAchadas(((data ?? []) as ContaResumo[]).filter((c) => c.id !== excluir));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, excluir]);

  const linha = (c: ContaResumo, motivo: string) => (
    <tr key={c.id + motivo}>
      <td><strong>{c.nome}</strong><div className="muted">{[c.cnpj && cnpjFmt(c.cnpj), motivo].filter(Boolean).join(' · ')}</div></td>
      <td className="num"><button className="btn pequeno primario" disabled={ocupado} onClick={() => escolher(c, motivo)}>{acao}</button></td>
    </tr>
  );
  const sug = sugestoes.filter((s) => s.conta.id !== excluir);

  return (
    <Modal titulo={titulo} aberto={aberto} fechar={fechar} largura={620}>
      {aviso}
      {sug.length > 0 && (
        <>
          <h3 style={{ margin: '4px 0 6px' }}>Sugestões</h3>
          <table className="tabela"><tbody>{sug.map((s) => linha(s.conta, s.motivo))}</tbody></table>
        </>
      )}
      <input style={{ marginTop: 12 }} placeholder="Procurar empresa por nome, razão social, CNPJ ou site…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
      {busca.trim().length >= 2 && (achadas.length === 0
        ? <p className="muted" style={{ marginTop: 10 }}>Nenhuma empresa encontrada.</p>
        : <table className="tabela" style={{ marginTop: 8 }}><tbody>{achadas.map((c) => linha(c, 'escolhida na busca'))}</tbody></table>)}
    </Modal>
  );
}
