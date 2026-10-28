import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { brl, data } from '../lib/formato';

interface Publica {
  versao: number; plano: 'starter' | 'premium'; vidas: number; preco_vida: number; mensal_tabela: number; desconto_pct: number; mensal: number;
  implementacao_tabela: number; desconto_implementacao_pct: number; implementacao: number; primeiro_ano: number; validade: string;
  observacoes: string | null; status: string; criado_em: string; empresa: string; responsavel: { nome: string; email: string } | null; vencida: boolean;
}

/** Página que o cliente abre pelo link da proposta. Não exige login. */
export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [p, setP] = useState<Publica | null>(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState('');

  useEffect(() => {
    fetch(`/api/proposta?t=${encodeURIComponent(token ?? '')}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.erro); setP(j); })
      .catch((e: Error) => setErro(e.message || 'Proposta não encontrada'));
  }, [token]);

  const responder = async (r: 'aceita' | 'recusada') => {
    if (!nome.trim()) { setErro('Escreva seu nome para registrar a resposta'); return; }
    setEnviando(true); setErro('');
    const res = await fetch('/api/proposta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, resposta: r, nome: nome.trim() }) });
    const j = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) { setErro(j.erro ?? 'Não foi possível registrar'); return; }
    setResposta(r);
    setP((x) => (x ? { ...x, status: r } : x));
  };

  if (!p) {
    return <div className="publica"><div className="folha"><div className="corpo">{erro ? <div className="aviso erro">{erro}</div> : 'Carregando…'}</div></div></div>;
  }
  const plano = p.plano === 'premium' ? 'Premium' : 'Starter';
  const aberta = p.status === 'enviada' && !p.vencida;

  return (
    <div className="publica">
      <article className="folha">
        <header className="cabeca">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10 L50 16 L31 29 Z" fill="#9DB0D0" /><path d="M31 29 L54 20 L36 52 Z" fill="#3B72D9" /><path d="M8 10 L31 29 L26 54 Z" fill="#fff" /></svg>
            <strong style={{ fontFamily: 'Lexend', fontSize: 20 }}>lumi</strong>
          </div>
          <h1 style={{ marginTop: 22, fontSize: 26 }}>Proposta para {p.empresa}</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--nevoa)' }}>Plano {plano} · versão {p.versao} · emitida em {data(p.criado_em)} · válida até {data(p.validade)}</p>
        </header>
        <div className="corpo">
          {p.status === 'aceita' && <div className="aviso ok">{resposta ? 'Obrigado! Recebemos o seu aceite e vamos entrar em contato com os próximos passos.' : 'Proposta aceita.'}</div>}
          {p.status === 'recusada' && <div className="aviso">{resposta ? 'Resposta registrada. Obrigado pelo retorno.' : 'Proposta recusada.'}</div>}
          {p.vencida && p.status === 'enviada' && <div className="aviso">Esta proposta venceu. Fale com {p.responsavel?.nome ?? 'a gente'} para atualizar os valores.</div>}

          <div className="grade g2" style={{ marginTop: 8 }}>
            <div>
              <div className="muted">Mensalidade</div>
              <div className="preco-grande">{brl(Number(p.mensal))}</div>
              <div className="muted">{p.vidas.toLocaleString('pt-BR')} colaboradores · {brl(Number(p.preco_vida))} por colaborador/mês</div>
            </div>
            <div>
              <div className="muted">Primeiro ano</div>
              <div className="preco-grande">{brl(Number(p.primeiro_ano))}</div>
              <div className="muted">12 mensalidades + implementação</div>
            </div>
          </div>

          <table className="tabela" style={{ marginTop: 22 }}>
            <tbody>
              <tr><td>Plano {plano}: {p.vidas.toLocaleString('pt-BR')} colaboradores</td><td className="num">{brl(Number(p.mensal_tabela))}/mês</td></tr>
              {Number(p.desconto_pct) > 0 && <tr><td>Desconto comercial ({p.desconto_pct}%)</td><td className="num">−{brl(Number(p.mensal_tabela) - Number(p.mensal))}/mês</td></tr>}
              <tr><td><strong>Mensalidade</strong></td><td className="num"><strong>{brl(Number(p.mensal))}/mês</strong></td></tr>
              <tr><td>Implementação (anual){Number(p.desconto_implementacao_pct) > 0 ? ` · ${p.desconto_implementacao_pct}% de desconto sobre ${brl(Number(p.implementacao_tabela))}` : ''}</td><td className="num">{brl(Number(p.implementacao))}</td></tr>
            </tbody>
          </table>

          {p.observacoes && <><h3 style={{ marginTop: 22 }}>Condições</h3><p style={{ whiteSpace: 'pre-wrap' }}>{p.observacoes}</p></>}

          {p.responsavel && (
            <p className="muted" style={{ marginTop: 22 }}>Dúvidas: {p.responsavel.nome} · <a href={`mailto:${p.responsavel.email}`}>{p.responsavel.email}</a></p>
          )}

          {aberta && (
            <div className="cartao nao-imprimir" style={{ marginTop: 22, background: '#fafbfd' }}>
              <h3>Responder à proposta</h3>
              {erro && <div className="aviso erro" style={{ marginTop: 10 }}>{erro}</div>}
              <div className="campo" style={{ marginTop: 10 }}>
                <label>Seu nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome de quem está respondendo" />
              </div>
              <div className="acoes">
                <button className="btn" disabled={enviando} onClick={() => responder('recusada')}>Recusar</button>
                <button className="btn destaque" disabled={enviando} onClick={() => responder('aceita')}>Aceitar proposta</button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>O aceite registra a sua concordância com os valores. O contrato é enviado em seguida.</p>
            </div>
          )}
          <div className="acoes nao-imprimir" style={{ marginTop: 16 }}><button className="btn" onClick={() => window.print()}>Imprimir ou salvar em PDF</button></div>
        </div>
      </article>
    </div>
  );
}
