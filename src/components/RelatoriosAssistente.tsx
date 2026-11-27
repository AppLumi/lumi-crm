import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dataHora } from '../lib/formato';
import { useSessao } from '../lib/sessao';
import Markdown from './Markdown';
import { Modal } from './ui';

interface Relatorio { id: string; titulo: string; conteudo: string; pedido: string | null; criado_por: string | null; criado_em: string }

/** Relatórios montados pelo assistente e guardados pelo time. */
export default function RelatoriosAssistente() {
  const { time } = useSessao();
  const [lista, setLista] = useState<Relatorio[] | null>(null);
  const [aberto, setAberto] = useState<Relatorio | null>(null);
  const [apagar, setApagar] = useState(false);

  const carregar = useCallback(async () => {
    const r = await supabase.from('relatorios_assistente').select('*').order('criado_em', { ascending: false }).limit(50);
    setLista(r.error ? [] : (r.data ?? []) as Relatorio[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (!lista?.length) return null;
  const nome = (id: string | null) => time.find((p) => p.id === id)?.nome ?? '—';
  const excluir = async () => {
    if (!aberto) return;
    await supabase.from('relatorios_assistente').delete().eq('id', aberto.id);
    setApagar(false); setAberto(null); carregar();
  };

  return (
    <div className="cartao" style={{ marginBottom: 16 }}>
      <h2>Relatórios do assistente</h2>
      <div style={{ display: 'grid', gap: 6 }}>
        {lista.map((r) => (
          <button key={r.id} className="btn" style={{ justifyContent: 'space-between', height: 'auto', padding: '9px 12px', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => setAberto(r)}>
            <span><b>{r.titulo}</b></span><span className="muted" style={{ fontSize: 12 }}>{nome(r.criado_por)} · {dataHora(r.criado_em)}</span>
          </button>
        ))}
      </div>
      <Modal titulo={aberto?.titulo ?? ''} aberto={!!aberto} fechar={() => { setAberto(null); setApagar(false); }} largura={820}
        rodape={apagar
          ? <><button className="btn" onClick={() => setApagar(false)}>Cancelar</button><button className="btn perigo" onClick={excluir}>Excluir de vez</button></>
          : <><button className="btn perigo" onClick={() => setApagar(true)}>Excluir</button><button className="btn primario" onClick={() => setAberto(null)}>Fechar</button></>}>
        {aberto && <>
          <p className="muted" style={{ marginTop: 0 }}>Guardado por {nome(aberto.criado_por)} em {dataHora(aberto.criado_em)}{aberto.pedido ? ` · pedido: “${aberto.pedido.slice(0, 160)}”` : ''}</p>
          <Markdown texto={aberto.conteudo} />
        </>}
      </Modal>
    </div>
  );
}
