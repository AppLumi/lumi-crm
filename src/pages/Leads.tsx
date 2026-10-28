import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { STATUS_LEAD, nomeOrigem, relativo } from '../lib/formato';
import type { Lead, StatusLead } from '../lib/tipos';
import { Campo, Carregando, Modal, Nota, Selo, Vazio } from '../components/ui';
import { cnpjValido, notaPerfil } from '../../shared/pontuacao';

const vazio = { nome: '', email: '', whatsapp: '', empresa: '', cnpj: '', cargo: '', colaboradores: '', origem: 'indicacao', evento: '', mensagem: '', aceita_marketing: false };

export default function Leads() {
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [status, setStatus] = useState<StatusLead | 'abertos' | 'todos'>('abertos');
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [dono, setDono] = useState('');
  const [ordem, setOrdem] = useState<'recentes' | 'nota'>('recentes');
  const [novo, setNovo] = useState(vazio);
  const [importar, setImportar] = useState(false);
  const [csv, setCsv] = useState('');

  const carregar = useCallback(async () => {
    let q = supabase.from('v_leads').select('*').order('criado_em', { ascending: false }).limit(1000);
    if (status === 'abertos') q = q.in('status', ['novo', 'em_contato', 'nutricao']);
    else if (status !== 'todos') q = q.eq('status', status);
    const r = await q;
    setLeads((r.data ?? []) as Lead[]);
  }, [status]);
  useEffect(() => { carregar(); }, [carregar]);

  const origens = useMemo(() => [...new Set((leads ?? []).map((l) => l.origem))].sort(), [leads]);
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const r = (leads ?? []).filter((l) =>
      (!b || [l.nome, l.email, l.empresa, l.cargo].some((x) => x?.toLowerCase().includes(b)))
      && (!origem || l.origem === origem) && (!dono || (dono === 'sem' ? !l.dono : l.dono === dono)));
    return ordem === 'nota' ? [...r].sort((a, c) => c.nota_perfil + c.nota_interesse - a.nota_perfil - a.nota_interesse) : r;
  }, [leads, busca, origem, dono, ordem]);

  const fecharNovo = () => { params.delete('novo'); setParams(params, { replace: true }); setNovo(vazio); };
  const criar = () => executar(async () => {
    if (!novo.nome.trim() || (!novo.email.trim() && !novo.whatsapp.trim())) throw new Error('Informe nome e e-mail ou WhatsApp');
    const cnpj = novo.cnpj.replace(/\D/g, '');
    if (cnpj && !cnpjValido(cnpj)) throw new Error('CNPJ inválido');
    const colab = Number(novo.colaboradores.replace(/\D/g, '')) || null;
    const whatsapp = novo.whatsapp.replace(/\D/g, '') || null;
    const r = ok(await supabase.from('leads').insert({
      nome: novo.nome.trim(), email: novo.email.trim().toLowerCase() || null, whatsapp, empresa: novo.empresa.trim() || null,
      cnpj: cnpj || null, cargo: novo.cargo.trim() || null, colaboradores: colab, origem: novo.origem, evento: novo.evento.trim() || null,
      mensagem: novo.mensagem.trim() || null, aceita_marketing: novo.aceita_marketing,
      consentimento_em: novo.aceita_marketing ? new Date().toISOString() : null, dono: perfil?.id,
      nota_perfil: notaPerfil({ colaboradores: colab, cargo: novo.cargo, cnpjValido: !!cnpj, temWhatsapp: !!whatsapp }),
    }).select('id').single());
    fecharNovo();
    ir(`/leads/${r!.id}`);
  }, 'Lead criado');

  // importação simples de lista (evento, feira): nome;email;whatsapp;empresa;cargo;colaboradores
  const linhasCsv = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[;,\t]/).map((c) => c.trim()))
    .filter((c) => c[0] && !/^nome$/i.test(c[0]));
  const importarCsv = () => executar(async () => {
    if (!linhasCsv.length) throw new Error('Cole ao menos uma linha');
    const linhas = linhasCsv.map(([nome, email, whatsapp, empresa, cargo, colaboradores]) => {
      const colab = Number((colaboradores ?? '').replace(/\D/g, '')) || null;
      const zap = (whatsapp ?? '').replace(/\D/g, '') || null;
      return { nome, email: email?.toLowerCase() || null, whatsapp: zap, empresa: empresa || null, cargo: cargo || null, colaboradores: colab,
        origem: novo.origem || 'evento', evento: novo.evento || null, dono: perfil?.id, nota_perfil: notaPerfil({ colaboradores: colab, cargo, temWhatsapp: !!zap }) };
    });
    ok(await supabase.from('leads').insert(linhas));
    setImportar(false); setCsv('');
    await carregar();
  }, `${linhasCsv.length} lead(s) importado(s)`);

  return (
    <>
      <div className="topo">
        <div><h1>Leads</h1><p>Toda entrada nova: site, eventos, indicações e listas.</p></div>
        <div className="acoes">
          <button className="btn" onClick={() => setImportar(true)}>Importar lista</button>
          <button className="btn primario" onClick={() => { params.set('novo', '1'); setParams(params); }}>Novo lead</button>
        </div>
      </div>

      <div className="filtros">
        <input placeholder="Buscar nome, e-mail, empresa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="abertos">Abertos</option>
          {Object.entries(STATUS_LEAD).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          <option value="todos">Todos</option>
        </select>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {origens.map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
        </select>
        <select value={dono} onChange={(e) => setDono(e.target.value)}>
          <option value="">Qualquer dono</option>
          <option value="sem">Sem dono</option>
          {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)}>
          <option value="recentes">Mais recentes</option>
          <option value="nota">Maior nota</option>
        </select>
        <span className="muted">{lista.length} lead(s)</span>
      </div>

      {!leads ? <Carregando /> : lista.length === 0 ? <Vazio>Nenhum lead com esses filtros.</Vazio> : (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>Empresa</th><th>Origem</th><th>Perfil</th><th>Interesse</th><th>Status</th><th>Dono</th><th className="num">Entrou</th></tr></thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className="clicavel" onClick={() => ir(`/leads/${l.id}`)}>
                  <td><strong>{l.nome}</strong><div className="muted">{l.cargo ?? l.email ?? ''}</div></td>
                  <td>{l.empresa ?? '—'}{l.colaboradores ? <div className="muted">{l.colaboradores} colab.</div> : l.enriquecimento?.porte_informado ? <div className="muted">{l.enriquecimento.porte_informado} colab.</div> : null}</td>
                  <td>{nomeOrigem(l.origem)}{l.utm_campaign ? <div className="muted">{l.utm_campaign}</div> : null}</td>
                  <td><Nota valor={l.nota_perfil} /></td>
                  <td><Nota valor={l.nota_interesse} /></td>
                  <td><Selo cor={STATUS_LEAD[l.status].cor}>{STATUS_LEAD[l.status].nome}</Selo></td>
                  <td>{l.dono_nome ?? <span className="muted">—</span>}</td>
                  <td className="num">{relativo(l.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal titulo="Novo lead" aberto={params.get('novo') === '1'} fechar={fecharNovo} largura={640}
        rodape={<><button className="btn" onClick={fecharNovo}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={criar}>Criar lead</button></>}>
        <div className="linha-campos">
          <Campo rotulo="Nome *"><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus /></Campo>
          <Campo rotulo="Cargo"><input value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })} /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="E-mail"><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Campo>
          <Campo rotulo="WhatsApp"><input value={novo.whatsapp} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} placeholder="DDD + número" /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Empresa"><input value={novo.empresa} onChange={(e) => setNovo({ ...novo, empresa: e.target.value })} /></Campo>
          <Campo rotulo="CNPJ"><input value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} /></Campo>
          <Campo rotulo="Colaboradores"><input inputMode="numeric" value={novo.colaboradores} onChange={(e) => setNovo({ ...novo, colaboradores: e.target.value })} /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Origem">
            <select value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value })}>
              {['indicacao', 'evento', 'linkedin', 'whatsapp', 'prospeccao', 'parceiro', 'site', 'outro'].map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Evento ou campanha"><input value={novo.evento} onChange={(e) => setNovo({ ...novo, evento: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Contexto"><textarea value={novo.mensagem} onChange={(e) => setNovo({ ...novo, mensagem: e.target.value })} placeholder="Como chegou, o que pediu…" /></Campo>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={novo.aceita_marketing} onChange={(e) => setNovo({ ...novo, aceita_marketing: e.target.checked })} />
          A pessoa autorizou receber conteúdos do Lumi
        </label>
      </Modal>

      <Modal titulo="Importar lista de leads" aberto={importar} fechar={() => setImportar(false)} largura={700}
        rodape={<><button className="btn" onClick={() => setImportar(false)}>Cancelar</button><button className="btn primario" disabled={ocupado || !linhasCsv.length} onClick={importarCsv}>Importar {linhasCsv.length || ''}</button></>}>
        <div className="aviso info">Uma pessoa por linha: <b>nome; e-mail; WhatsApp; empresa; cargo; colaboradores</b>. Dá para colar direto de uma planilha. Só importe quem deu o contato para falar sobre o Lumi.</div>
        <div className="linha-campos">
          <Campo rotulo="Origem">
            <select value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value })}>
              {['evento', 'indicacao', 'parceiro', 'linkedin', 'outro'].map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Evento ou campanha"><input value={novo.evento} onChange={(e) => setNovo({ ...novo, evento: e.target.value })} placeholder="Ex.: Café NR-1 Curitiba" /></Campo>
        </div>
        <Campo rotulo="Linhas"><textarea value={csv} onChange={(e) => setCsv(e.target.value)} style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }} /></Campo>
      </Modal>
    </>
  );
}
