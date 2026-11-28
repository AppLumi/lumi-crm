import { useCallback, useEffect, useState } from 'react';
import { supabase, ok } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { TIPOS_ATIVIDADE, dataHora, relativo } from '../lib/formato';
import type { Atividade, TipoAtividade } from '../lib/tipos';
import { Campo, Selo, Vazio } from './ui';
import EnviarEmail, { type DestinoEmail } from './EnviarEmail';
import { CAMPOS_RECEBIDO, destinoResposta, type Recebido } from '../lib/respostas';

type Alvo = { lead_id?: string; conta_id?: string; oportunidade_id?: string; contato_id?: string; card_id?: string };

/** Linha do tempo de uma entidade + formulário rápido de registro (nota, ligação, reunião, WhatsApp, tarefa). */

/** Texto com os links (http/https) clicáveis, como o "Análise completa" das notas do Sales Coach. */
function comLinks(t: string) {
  return t.split(/(https?:\/\/[^\s]+)/g).map((parte, i) => /^https?:\/\//.test(parte)
    ? <a key={i} href={parte} target="_blank" rel="noreferrer">{parte}</a> : parte);
}
export default function LinhaDoTempo({ alvo, filtro, atualizar }: { alvo: Alvo; filtro: { coluna: string; valor: string }; atualizar?: number }) {
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const [itens, setItens] = useState<Atividade[] | null>(null);
  const [tipo, setTipo] = useState<TipoAtividade>('nota');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [vence, setVence] = useState('');
  const [resp, setResp] = useState('');
  const [recebidos, setRecebidos] = useState<Map<string, Recebido>>(new Map());
  const [responder, setResponder] = useState<DestinoEmail | null>(null);

  const carregar = useCallback(async () => {
    const r = await supabase.from('atividades').select('*').eq(filtro.coluna, filtro.valor).order('criado_em', { ascending: false }).limit(200);
    const lista = (r.data ?? []) as Atividade[];
    setItens(lista);
    // respostas por e-mail: pra mostrar "Responder" ou "Respondido"
    const ids = [...new Set(lista.map((a) => a.email_recebido_id).filter(Boolean))] as string[];
    if (ids.length) {
      const e = await supabase.from('emails_recebidos').select(CAMPOS_RECEBIDO).in('id', ids);
      setRecebidos(new Map(((e.data ?? []) as Recebido[]).map((x) => [x.id, x])));
    }
  }, [filtro.coluna, filtro.valor]);

  useEffect(() => { carregar(); }, [carregar, atualizar]);

  const registrar = () => executar(async () => {
    const t = titulo.trim() || TIPOS_ATIVIDADE[tipo].nome;
    if (tipo === 'tarefa' && !vence) throw new Error('Defina o prazo da tarefa');
    ok(await supabase.from('atividades').insert({
      ...alvo, tipo, titulo: t, descricao: descricao.trim() || null, autor: perfil?.id,
      responsavel: tipo === 'tarefa' ? (resp || perfil?.id) : null,
      vence_em: tipo === 'tarefa' && vence ? new Date(vence).toISOString() : null,
    }));
    if (alvo.lead_id && ['ligacao', 'reuniao', 'whatsapp', 'email'].includes(tipo)) {
      await supabase.from('leads').update({ primeiro_contato_em: new Date().toISOString(), status: 'em_contato' })
        .eq('id', alvo.lead_id).is('primeiro_contato_em', null);
    }
    setTitulo(''); setDescricao(''); setVence('');
    await carregar();
  }, 'Registrado');

  const concluir = (a: Atividade) => executar(async () => {
    ok(await supabase.from('atividades').update({ concluida_em: a.concluida_em ? null : new Date().toISOString() }).eq('id', a.id));
    await carregar();
  });

  return (
    <div className="cartao">
      <h2>Linha do tempo</h2>
      <div className="abas" role="tablist">
        {(['nota', 'ligacao', 'reuniao', 'whatsapp', 'tarefa'] as TipoAtividade[]).map((t) => (
          <button key={t} className={tipo === t ? 'ativa' : ''} onClick={() => setTipo(t)}>{TIPOS_ATIVIDADE[t].nome}</button>
        ))}
      </div>
      <Campo rotulo={tipo === 'tarefa' ? 'O que fazer' : 'Título (opcional)'}>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'tarefa' ? 'Ex.: ligar para confirmar a demo' : TIPOS_ATIVIDADE[tipo].nome} />
      </Campo>
      {tipo === 'tarefa' ? (
        <div className="linha-campos">
          <Campo rotulo="Prazo"><input type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} /></Campo>
          <Campo rotulo="Responsável">
            <select value={resp || perfil?.id || ''} onChange={(e) => setResp(e.target.value)}>
              {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
        </div>
      ) : (
        <Campo rotulo="Detalhes"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que foi conversado, próximos passos…" /></Campo>
      )}
      <div className="acoes"><button className="btn primario" disabled={ocupado} onClick={registrar}>Registrar</button></div>

      <ul className="tempo" style={{ marginTop: 14 }}>
        {itens === null ? <li><span /><span className="muted">Carregando…</span></li> : null}
        {itens?.length === 0 && <Vazio>Nada registrado ainda.</Vazio>}
        {itens?.map((a) => (
          <li key={a.id}>
            <span className="icone" title={TIPOS_ATIVIDADE[a.tipo].nome}>{TIPOS_ATIVIDADE[a.tipo].icone}</span>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ textDecoration: a.concluida_em ? 'line-through' : undefined }}>{a.titulo}</strong>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {a.tipo === 'email' && a.email_recebido_id && recebidos.get(a.email_recebido_id) && (() => {
                    const r = recebidos.get(a.email_recebido_id)!;
                    return r.respondido_em ? <Selo cor="verde">Respondido</Selo>
                      : <button className="btn pequeno primario" onClick={() => setResponder(destinoResposta(r))}>Responder</button>;
                  })()}
                  {a.tipo === 'tarefa' && <button className="btn pequeno" onClick={() => concluir(a)}>{a.concluida_em ? 'Reabrir' : 'Concluir'}</button>}
                </span>
              </div>
              <div className="quando" title={dataHora(a.criado_em)}>
                {relativo(a.criado_em)}
                {a.autor && ` · ${time.find((p) => p.id === a.autor)?.nome ?? ''}`}
                {a.vence_em && ` · prazo ${dataHora(a.vence_em)}`}
                {a.responsavel && a.tipo === 'tarefa' && ` · com ${time.find((p) => p.id === a.responsavel)?.nome ?? ''}`}
              </div>
              {a.descricao && <div className="descricao">{comLinks(a.descricao)}</div>}
            </div>
          </li>
        ))}
      </ul>
      <EnviarEmail destino={responder} fechar={() => setResponder(null)} enviado={carregar} />
    </div>
  );
}
