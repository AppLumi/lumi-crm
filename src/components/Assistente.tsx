import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import Markdown from './Markdown';

type Modo = 'conversa' | 'treino' | 'roleplay' | 'relatorio';
interface Msg { role: 'user' | 'assistant'; content: string; relatorio?: { id: string; titulo: string } | null; erro?: boolean }

const MODOS: { id: Modo; nome: string; vazio: string; sugestoes: string[] }[] = [
  { id: 'conversa', nome: 'Perguntar', vazio: 'Pergunte qualquer coisa sobre o Lumi, o app, o painel, a NR-1, preços ou o CRM.',
    sugestoes: ['Como o painel mostra o diagnóstico da NR-1?', 'Quanto custa o Lumi para 300 pessoas?', 'O que a NR-1 exige sobre riscos psicossociais?', 'O que o Lumi ainda não faz?'] },
  { id: 'treino', nome: 'Treinar', vazio: 'Treino com explicação e perguntas de fixação. Escolha um tema ou diga o seu.',
    sugestoes: ['Me treine sobre o produto', 'Me treine sobre a NR-1', 'Me treine em preços e proposta', 'Me treine em objeções'] },
  { id: 'roleplay', nome: 'Roleplay', vazio: 'O assistente faz o papel do cliente. Escolha o perfil, comece a conversa e escreva "fim" para receber o feedback.',
    sugestoes: ['Oi! Sou do Lumi, do mesmo grupo da Grou. Tem 5 minutos?'] },
  { id: 'relatorio', nome: 'Relatório', vazio: 'Peça um relatório com os números do CRM. Depois, guarde em Relatórios para o time ver.',
    sugestoes: ['Relatório do funil dos últimos 30 dias', 'Como está a prospecção dos clientes Grou esta semana?', 'Motivos de perda dos últimos 90 dias', 'Atividades do time por pessoa nos últimos 7 dias'] },
];

const PERSONAS = [
  'Gerente de RH de uma indústria de 300 pessoas, cliente da Grou (usa PDA), que ainda não fez o diagnóstico psicossocial da NR-1 e tem pouco orçamento.',
  'Diretora de pessoas de uma rede de varejo com 4.000 funcionários, já faz pesquisa de clima e acha que a NR-1 vai ser adiada.',
  'Dono de uma empresa de tecnologia com 45 pessoas, cético com "app de bem-estar" e preocupado com custo.',
  'Técnico de segurança do trabalho (SESMT) de uma construtora com 900 pessoas, focado em PGR e em evidências para fiscalização.',
];

const chave = (uid: string) => `lumi-crm:assistente:${uid}`;
const ler = (uid: string): Record<Modo, Msg[]> | null => { try { return JSON.parse(localStorage.getItem(chave(uid)) ?? 'null'); } catch { return null; } };
const vazio = (): Record<Modo, Msg[]> => ({ conversa: [], treino: [], roleplay: [], relatorio: [] });

