import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Funil } from '../lib/tipos';
import EditarFunil from './EditarFunil';

/** Abas no topo dos funis: o funil de vendas do Lumi, os funis criados pelo time e "Novo funil". */
export default function FunisAbas({ atualizar }: { atualizar?: number }) {
  const ir = useNavigate();
  const [funis, setFunis] = useState<Pick<Funil, 'id' | 'nome'>[]>([]);
  const [semTabela, setSemTabela] = useState(false);
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    supabase.from('funis').select('id, nome').eq('ativo', true).order('ordem').then(({ data, error }) => {
      setSemTabela(!!error && /funis|relation|schema cache/i.test(error.message));
      setFunis((data ?? []) as Pick<Funil, 'id' | 'nome'>[]);
    });
  }, [atualizar]);

  return (
    <>
      <div className="abas" style={{ marginBottom: 16 }}>
        <NavLink to="/funil" end className={({ isActive }) => (isActive ? 'ativa' : '')}>Vendas Lumi</NavLink>
        {funis.map((f) => <NavLink key={f.id} to={`/funis/${f.id}`} className={({ isActive }) => (isActive ? 'ativa' : '')}>{f.nome}</NavLink>)}
        <button onClick={() => setNovo(true)} disabled={semTabela} title={semTabela ? 'Falta rodar a migração 0002_funis.sql no Supabase' : undefined}>+ Novo funil</button>
      </div>
      {semTabela && <div className="aviso info" style={{ marginBottom: 14 }}>Para criar funis próprios (parceiros, B2B, especialistas…), rode uma vez o arquivo <code>supabase/migrations/0002_funis.sql</code> no SQL Editor do Supabase.</div>}
      <EditarFunil funil={null} aberto={novo} fechar={() => setNovo(false)} salvo={(id) => { setNovo(false); ir(`/funis/${id}`); }} />
    </>
  );
}
