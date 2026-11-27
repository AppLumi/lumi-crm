import { useEffect, useState } from 'react';
import { api, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { primeiroNome } from '../lib/formato';
import type { ModeloEmail } from '../lib/tipos';
import { Campo, Modal } from './ui';

export interface DestinoEmail {
  para: string; nome: string; empresa?: string | null;
  lead_id?: string; contato_id?: string; conta_id?: string; oportunidade_id?: string; card_id?: string;
  extras?: Record<string, string>;
  /** e-mails que dá para acrescentar com um clique (ex.: outros contatos da empresa) */
  sugestoes?: { email: string; nome: string }[];
  /** texto já pronto (ex.: sugestão de abordagem), que ainda pode ser editado antes de enviar */
  inicial?: { assunto: string; corpo: string };
}

const preencher = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? `{{${k}}}`);

export default function EnviarEmail({ destino, fechar, enviado }: { destino: DestinoEmail | null; fechar: () => void; enviado?: () => void }) {
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [modelos, setModelos] = useState<ModeloEmail[]>([]);
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [para, setPara] = useState('');

  useEffect(() => {
    if (!destino) return;
    supabase.from('modelos_email').select('*').eq('ativo', true).order('nome').then(({ data }) => setModelos((data ?? []) as ModeloEmail[]));
    setAssunto(destino.inicial?.assunto ?? ''); setCorpo(destino.inicial?.corpo ?? ''); setPara(destino.para ?? '');
  }, [destino]);

  if (!destino) return null;
  const vars: Record<string, string> = {
    primeiro_nome: primeiroNome(destino.nome), nome: destino.nome, empresa: destino.empresa ?? 'sua empresa',
    remetente: perfil?.nome ?? 'Equipe Lumi', ...(destino.extras ?? {}),
  };
  const usar = (id: string) => {
    const m = modelos.find((x) => x.id === id);
    if (!m) return;
    setAssunto(preencher(m.assunto, vars));
    setCorpo(preencher(m.corpo, vars));
  };
  const lista = para.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const acrescentar = (e: string) => { if (!lista.includes(e.toLowerCase())) setPara([...lista, e].join(', ')); };
  const enviar = () => executar(async () => {
    if (!lista.length) throw new Error('Informe pelo menos um e-mail');
    const invalido = lista.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
    if (invalido) throw new Error(`E-mail inválido: ${invalido}`);
    if (lista.length > 10) throw new Error('Envie para no máximo 10 e-mails de uma vez');
    if (/\{\{\w+\}\}/.test(assunto + corpo)) throw new Error('Ainda há campos {{…}} sem preencher no texto');
    if (/\[[^\]]+\]/.test(corpo)) throw new Error('Troque os trechos entre colchetes antes de enviar');
    await api('emails/enviar', { corpo: { para: lista.join(', '), assunto, corpo, lead_id: destino.lead_id, contato_id: destino.contato_id, conta_id: destino.conta_id, oportunidade_id: destino.oportunidade_id, card_id: destino.card_id } });
    enviado?.();
    fechar();
  }, 'E-mail enviado');

  return (
    <Modal titulo={`E-mail para ${destino.nome}`} aberto fechar={fechar} largura={700}
      rodape={<><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primario" disabled={ocupado || !assunto || !corpo || !lista.length} onClick={enviar}>Enviar{lista.length > 1 ? ` para ${lista.length}` : ''}</button></>}>
      <div className="aviso info">Sai como “{perfil?.nome} · Lumi”, e as respostas chegam no seu e-mail ({perfil?.email}).</div>
      <div className="linha-campos">
        <Campo rotulo="Para" ajuda="Pode ser qualquer e-mail, de dentro ou de fora da empresa. Vários: separe por vírgula.">
          <input value={para} onChange={(e) => setPara(e.target.value)} placeholder="nome@empresa.com.br, outra@empresa.com.br" />
        </Campo>
        <Campo rotulo="Modelo">
          <select defaultValue="" onChange={(e) => usar(e.target.value)}>
            <option value="">Escrever do zero</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
      </div>
      {(destino.sugestoes ?? []).filter((x) => !lista.includes(x.email.toLowerCase())).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
          <span className="muted">Acrescentar:</span>
          {(destino.sugestoes ?? []).filter((x) => !lista.includes(x.email.toLowerCase())).map((x) => (
            <button key={x.email} type="button" className="btn pequeno" onClick={() => acrescentar(x.email)}>{x.nome} · {x.email}</button>
          ))}
        </div>
      )}
      <Campo rotulo="Assunto"><input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></Campo>
      <Campo rotulo="Mensagem" ajuda="Texto simples. Linhas que começam com “- ” viram lista; links ficam clicáveis.">
        <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} style={{ minHeight: 220 }} />
      </Campo>
    </Modal>
  );
}
