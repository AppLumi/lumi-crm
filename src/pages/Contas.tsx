import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { cnpjFmt, num } from '../lib/formato';
import type { Conta, EstagioConta } from '../lib/tipos';
import { Campo, Carregando, Modal, Selo, Vazio } from '../components/ui';
import { cnpjValido } from '../../shared/pontuacao';

export const ESTAGIOS: Record<EstagioConta, { nome: string; cor: string }> = {
  lead: { nome: 'Lead', cor: '' }, oportunidade: { nome: 'Em negociação', cor: 'azul' },
  cliente: { nome: 'Cliente', cor: 'verde' }, ex_cliente: { nome: 'Ex-cliente', cor: 'vermelho' },
};

export interface DadosCnpj { razao_social?: string; nome_fantasia?: string; cnae?: string; setor?: string; porte?: string; municipio?: string; uf?: string; situacao?: string }

export default function Contas() {
  const ir = useNavigate();
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [busca, setBusca] = useState('');
  const [estagio, setEstagio] = useState('');
  const [nova, setNova] = useState(false);
  const [f, setF] = useState({ cnpj: '', nome: '', colaboradores: '', site: '' });
  const [cad, setCad] = useState<DadosCnpj | null>(null);

  useEffect(() => {
    supabase.from('contas').select('*').order('nome').limit(2000).then(({ data }) => setContas((data ?? []) as Conta[]));
  }, []);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const d = b.replace(/\D/g, '');
    return (contas ?? []).filter((c) => (!estagio || c.estagio === estagio)
      && (!b || c.nome.toLowerCase().includes(b) || (c.razao_social ?? '').toLowerCase().includes(b) || (!!d && (c.cnpj ?? '').includes(d))));
  }, [contas, busca, estagio]);

  const buscarCnpj = () => executar(async () => {
    const cnpj = f.cnpj.replace(/\D/g, '');
    if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido');
    const d = await api<DadosCnpj>(`cnpj?cnpj=${cnpj}`);
    setCad(d);
    setF((x) => ({ ...x, nome: x.nome || d.nome_fantasia || d.razao_social || '' }));
  });

  const criar = () => executar(async () => {
    const cnpj = f.cnpj.replace(/\D/g, '') || null;
    if (cnpj && !cnpjValido(cnpj)) throw new Error('CNPJ inválido');
    if (!f.nome.trim()) throw new Error('Informe o nome da empresa');
    const r = ok(await supabase.from('contas').insert({
      cnpj, nome: f.nome.trim(), colaboradores: Number(f.colaboradores.replace(/\D/g, '')) || null, site: f.site.trim() || null,
      razao_social: cad?.razao_social ?? null, cnae: cad?.cnae ?? null, setor: cad?.setor ?? null, porte: cad?.porte ?? null,
      cidade: cad?.municipio ?? null, uf: cad?.uf ?? null, dono: perfil?.id, origem: 'manual',
    }).select('id').single());
    ir(`/contas/${r!.id}`);
  }, 'Conta criada');

  return (
    <>
      <div className="topo">
        <div><h1>Contas</h1><p>Empresas: em negociação, clientes e ex-clientes.</p></div>
        <button className="btn primario" onClick={() => setNova(true)}>Nova conta</button>
      </div>
      <div className="filtros">
        <input placeholder="Buscar por nome ou CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={estagio} onChange={(e) => setEstagio(e.target.value)}>
          <option value="">Todos os estágios</option>
          {Object.entries(ESTAGIOS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
        </select>
        <span className="muted">{lista.length} conta(s)</span>
      </div>
      {!contas ? <Carregando /> : lista.length === 0 ? <Vazio>Nenhuma conta encontrada.</Vazio> : (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead><tr><th>Empresa</th><th>CNPJ</th><th>Setor</th><th className="num">Colaboradores</th><th>Cidade</th><th>Estágio</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="clicavel" onClick={() => ir(`/contas/${c.id}`)}>
                  <td><strong>{c.nome}</strong>{c.razao_social && c.razao_social !== c.nome && <div className="muted">{c.razao_social}</div>}</td>
                  <td>{cnpjFmt(c.cnpj)}</td>
                  <td>{c.setor ?? '—'}</td>
                  <td className="num">{num(c.colaboradores)}</td>
                  <td>{c.cidade ? `${c.cidade}/${c.uf}` : '—'}</td>
                  <td><Selo cor={ESTAGIOS[c.estagio].cor}>{ESTAGIOS[c.estagio].nome}</Selo></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal titulo="Nova conta" aberto={nova} fechar={() => setNova(false)}
        rodape={<><button className="btn" onClick={() => setNova(false)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={criar}>Criar</button></>}>
        <Campo rotulo="CNPJ" ajuda="Preenche os dados públicos da Receita automaticamente">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} />
            <button className="btn" disabled={ocupado} onClick={buscarCnpj}>Buscar</button>
          </div>
        </Campo>
        {cad && <div className="aviso ok">{cad.razao_social} · {cad.setor} · {cad.municipio}/{cad.uf} · {cad.situacao}</div>}
        <Campo rotulo="Nome da empresa"><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <div className="linha-campos">
          <Campo rotulo="Colaboradores"><input inputMode="numeric" value={f.colaboradores} onChange={(e) => setF({ ...f, colaboradores: e.target.value })} /></Campo>
          <Campo rotulo="Site"><input value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} /></Campo>
        </div>
      </Modal>
    </>
  );
}
