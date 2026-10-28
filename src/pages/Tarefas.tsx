import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { dataHora } from '../lib/formato';
import type { Atividade } from '../lib/tipos';
import { Carregando, Selo, Vazio } from '../components/ui';

type Tarefa = Atividade & { contas: { nome: string } | null; leads: { nome: string } | null };

export default function Tarefas() {
  const { perfil, time } = useSessao();
  const { executar } = useAcao();
  const [quem, setQuem] = useState(perfil?.id ?? '');
  const [ver, setVer] = useState<'abertas' | 'concluidas'>('abertas');
  const [itens, setItens] = useState<Tarefa[] | null>(null);

  const carregar = useCallback(async () => {
    let q = supabase.from('atividades').select('*, contas(nome), leads(nome)').eq('tipo', 'tarefa');
    q = ver === 'abertas' ? q.is('concluida_em', null).order('vence_em', { ascending: true, nullsFirst: false })
      : q.not('concluida_em', 'is', null).order('concluida_em', { ascending: false }).limit(100);
    if (quem) q = q.eq('responsavel', quem);
    const r = await q;
    setItens((r.data ?? []) as Tarefa[]);
  }, [quem, ver]);
  useEffect(() => { carregar(); }, [carregar]);

  const alternar = (t: Tarefa) => executar(async () => {
    ok(await supabase.from('atividades').update({ concluida_em: t.concluida_em ? null : new Date().toISOString() }).eq('id', t.id));
    await carregar();
  });

  const agora = new Date();
  const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999);
  const grupos = ver === 'abertas'
    ? [
        { nome: 'Atrasadas', itens: (itens ?? []).filter((t) => t.vence_em && new Date(t.vence_em) < agora) },
        { nome: 'Hoje', itens: (itens ?? []).filter((t) => t.vence_em && new Date(t.vence_em) >= agora && new Date(t.vence_em) <= fimHoje) },
        { nome: 'Próximas', itens: (itens ?? []).filter((t) => !t.vence_em || new Date(t.vence_em) > fimHoje) },
      ]
    : [{ nome: 'Concluídas', itens: itens ?? [] }];

  return (
    <>
      <div className="topo">
        <div><h1>Tarefas</h1><p>Crie tarefas pela linha do tempo de um lead, conta ou oportunidade.</p></div>
        <div className="filtros" style={{ margin: 0 }}>
          <select value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="">Todo o time</option>
            {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select value={ver} onChange={(e) => setVer(e.target.value as typeof ver)}>
            <option value="abertas">Abertas</option>
            <option value="concluidas">Concluídas</option>
          </select>
        </div>
      </div>
      {!itens ? <Carregando /> : itens.length === 0 ? <Vazio>Nenhuma tarefa aqui.</Vazio> : grupos.filter((g) => g.itens.length).map((g) => (
        <div className="cartao" key={g.nome} style={{ marginBottom: 16 }}>
          <h2>{g.nome} <span className="muted" style={{ fontSize: 13 }}>{g.itens.length}</span></h2>
          <table className="tabela" style={{ marginTop: 8 }}><tbody>
            {g.itens.map((t) => {
              const link = t.oportunidade_id ? `/oportunidades/${t.oportunidade_id}` : t.lead_id ? `/leads/${t.lead_id}` : t.conta_id ? `/contas/${t.conta_id}` : null;
              return (
                <tr key={t.id}>
                  <td style={{ width: 36 }}><input type="checkbox" style={{ width: 'auto' }} checked={!!t.concluida_em} onChange={() => alternar(t)} aria-label="Concluir" /></td>
                  <td><strong style={{ textDecoration: t.concluida_em ? 'line-through' : undefined }}>{t.titulo}</strong>{t.descricao && <div className="muted">{t.descricao}</div>}</td>
                  <td>{link ? <Link to={link}>{t.contas?.nome ?? t.leads?.nome ?? 'abrir'}</Link> : '—'}</td>
                  <td>{time.find((p) => p.id === t.responsavel)?.nome ?? '—'}</td>
                  <td className="num">{g.nome === 'Atrasadas' ? <Selo cor="vermelho">{dataHora(t.vence_em)}</Selo> : dataHora(t.concluida_em ?? t.vence_em)}</td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      ))}
    </>
  );
}
