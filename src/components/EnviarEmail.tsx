import { useEffect, useState } from 'react';
import { api, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { primeiroNome } from '../lib/formato';
import type { ModeloEmail } from '../lib/tipos';
import { Campo, Modal } from './ui';

export interface DestinoEmail {
  para: string; nome: string; empresa?: string | null;
  lead_id?: string; contato_id?: string; conta_id?: string; oportunidade_id?: string;
  extras?: Record<string, string>;
}

const preencher = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? `{{${k}}}`);

export default function EnviarEmail({ destino, fechar, enviado }: { destino: DestinoEmail | null; fechar: () => void; enviado?: () => void }) {
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [modelos, setModelos] = useState<ModeloEmail[]>([]);
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');

  useEffect(() => {
    if (!destino) return;
    supabase.from('modelos_email').select('*').eq('ativo', true).order('nome').then(({ data }) => setModelos((data ?? []) as ModeloEmail[]));
    setAssunto(''); setCorpo('');
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
  const enviar = () => executar(async () => {
    if (/\{\{\w+\}\}/.test(assunto + corpo)) throw new Error('Ainda há campos {{…}} sem preencher no texto');
    if (/\[[^\]]+\]/.test(corpo)) throw new Error('Troque os trechos entre colchetes antes de enviar');
    await api('emails/enviar', { corpo: { para: destino.para, assunto, corpo, lead_id: destino.lead_id, contato_id: destino.contato_id, conta_id: destino.conta_id, oportunidade_id: destino.oportunidade_id } });
    enviado?.();
    fechar();
  }, 'E-mail enviado');

  return (
    <Modal titulo={`E-mail para ${destino.nome}`} aberto fechar={fechar} largura={700}
      rodape={<><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primario" disabled={ocupado || !assunto || !corpo} onClick={enviar}>Enviar</button></>}>
      <div className="aviso info">Sai como “{perfil?.nome} · Lumi”, e as respostas chegam no seu e-mail ({perfil?.email}).</div>
      <div className="linha-campos">
        <Campo rotulo="Para"><input value={destino.para} readOnly /></Campo>
        <Campo rotulo="Modelo">
          <select defaultValue="" onChange={(e) => usar(e.target.value)}>
            <option value="">Escrever do zero</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Assunto"><input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></Campo>
      <Campo rotulo="Mensagem" ajuda="Texto simples. Linhas que começam com “- ” viram lista; links ficam clicáveis.">
        <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} style={{ minHeight: 220 }} />
      </Campo>
    </Modal>
  );
}
