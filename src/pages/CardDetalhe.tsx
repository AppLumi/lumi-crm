import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { dataHora, nomeOrigem, zapLink } from '../lib/formato';
import type { CardFunil, EtapaFunil, Funil } from '../lib/tipos';
import { Campo, Carregando, Modal, Selo, Vazio } from '../components/ui';
import LinhaDoTempo from '../components/LinhaDoTempo';
import EnviarEmail, { type DestinoEmail } from '../components/EnviarEmail';
import CamposFunil from '../components/CamposFunil';
import EscolherConta, { type Sugestao } from '../components/EscolherConta';
import { validarDados } from '../../shared/funis';
import { contasPorDominio, dominioDoEmail, type ContaResumo } from '../../shared/empresas';

export default function CardDetalhe() {
  const { id } = useParams<{ id: string }>();
  const ir = useNavigate();
  const { time, perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [card, setCard] = useState<CardFunil | null>(null);
  const [funil, setFunil] = useState<Funil | null>(null);
  const [etapas, setEtapas] = useState<EtapaFunil[]>([]);
  const [form, setForm] = useState<{ titulo: string; nome: string; email: string; whatsapp: string; empresa: string; valor: string; dados: Record<string, unknown> } | null>(null);
  const [email, setEmail] = useState<DestinoEmail | null>(null);
  const [escolher, setEscolher] = useState(false);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [excluir, setExcluir] = useState(false);
  const [tick, setTick] = useState(0);
  const [faltou, setFaltou] = useState(false);

  const carregar = useCallback(async () => {
    const c = await supabase.from('v_funil_cards').select('*').eq('id', id!).maybeSingle();
    const cd = c.data as CardFunil | null;
    if (!cd) { setFaltou(true); return; }
    const [f, e] = await Promise.all([
      supabase.from('funis').select('*').eq('id', cd.funil_id).single(),
      supabase.from('funil_etapas').select('*').eq('funil_id', cd.funil_id).order('ordem'),
    ]);
    setCard(cd); setFunil(f.data as Funil); setEtapas((e.data ?? []) as EtapaFunil[]);
    setForm({ titulo: cd.titulo, nome: cd.nome ?? '', email: cd.email ?? '', whatsapp: cd.whatsapp ?? '', empresa: cd.empresa ?? '', valor: cd.valor != null ? String(cd.valor).replace('.', ',') : '', dados: cd.dados ?? {} });
    const dom = !cd.conta_id ? dominioDoEmail(cd.email) : null;
    setSugestoes(dom ? (await contasPorDominio(supabase, dom)).map((x) => ({ conta: x, motivo: `mesmo domínio @${dom}` })) : []);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  if (faltou) return <Vazio>Card não encontrado.</Vazio>;
  if (!card || !funil || !form) return <Carregando />;

  const registrar = (titulo: string, descricao?: string | null) =>
    supabase.from('atividades').insert({ tipo: 'sistema', titulo, descricao: descricao ?? null, card_id: card.id, conta_id: card.conta_id, lead_id: card.lead_id, autor: perfil?.id });

  const salvar = () => executar(async () => {
    if (!form.titulo.trim()) throw new Error('O card precisa de um título');
    const v = validarDados(funil.campos ?? [], form.dados);
    if (v.erros.length) throw new Error(v.erros[0]);
    ok(await supabase.from('funil_cards').update({
      titulo: form.titulo.trim(), nome: form.nome.trim() || null, email: form.email.trim().toLowerCase() || null,
      whatsapp: form.whatsapp.replace(/\D/g, '') || null, empresa: form.empresa.trim() || null,
      valor: Number(form.valor.replace(/\./g, '').replace(',', '.')) || null, dados: v.dados,
    }).eq('id', card.id));
    await carregar();
  }, 'Card salvo');

  const mudarEtapa = (etapaId: string) => executar(async () => {
    const e = etapas.find((x) => x.id === etapaId);
    if (!e) return;
    const motivo = e.tipo === 'perdida' ? card.motivo_perda : null;
    ok(await supabase.from('funil_cards').update({ etapa_id: e.id }).eq('id', card.id));
    await registrar(`Etapa: ${card.etapa_nome} → ${e.nome}`, motivo ? `Motivo: ${motivo}` : null);
    await carregar(); setTick((t) => t + 1);
  }, 'Etapa alterada');

  const mudarDono = (dono: string) => executar(async () => {
    ok(await supabase.from('funil_cards').update({ dono: dono || null }).eq('id', card.id));
    await carregar();
  }, 'Dono alterado');

  const vincularConta = (c: ContaResumo | null, motivo?: string) => executar(async () => {
    ok(await supabase.from('funil_cards').update({ conta_id: c?.id ?? null, ...(c && !form.empresa ? { empresa: c.nome } : {}) }).eq('id', card.id));
    if (c) await supabase.from('atividades').update({ conta_id: c.id }).eq('card_id', card.id).is('conta_id', null);
    await registrar(c ? `Vinculado à empresa ${c.nome}` : 'Desvinculado da empresa', motivo ? `Motivo: ${motivo}` : null);
    setEscolher(false);
    await carregar(); setTick((t) => t + 1);
  }, c ? `Vinculado à ${c.nome}` : 'Vínculo desfeito');

  const apagar = () => executar(async () => {
    ok(await supabase.from('funil_cards').delete().eq('id', card.id));
    ir(`/funis/${funil.id}`);
  }, 'Card excluído');

  const zap = zapLink(card.whatsapp);
  const mudou = form.titulo !== card.titulo || form.nome !== (card.nome ?? '') || form.email !== (card.email ?? '') || form.whatsapp !== (card.whatsapp ?? '')
    || form.empresa !== (card.empresa ?? '') || form.valor !== (card.valor != null ? String(card.valor).replace('.', ',') : '') || JSON.stringify(form.dados) !== JSON.stringify(card.dados ?? {});

  return (
    <>
      <div className="migalha"><Link to="/funil">Funis</Link> / <Link to={`/funis/${funil.id}`}>{funil.nome}</Link> / {card.titulo}</div>
      <div className="topo">
        <div>
          <h1>{card.titulo}</h1>
          <p>
            <Selo cor={card.etapa_tipo === 'ganha' ? 'verde' : card.etapa_tipo === 'perdida' ? 'vermelho' : 'azul'}>{card.etapa_nome}</Selo>
            {' '}há {card.dias_na_etapa} dia(s) nesta etapa · entrou {dataHora(card.criado_em)}{card.origem === 'formulario' ? ' pelo formulário' : ''}
          </p>
        </div>
        <div className="acoes">
          {card.email && <button className="btn" onClick={() => setEmail({ para: card.email!, nome: card.nome ?? card.titulo, empresa: card.conta_nome ?? card.empresa, card_id: card.id, conta_id: card.conta_id ?? undefined, lead_id: card.lead_id ?? undefined })}>Enviar e-mail</button>}
          {zap && <a className="btn" href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}
          <select value={card.etapa_id} onChange={(e) => mudarEtapa(e.target.value)} disabled={ocupado} aria-label="Etapa" style={{ width: 'auto' }}>
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      </div>
      {card.etapa_tipo === 'perdida' && card.motivo_perda && <div className="aviso">Encerrado: {card.motivo_perda}</div>}

      <div className="detalhe">
        <LinhaDoTempo alvo={{ card_id: card.id, conta_id: card.conta_id ?? undefined, lead_id: card.lead_id ?? undefined }} filtro={{ coluna: 'card_id', valor: card.id }} atualizar={tick} />

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao" style={{ display: 'grid', gap: 2 }}>
            <h2 style={{ marginBottom: 8 }}>Dados</h2>
            <Campo rotulo="Título"><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Campo>
            {funil.pede_empresa && <Campo rotulo="Empresa"><input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></Campo>}
            <Campo rotulo={funil.pede_empresa ? 'Pessoa de contato' : 'Nome'}><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo>
            <Campo rotulo="E-mail"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
            <Campo rotulo="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Campo>
            {funil.mostra_valor && <Campo rotulo="Valor (R$)"><input inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Campo>}
            <CamposFunil campos={funil.campos ?? []} valores={form.dados} mudar={(d) => setForm({ ...form, dados: d })} />
            {mudou && <div className="acoes" style={{ marginTop: 6 }}><button className="btn primario" disabled={ocupado} onClick={salvar}>Salvar alterações</button></div>}
          </div>

          <div className="cartao">
            <h2>Responsável e vínculos</h2>
            <dl className="dados" style={{ marginTop: 10 }}>
              <dt>Dono</dt>
              <dd>
                <select value={card.dono ?? ''} onChange={(e) => mudarDono(e.target.value)}>
                  <option value="">Sem dono</option>
                  {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </dd>
              <dt>Empresa no CRM</dt>
              <dd>
                {card.conta_id
                  ? <><Link to={`/contas/${card.conta_id}`}>{card.conta_nome}</Link> <button className="btn-texto em-linha" disabled={ocupado} onClick={() => vincularConta(null)}>desvincular</button></>
                  : <button className="btn pequeno" onClick={() => setEscolher(true)}>{sugestoes.length ? `Vincular (sugestão: ${sugestoes[0].conta.nome})` : 'Vincular a uma empresa'}</button>}
              </dd>
              {card.lead_id && <><dt>Lead</dt><dd><Link to={`/leads/${card.lead_id}`}>Abrir lead</Link></dd></>}
              <dt>Origem</dt><dd>{card.origem === 'formulario' ? 'Formulário público' : nomeOrigem(card.origem)}</dd>
              {card.consentimento_em && <><dt>Autorização</dt><dd>dados autorizados em {dataHora(card.consentimento_em)}</dd></>}
            </dl>
            <button className="btn pequeno perigo" style={{ marginTop: 12 }} onClick={() => setExcluir(true)}>Excluir card</button>
          </div>
        </div>
      </div>

      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={() => setTick((t) => t + 1)} />
      <EscolherConta titulo={`Empresa de ${card.titulo}`} aberto={escolher} fechar={() => setEscolher(false)} escolher={(c, m) => vincularConta(c, m)} sugestoes={sugestoes} ocupado={ocupado} />
      <Modal titulo="Excluir card" aberto={excluir} fechar={() => setExcluir(false)}
        rodape={<><button className="btn" onClick={() => setExcluir(false)}>Cancelar</button><button className="btn perigo" disabled={ocupado} onClick={apagar}>Excluir de vez</button></>}>
        <p>O card “{card.titulo}” e o histórico dele neste funil serão apagados. Não dá para desfazer. Para tirar do quadro sem apagar, mova para uma etapa de encerramento.</p>
      </Modal>
    </>
  );
}
