import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { primeiroNome } from '../lib/formato';
import { cadenciaPara, preencherTexto, proximoPasso, tituloPasso, zapComTexto, type PassoAbordagem } from '../../shared/abordagens';
import EnviarEmail, { type DestinoEmail } from './EnviarEmail';
import { Selo } from './ui';

export interface PessoaAbordagem {
  card_id: string; contato_id: string; nome: string; email: string | null; whatsapp: string | null;
  empresa: string | null; conta_id: string | null; lead_id: string | null; desde: string;
}

const NOME_CANAL = { email: 'E-mail', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', ligacao: 'Ligação' } as const;

/** Sugestões de abordagem no card: a mensagem certa de cada dia da cadência, pronta para enviar por e-mail ou WhatsApp. */
export default function SugestoesAbordagem({ p, aoRegistrar }: { p: PessoaAbordagem; aoRegistrar: () => void }) {
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [origem, setOrigem] = useState<string | null | undefined>(undefined);
  const [descadastrado, setDescadastrado] = useState(false);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [email, setEmail] = useState<DestinoEmail | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cad = cadenciaPara(origem);
  const carregar = useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from('contatos').select('origem, descadastrado_em').eq('id', p.contato_id).maybeSingle(),
      supabase.from('atividades').select('titulo').eq('card_id', p.card_id).like('titulo', 'Cadência · %'),
    ]);
    const ct = c.data as { origem: string | null; descadastrado_em: string | null } | null;
    setOrigem(ct?.origem ?? null); setDescadastrado(!!ct?.descadastrado_em);
    const cadencia = cadenciaPara(ct?.origem);
    const titulos = ((a.data ?? []) as { titulo: string }[]).map((x) => x.titulo);
    setFeitos(new Set((cadencia?.passos ?? []).filter((x) => titulos.some((t) => t.startsWith(`Cadência · ${x.rotulo} `))).map((x) => x.id)));
  }, [p.card_id, p.contato_id]);
  useEffect(() => { carregar(); }, [carregar]);

  const dias = Math.max(0, Math.floor((Date.now() - Date.parse(p.desde)) / 864e5));
  const prox = cad ? proximoPasso(cad, feitos, dias) : null;
  const passo: PassoAbordagem | null = cad ? cad.passos.find((x) => x.id === (escolhido ?? prox?.passo.id)) ?? null : null;
  const vars = useMemo(() => ({ primeiro_nome: primeiroNome(p.nome) || p.nome, nome: p.nome, empresa: p.empresa || 'sua empresa', remetente: perfil?.nome ?? 'Equipe Lumi' }), [p.nome, p.empresa, perfil?.nome]);

  useEffect(() => { setTexto(passo ? preencherTexto(passo.texto, vars) : ''); setCopiado(false); }, [passo?.id, vars]); // eslint-disable-line react-hooks/exhaustive-deps

  if (origem === undefined || !cad) return null;

  const marcar = (x: PassoAbordagem, pulado = false, descricao?: string) => executar(async () => {
    await supabase.from('atividades').insert({
      tipo: pulado ? 'sistema' : x.canal === 'whatsapp' ? 'whatsapp' : x.canal === 'ligacao' ? 'ligacao' : 'sistema',
      titulo: `${tituloPasso(x)}${pulado ? ' · pulado' : ''}`, descricao: descricao ?? null,
      card_id: p.card_id, conta_id: p.conta_id, lead_id: p.lead_id, contato_id: p.contato_id, autor: perfil?.id,
    });
    setEscolhido(null); await carregar(); aoRegistrar();
  }, pulado ? 'Passo pulado' : 'Passo registrado');

  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { setCopiado(false); } };
  const zap = passo?.canal === 'whatsapp' ? zapComTexto(p.whatsapp, texto) : null;
  const buscaLinkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.nome} ${p.empresa ?? ''}`.trim())}`;

  return (
    <div className="cartao">
      <h2>Abordagem sugerida · {cad.nome}</h2>
      <p className="muted" style={{ margin: '4px 0 12px' }}>Dia {dias} da cadência. Ajuste uma frase ao cargo da pessoa antes de enviar.</p>
      {descadastrado && <div className="aviso erro" style={{ marginBottom: 10 }}>Esta pessoa pediu para não receber mensagens. Não envie nada.</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {cad.passos.map((x) => (
          <button key={x.id} type="button" className={`btn pequeno${x.id === passo?.id ? ' primario' : ''}`} onClick={() => setEscolhido(x.id)} title={x.quando}>
            {feitos.has(x.id) ? '✓ ' : ''}Dia {x.dia} · {NOME_CANAL[x.canal]}
          </button>
        ))}
      </div>

      {!prox && !escolhido && <div className="aviso ok">Cadência concluída. Sem resposta, deixe a empresa em Prospecção e retome daqui a 90 dias com outro ângulo.</div>}

      {passo && (prox || escolhido) && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{passo.rotulo}</b>
            {feitos.has(passo.id) ? <Selo cor="verde">feito</Selo>
              : prox?.passo.id === passo.id ? <Selo cor={prox.situacao === 'atrasado' ? 'amarelo' : prox.situacao === 'hoje' ? 'lima' : ''}>{prox.situacao === 'atrasado' ? `previsto para o dia ${passo.dia}` : prox.situacao === 'hoje' ? 'para hoje' : `no dia ${passo.dia}`}</Selo> : null}
          </div>
          <p className="muted" style={{ margin: 0 }}>{passo.quando}</p>
          {passo.assunto && <div style={{ fontSize: 13 }}><span className="muted">Assunto:</span> {preencherTexto(passo.assunto, vars)}</div>}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} style={{ minHeight: passo.canal === 'email' || passo.canal === 'ligacao' ? 200 : 110 }} aria-label="Texto sugerido" />

          <div className="acoes" style={{ flexWrap: 'wrap' }}>
            {passo.canal === 'email' && (p.email
              ? <button className="btn primario" disabled={ocupado || descadastrado} onClick={() => setEmail({
                  para: p.email!, nome: p.nome, empresa: p.empresa, card_id: p.card_id, contato_id: p.contato_id,
                  conta_id: p.conta_id ?? undefined, lead_id: p.lead_id ?? undefined,
                  inicial: { assunto: preencherTexto(passo.assunto ?? '', vars), corpo: texto },
                })}>Revisar e enviar e-mail</button>
              : <span className="muted">Sem e-mail no card.</span>)}
            {passo.canal === 'whatsapp' && (zap && !descadastrado
              ? <a className="btn primario" href={zap} target="_blank" rel="noreferrer" onClick={() => marcar(passo, false, texto)}>Abrir no WhatsApp</a>
              : <span className="muted">{descadastrado ? 'Não enviar.' : 'Sem WhatsApp no card.'}</span>)}
            {passo.canal === 'linkedin' && <>
              <button className="btn primario" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar nota'}</button>
              <a className="btn" href={buscaLinkedin} target="_blank" rel="noreferrer">Procurar no LinkedIn</a>
              <button className="btn" disabled={ocupado} onClick={() => marcar(passo, false, texto)}>Marcar convite enviado</button>
            </>}
            {passo.canal === 'ligacao' && <button className="btn primario" disabled={ocupado} onClick={() => marcar(passo)}>Registrar ligação feita</button>}
            {(passo.canal === 'email' || passo.canal === 'whatsapp') && <button className="btn" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar texto'}</button>}
            {!feitos.has(passo.id) && <button className="btn-texto" disabled={ocupado} onClick={() => marcar(passo, true)}>Pular este passo</button>}
          </div>
        </div>
      )}

      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={() => { if (passo) marcar(passo); }} />
    </div>
  );
}
