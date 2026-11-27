import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ApresentacaoProposta, { type DadosApresentacao } from '../components/ApresentacaoProposta';
import { lerServicos } from '../../shared/propostaLumi';

type Publica = DadosApresentacao & { status: string; vencida: boolean };

/** Página que o cliente abre pelo link da proposta: a apresentação escolhida, o investimento e o aceite. Não exige login. */
export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [p, setP] = useState<Publica | null>(null);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState('');

  useEffect(() => {
    fetch(`/api/proposta?t=${encodeURIComponent(token ?? '')}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.erro); setP({ ...j, servicos: lerServicos(j.servicos), servicos_total: Number(j.servicos_total ?? 0) }); })
      .catch((e: Error) => setErro(e.message || 'Proposta não encontrada'));
  }, [token]);

  useEffect(() => { if (p) document.title = `Proposta Lumi · ${p.empresa}`; }, [p]);

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
    return <div className="ap-pagina"><div className="ap"><div className="ap-resposta">{erro ? <div className="aviso erro">{erro}</div> : 'Carregando…'}</div></div></div>;
  }
  const aberta = p.status === 'enviada' && !p.vencida;

  return (
    <div className="ap-pagina">
      <ApresentacaoProposta p={p} depois={
        <>
          {p.status === 'aceita' && <div className="aviso ok">{resposta ? 'Obrigado! Recebemos o seu aceite e vamos entrar em contato com os próximos passos.' : 'Proposta aceita.'}</div>}
          {p.status === 'recusada' && <div className="aviso">{resposta ? 'Resposta registrada. Obrigado pelo retorno.' : 'Proposta recusada.'}</div>}
          {p.vencida && p.status === 'enviada' && <div className="aviso">Esta proposta venceu. Fale com {p.responsavel?.nome ?? 'a gente'} para atualizar os valores.</div>}
          {aberta && (
            <div className="ap-resposta nao-imprimir">
              <h3>Responder à proposta</h3>
              {erro && <div className="aviso erro">{erro}</div>}
              <div className="campo">
                <label>Seu nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome de quem está respondendo" />
              </div>
              <div className="acoes">
                <button className="btn" disabled={enviando} onClick={() => responder('recusada')}>Recusar</button>
                <button className="btn destaque" disabled={enviando} onClick={() => responder('aceita')}>Aceitar proposta</button>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>O aceite registra a sua concordância com os valores. O contrato é enviado em seguida.</p>
              {p.responsavel && <p className="muted" style={{ fontSize: 13 }}>Dúvidas: {p.responsavel.nome} · <a href={`mailto:${p.responsavel.email}`}>{p.responsavel.email}</a></p>}
            </div>
          )}
          <div className="acoes nao-imprimir"><button className="btn" onClick={() => window.print()}>Imprimir ou salvar em PDF</button></div>
        </>
      } />
    </div>
  );
}
