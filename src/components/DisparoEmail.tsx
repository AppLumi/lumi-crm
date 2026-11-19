import { useEffect, useMemo, useState } from 'react';
import { api, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import type { Lead, ModeloEmail } from '../lib/tipos';
import { NOMES_MOTIVO, VARIAVEIS_DISPARO, preencher, problemasDoTexto, variaveisDoLead, type MotivoFora } from '../../shared/disparo';
import { Campo, Modal } from './ui';

interface Previa { selecionados: number; recebem: number; fora: Record<MotivoFora, number>; sem_aceite: number; problemas: string[] }
interface Resultado { enviados: number; falhas: number }

/** Disparo em massa: escrever → revisar (prévia, teste para mim) → enviar. */
export default function DisparoEmail({ leads, fechar, enviado }: { leads: Lead[]; fechar: () => void; enviado?: () => void }) {
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [modelos, setModelos] = useState<ModeloEmail[]>([]);
  const [modeloId, setModeloId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [soComAceite, setSoComAceite] = useState(false);
  const [passo, setPasso] = useState<'escrever' | 'revisar' | 'feito'>('escrever');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [chave] = useState(() => crypto.randomUUID());

  useEffect(() => {
    supabase.from('modelos_email').select('*').eq('ativo', true).order('nome').then(({ data }) => setModelos((data ?? []) as ModeloEmail[]));
  }, []);

  const ids = useMemo(() => leads.map((l) => l.id), [leads]);
  const exemplo = leads.find((l) => l.email) ?? leads[0];
  const vars = exemplo ? variaveisDoLead(exemplo, perfil?.nome ?? 'Equipe Lumi') : {};
  const problemas = problemasDoTexto(assunto, corpo);

  const usar = (id: string) => {
    setModeloId(id);
    const m = modelos.find((x) => x.id === id);
    if (m) { setAssunto(m.assunto); setCorpo(m.corpo); }
  };
  const corpoReq = (modo: string) => ({ modo, lead_ids: ids, assunto, corpo, modelo_id: modeloId || null, so_com_aceite: soComAceite, chave });

  const revisar = () => executar(async () => {
    if (problemas.length) throw new Error(problemas[0]);
    setPrevia(await api<Previa>('emails/disparo', { corpo: corpoReq('previa') }));
    setConfirmar(false);
    setPasso('revisar');
  });
  const teste = () => executar(async () => { await api('emails/disparo', { corpo: corpoReq('teste') }); }, `Teste enviado para ${perfil?.email}`);
  const disparar = () => executar(async () => {
    const r = await api<Resultado>('emails/disparo', { corpo: corpoReq('enviar') });
    setResultado(r);
    setPasso('feito');
    enviado?.();
  });

  const foraTexto = previa ? (Object.entries(previa.fora) as [MotivoFora, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${NOMES_MOTIVO[k]}`) : [];

  const rodape = passo === 'escrever'
    ? <><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primario" disabled={ocupado || !assunto || !corpo} onClick={revisar}>Revisar envio</button></>
    : passo === 'revisar'
      ? <>
          <button className="btn" onClick={() => setPasso('escrever')} disabled={ocupado}>Voltar e editar</button>
          <button className="btn" onClick={teste} disabled={ocupado || !previa?.recebem}>Enviar teste para mim</button>
          {confirmar
            ? <button className="btn primario" disabled={ocupado} onClick={disparar}>{ocupado ? 'Enviando…' : `Confirmar: enviar para ${previa?.recebem}`}</button>
            : <button className="btn primario" disabled={ocupado || !previa?.recebem} onClick={() => setConfirmar(true)}>Enviar para {previa?.recebem ?? 0}</button>}
        </>
      : <button className="btn primario" onClick={fechar}>Fechar</button>;

  return (
    <Modal titulo={`E-mail em massa · ${leads.length} lead(s) selecionado(s)`} aberto fechar={ocupado ? () => {} : fechar} largura={760} rodape={rodape}>
      {passo === 'escrever' && (
        <>
          <div className="aviso info">Cada pessoa recebe um e-mail só dela, personalizado, saindo como “{perfil?.nome} · Lumi”. Respostas chegam no seu e-mail. O link de descadastro entra sozinho no fim.</div>
          <div className="linha-campos">
            <Campo rotulo="Modelo">
              <select value={modeloId} onChange={(e) => usar(e.target.value)}>
                <option value="">Escrever do zero</option>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Quem recebe">
              <select value={soComAceite ? 'aceite' : 'todos'} onChange={(e) => setSoComAceite(e.target.value === 'aceite')}>
                <option value="todos">Todos os selecionados com e-mail</option>
                <option value="aceite">Só quem autorizou receber conteúdos</option>
              </select>
            </Campo>
          </div>
          <Campo rotulo="Assunto"><input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></Campo>
          <Campo rotulo="Mensagem" ajuda={`Variáveis: ${VARIAVEIS_DISPARO.map((v) => `{{${v}}}`).join(' ')}. Linhas que começam com “- ” viram lista; links ficam clicáveis.`}>
            <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} style={{ minHeight: 220 }} />
          </Campo>
          {problemas.length > 0 && (assunto || corpo) && <div className="aviso erro" style={{ fontSize: 13 }}>{problemas.join('. ')}.</div>}
          {exemplo && assunto && corpo && (
            <div className="cartao" style={{ marginTop: 6 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Como chega para {exemplo.nome}{exemplo.email ? ` (${exemplo.email})` : ''}</div>
              <strong>{preencher(assunto, vars)}</strong>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, margin: '8px 0 0' }}>{preencher(corpo, vars)}</p>
            </div>
          )}
        </>
      )}

      {passo === 'revisar' && previa && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="cartao">
            <div style={{ fontSize: 30, fontFamily: 'Lexend, sans-serif', fontWeight: 600 }}>{previa.recebem}</div>
            <div>pessoa(s) vão receber “{assunto}”</div>
            {foraTexto.length > 0 && <div className="muted" style={{ marginTop: 6 }}>Ficam de fora: {foraTexto.join(' · ')}.</div>}
          </div>
          {!soComAceite && previa.sem_aceite > 0 && (
            <div className="aviso info" style={{ fontSize: 13 }}>{previa.sem_aceite} dessas pessoas não marcaram que aceitam conteúdos do Lumi. Mande só se o assunto for a conversa comercial que elas pediram; para newsletter e novidades, volte e escolha “Só quem autorizou”.</div>
          )}
          {confirmar
            ? <div className="aviso erro">Confira o assunto e o texto: depois de enviado não dá para desfazer. Clique em “Confirmar” para mandar agora.</div>
            : <div className="muted" style={{ fontSize: 13 }}>Dica: mande um teste para você antes, para ver como chega na caixa de entrada.</div>}
          {ocupado && confirmar && <div className="aviso info">Enviando em lotes de 100. Não feche esta janela.</div>}
        </div>
      )}

      {passo === 'feito' && resultado && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className={`aviso ${resultado.falhas ? 'erro' : 'ok'}`}>
            {resultado.enviados} e-mail(s) enviado(s){resultado.falhas ? `, ${resultado.falhas} falharam (aparecem como “Falhou” em E-mails)` : ''}.
          </div>
          <div className="muted" style={{ fontSize: 13 }}>Acompanhe entregas, aberturas e cliques em E-mails → Disparos. Cada envio também ficou na linha do tempo do lead.</div>
        </div>
      )}
    </Modal>
  );
}
