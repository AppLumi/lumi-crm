import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { brl, primeiroNome } from '../lib/formato';
import type { CardFunil, EtapaFunil, Funil } from '../lib/tipos';
import { Campo, Carregando, Kpi, Modal, Vazio } from '../components/ui';
import FunisAbas from '../components/FunisAbas';
import EditarFunil from '../components/EditarFunil';
import CamposFunil from '../components/CamposFunil';
import { validarDados } from '../../shared/funis';

const cardVazio = { nome: '', email: '', whatsapp: '', empresa: '', valor: '', dados: {} as Record<string, unknown> };

export default function FunilPersonalizado() {
  const { id } = useParams<{ id: string }>();
  const ir = useNavigate();
  const { time, perfil, aviso } = useSessao();
  const { ocupado, executar } = useAcao();
  const [funil, setFunil] = useState<Funil | null>(null);
  const [etapas, setEtapas] = useState<EtapaFunil[]>([]);
  const [cards, setCards] = useState<CardFunil[] | null>(null);
  const [dono, setDono] = useState('');
  const [busca, setBusca] = useState('');
  const [verFechados, setVerFechados] = useState(false);
  const [sobre, setSobre] = useState<string | null>(null);
  const [editar, setEditar] = useState(false);
  const [novo, setNovo] = useState<typeof cardVazio | null>(null);
  const [perda, setPerda] = useState<{ card: CardFunil; etapa: EtapaFunil; motivo: string } | null>(null);
  const [abas, setAbas] = useState(0);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 90 * 864e5).toISOString();
    const [f, e, c] = await Promise.all([
      supabase.from('funis').select('*').eq('id', id!).maybeSingle(),
      supabase.from('funil_etapas').select('*').eq('funil_id', id!).order('ordem'),
      supabase.from('v_funil_cards').select('*').eq('funil_id', id!).or(`fechado_em.is.null,fechado_em.gte."${desde}"`).order('etapa_desde').limit(2000),
    ]);
    setFunil(f.data as Funil | null);
    setEtapas((e.data ?? []) as EtapaFunil[]);
    setCards((c.data ?? []) as CardFunil[]);
  }, [id]);
  useEffect(() => { setCards(null); carregar(); }, [carregar]);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (cards ?? []).filter((c) => (!dono || (dono === 'sem' ? !c.dono : c.dono === dono))
      && (!b || [c.titulo, c.nome, c.email, c.empresa, c.conta_nome].some((x) => x?.toLowerCase().includes(b))));
  }, [cards, dono, busca]);

  if (cards && !funil) return <Vazio>Funil não encontrado.</Vazio>;
  if (!funil || !cards) return <Carregando />;

  const abertos = lista.filter((c) => c.etapa_tipo === 'aberta');
  const ganhos = lista.filter((c) => c.etapa_tipo === 'ganha');
  const colunas = etapas.filter((e) => verFechados || e.tipo === 'aberta');
  const linkForm = funil.formulario_publico && funil.slug ? `${location.origin}/f/${funil.slug}` : null;

  const moverPara = (card: CardFunil, etapa: EtapaFunil, motivo?: string) => executar(async () => {
    ok(await supabase.from('funil_cards').update({ etapa_id: etapa.id, ...(etapa.tipo === 'perdida' ? { motivo_perda: motivo || null } : {}) }).eq('id', card.id));
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `Etapa: ${card.etapa_nome} → ${etapa.nome}`, descricao: motivo ? `Motivo: ${motivo}` : null, card_id: card.id, conta_id: card.conta_id, lead_id: card.lead_id, autor: perfil?.id });
    setPerda(null);
    await carregar();
  });
  const soltar = (etapa: EtapaFunil, cardId: string) => {
    setSobre(null);
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.etapa_id === etapa.id) return;
    if (etapa.tipo === 'perdida') setPerda({ card, etapa, motivo: '' });
    else moverPara(card, etapa);
  };

  const criar = () => executar(async () => {
    if (!novo) return;
    const titulo = (funil.pede_empresa ? novo.empresa.trim() || novo.nome.trim() : novo.nome.trim());
    if (!titulo) throw new Error(funil.pede_empresa ? 'Informe a empresa ou o nome' : 'Informe o nome');
    const v = validarDados(funil.campos ?? [], novo.dados);
    if (v.erros.length) throw new Error(v.erros[0]);
    const primeira = etapas.find((e) => e.tipo === 'aberta');
    if (!primeira) throw new Error('O funil não tem etapa em andamento');
    const r = ok(await supabase.from('funil_cards').insert({
      funil_id: funil.id, etapa_id: primeira.id, titulo, nome: novo.nome.trim() || null, email: novo.email.trim().toLowerCase() || null,
      whatsapp: novo.whatsapp.replace(/\D/g, '') || null, empresa: novo.empresa.trim() || null,
      valor: Number(novo.valor.replace(/\./g, '').replace(',', '.')) || null, dono: funil.dono_padrao ?? perfil?.id, dados: v.dados,
    }).select('id').single());
    setNovo(null);
    ir(`/cards/${r!.id}`);
  }, 'Card criado');

  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkForm!); aviso('Link do formulário copiado'); } catch { aviso(linkForm!); }
  };

  return (
    <>
      <FunisAbas atualizar={abas} />
      <div className="topo">
        <div><h1>{funil.nome}{!funil.ativo && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> · arquivado</span>}</h1><p>{funil.descricao ?? 'Arraste os cards entre as etapas.'}</p></div>
        <div className="acoes">
          {linkForm && <button className="btn" onClick={copiar} title={linkForm}>Copiar link do formulário</button>}
          <button className="btn" onClick={() => setEditar(true)}>Editar funil</button>
          <button className="btn primario" onClick={() => setNovo({ ...cardVazio, dados: {} })}>Novo card</button>
        </div>
      </div>

      <div className="filtros">
        <input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={dono} onChange={(e) => setDono(e.target.value)}>
          <option value="">Todo o time</option>
          <option value="sem">Sem dono</option>
          {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={verFechados} onChange={(e) => setVerFechados(e.target.checked)} /> Concluídos e encerrados (90 dias)
        </label>
      </div>

      <div className="grade g3" style={{ marginBottom: 16 }}>
        <Kpi rotulo="Em andamento" valor={abertos.length} />
        {funil.mostra_valor
          ? <Kpi rotulo="Valor em andamento" valor={brl(abertos.reduce((s, c) => s + Number(c.valor ?? 0), 0))} />
          : <Kpi rotulo="Entraram em 30 dias" valor={lista.filter((c) => Date.now() - Date.parse(c.criado_em) < 30 * 864e5).length} />}
        <Kpi rotulo="Concluídos (90 dias)" valor={ganhos.length} />
      </div>

      {etapas.length === 0 ? <Vazio>Este funil não tem etapas. Use “Editar funil”.</Vazio> : (
        <div className="quadro">
          {colunas.map((e) => {
            const fichas = lista.filter((c) => c.etapa_id === e.id);
            const total = fichas.reduce((s, c) => s + Number(c.valor ?? 0), 0);
            return (
              <section key={e.id} className={`coluna ${sobre === e.id ? 'sobre' : ''}`}
                onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }}
                onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
                onDrop={(ev) => { ev.preventDefault(); soltar(e, ev.dataTransfer.getData('text/plain')); }}>
                <h3>{e.nome} <span>{fichas.length}{funil.mostra_valor && total ? ` · ${brl(total)}` : ''}</span></h3>
                {fichas.map((c) => (
                  <article key={c.id} className={`ficha ${e.prazo_dias != null && e.tipo === 'aberta' && c.dias_na_etapa > e.prazo_dias ? 'parada' : ''}`} draggable
                    onDragStart={(ev) => ev.dataTransfer.setData('text/plain', c.id)} onClick={() => ir(`/cards/${c.id}`)}>
                    <div className="conta">{c.titulo}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.conta_nome ?? (c.titulo !== c.nome ? c.nome : c.email) ?? ''}{c.origem === 'formulario' ? ' · formulário' : ''}</div>
                    <div className="meta">
                      <span>{funil.mostra_valor ? (c.valor ? brl(Number(c.valor)) : 'sem valor') : ''}</span>
                      <span>{primeiroNome(c.dono_nome) || '—'} · {c.dias_na_etapa}d</span>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <EditarFunil funil={funil} aberto={editar} fechar={() => setEditar(false)} salvo={() => { setEditar(false); setAbas((n) => n + 1); carregar(); }} />

      <Modal titulo={`Novo card · ${funil.nome}`} aberto={!!novo} fechar={() => setNovo(null)} largura={680}
        rodape={<><button className="btn" onClick={() => setNovo(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={criar}>Criar card</button></>}>
        {novo && (
          <>
            {funil.pede_empresa && <Campo rotulo="Empresa"><input value={novo.empresa} onChange={(e) => setNovo({ ...novo, empresa: e.target.value })} autoFocus /></Campo>}
            <div className="linha-campos">
              <Campo rotulo={funil.pede_empresa ? 'Pessoa de contato' : 'Nome *'}><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus={!funil.pede_empresa} /></Campo>
              {funil.mostra_valor && <Campo rotulo="Valor (R$)"><input inputMode="decimal" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} /></Campo>}
            </div>
            <div className="linha-campos">
              <Campo rotulo="E-mail"><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Campo>
              <Campo rotulo="WhatsApp"><input value={novo.whatsapp} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} placeholder="DDD + número" /></Campo>
            </div>
            <CamposFunil campos={funil.campos ?? []} valores={novo.dados} mudar={(d) => setNovo({ ...novo, dados: d })} />
          </>
        )}
      </Modal>

      <Modal titulo={`Encerrar em “${perda?.etapa.nome}”`} aberto={!!perda} fechar={() => setPerda(null)}
        rodape={<><button className="btn" onClick={() => setPerda(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={() => perda && moverPara(perda.card, perda.etapa, perda.motivo.trim())}>Encerrar</button></>}>
        {perda && <Campo rotulo="Motivo"><input value={perda.motivo} onChange={(e) => setPerda({ ...perda, motivo: e.target.value })} placeholder="Ex.: sem fit, não respondeu, documentação incompleta" autoFocus /></Campo>}
      </Modal>
    </>
  );
}