/** Botão flutuante do assistente: perguntas, treino, roleplay e relatórios, em qualquer tela do CRM. */
export default function Assistente() {
  const { perfil } = useSessao();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>('conversa');
  const [conversas, setConversas] = useState<Record<Modo, Msg[]>>(vazio);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [salvando, setSalvando] = useState<number | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const uid = perfil?.id;
  useEffect(() => { if (uid) setConversas(ler(uid) ?? vazio()); }, [uid]);
  useEffect(() => { if (uid) try { localStorage.setItem(chave(uid), JSON.stringify(conversas)); } catch { /* sem armazenamento */ } }, [conversas, uid]);
  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }); }, [conversas, modo, aberto, enviando]);
  useEffect(() => { if (aberto) campoRef.current?.focus(); }, [aberto, modo]);

  if (!perfil) return null;
  const msgs = conversas[modo];
  const info = MODOS.find((m) => m.id === modo)!;

  const enviar = async (t = texto) => {
    const conteudo = t.trim();
    if (!conteudo || enviando) return;
    const nova: Msg[] = [...msgs, { role: 'user', content: conteudo }];
    setConversas((c) => ({ ...c, [modo]: nova }));
    setTexto(''); setEnviando(true);
    try {
      const r = await api<{ texto: string; relatorio?: { id: string; titulo: string } | null; cortado?: boolean }>('assistente', {
        corpo: { modo, persona: modo === 'roleplay' ? persona : undefined, mensagens: nova.filter((m) => !m.erro).map((m) => ({ role: m.role, content: m.content })) },
      });
      setConversas((c) => ({ ...c, [modo]: [...nova, { role: 'assistant', content: r.texto + (r.cortado ? '\n\n*(Resposta cortada por tamanho. Peça para continuar.)*' : ''), relatorio: r.relatorio ?? null }] }));
    } catch (e) {
      setConversas((c) => ({ ...c, [modo]: [...nova, { role: 'assistant', content: (e as Error).message, erro: true }] }));
    } finally { setEnviando(false); }
  };

  const guardar = async (i: number) => {
    const m = msgs[i];
    setSalvando(i);
    const titulo = (/^#{1,4}\s+(.+)$/m.exec(m.content)?.[1] ?? 'Relatório do assistente').replace(/\*\*/g, '').slice(0, 200);
    const pedido = msgs.slice(0, i).filter((x) => x.role === 'user').at(-1)?.content ?? null;
    const { data, error } = await supabase.from('relatorios_assistente').insert({ titulo, conteudo: m.content, pedido, criado_por: perfil.id }).select('id').single();
    setSalvando(null);
    setConversas((c) => ({ ...c, [modo]: c[modo].map((x, j) => j === i ? { ...x, relatorio: error ? null : { id: (data as { id: string }).id, titulo } } : x) }));
    if (error) alert(/relatorios_assistente/.test(error.message) ? 'Falta rodar a migração 0006 no Supabase do CRM.' : error.message);
  };

  return (
    <>
      <button className={`assist-botao${aberto ? ' aberto' : ''}`} onClick={() => setAberto((a) => !a)} aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente do Lumi'} title="Assistente do Lumi">
        {aberto ? '×' : <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" fill="currentColor"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" fill="currentColor"/></svg>}
      </button>
      {aberto && (
        <section className="assist-painel" aria-label="Assistente do Lumi">
          <header>
            <div><b>Assistente do Lumi</b><span>produto, NR-1, vendas e números do CRM</span></div>
            <button className="btn-texto" onClick={() => setConversas((c) => ({ ...c, [modo]: [] }))} disabled={enviando || !msgs.length}>Nova conversa</button>
          </header>
          <nav className="assist-modos">
            {MODOS.map((m) => <button key={m.id} className={m.id === modo ? 'on' : ''} onClick={() => setModo(m.id)}>{m.nome}</button>)}
          </nav>
          {modo === 'roleplay' && (
            <div className="assist-persona">
              <label>Cliente:</label>
              <select value={PERSONAS.includes(persona) ? persona : ''} onChange={(e) => setPersona(e.target.value || '')} disabled={msgs.length > 0}>
                {PERSONAS.map((p) => <option key={p} value={p}>{p.split(',')[0]}</option>)}
                <option value="">Outro perfil…</option>
              </select>
              {!PERSONAS.includes(persona) && <input placeholder="Descreva o cliente (cargo, empresa, situação)" value={persona} onChange={(e) => setPersona(e.target.value)} disabled={msgs.length > 0} />}
            </div>
          )}
          <div className="assist-msgs">
            {!msgs.length && (
              <div className="assist-vazio">
                <p>{info.vazio}</p>
                <div>{info.sugestoes.map((s) => <button key={s} className="btn pequeno" onClick={() => enviar(s)}>{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`assist-msg ${m.role}${m.erro ? ' erro' : ''}`}>
                {m.role === 'assistant' ? <Markdown texto={m.content} /> : <p>{m.content}</p>}
                {m.role === 'assistant' && !m.erro && (m.relatorio
                  ? <Link className="assist-salvo" to="/relatorios" onClick={() => setAberto(false)}>✓ Guardado em Relatórios</Link>
                  : (modo === 'relatorio' || /^#{1,4}\s/m.test(m.content)) && m.content.length > 400 &&
                    <button className="btn-texto" disabled={salvando === i} onClick={() => guardar(i)}>{salvando === i ? 'Guardando…' : 'Guardar em Relatórios'}</button>)}
              </div>
            ))}
            {enviando && <div className="assist-msg assistant pensando"><i /><i /><i /></div>}
            <div ref={fimRef} />
          </div>
          <form className="assist-campo" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
            <textarea ref={campoRef} rows={2} value={texto} placeholder={modo === 'roleplay' ? 'Fale com o cliente… ("fim" para o feedback)' : 'Escreva aqui… (Enter envia)'}
              onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
            <button className="btn primario" disabled={enviando || !texto.trim()}>Enviar</button>
          </form>
        </section>
      )}
    </>
  );
}
