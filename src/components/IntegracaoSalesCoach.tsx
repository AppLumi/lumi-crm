import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/supabase';
import { useAcao } from '../lib/sessao';
import { dataHora } from '../lib/formato';
import { Selo } from './ui';

interface Token { id: string; nome: string; prefixo: string; criado_em: string; usado_em: string | null; revogado_em: string | null }

/** Configurações → Integração com o Sales Coach: gera o token que o Sales Coach usa para ligar reuniões ao CRM. */
export default function IntegracaoSalesCoach() {
  const { ocupado, executar } = useAcao();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [novo, setNovo] = useState<{ token: string; endereco: string } | null>(null);

  const carregar = useCallback(async () => {
    try { setTokens((await api<{ tokens: Token[] }>('integracao', { corpo: { action: 'tokens' } })).tokens); }
    catch { setTokens(null); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const gerar = () => executar(async () => {
    setNovo(await api<{ token: string; endereco: string }>('integracao', { corpo: { action: 'gerar_token', nome: 'Sales Coach' } }));
    await carregar();
  }, 'Token gerado');
  const revogar = (id: string) => executar(async () => {
    await api('integracao', { corpo: { action: 'revogar_token', id } });
    await carregar();
  }, 'Token revogado');
  const copiar = (t: string) => navigator.clipboard?.writeText(t).catch(() => undefined);

  return (
    <div className="cartao">
      <h2>Integração com o Sales Coach</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        Liga as reuniões da agenda no Sales Coach aos negócios, empresas e contatos daqui (pelo e-mail de quem participa) e grava o resultado de cada análise:
        resumo na linha do tempo, campos do Sales Coach e a tarefa do próximo passo. No Sales Coach: Configurações → Integração com CRM → CRM do Lumi, e cole o endereço e o token.
      </p>
      {tokens === null ? <div className="aviso erro" style={{ marginTop: 10 }}>Rode a migração 0004 (integração com o Sales Coach) no Supabase para ativar.</div> : (
        <>
          {novo && (
            <div className="aviso ok" style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              <b>Copie agora: o token não aparece de novo.</b>
              <span>Endereço: <code>{novo.endereco}</code> <button className="btn pequeno" onClick={() => copiar(novo.endereco)}>Copiar</button></span>
              <span style={{ wordBreak: 'break-all' }}>Token: <code>{novo.token}</code> <button className="btn pequeno" onClick={() => copiar(novo.token)}>Copiar</button></span>
            </div>
          )}
          {tokens.length > 0 && (
            <table className="tabela" style={{ marginTop: 10 }}><tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.nome}</strong><div className="muted">{t.prefixo}… · criado {dataHora(t.criado_em)}</div></td>
                  <td>{t.revogado_em ? <Selo cor="vermelho">revogado</Selo> : t.usado_em ? <Selo cor="verde">em uso · {dataHora(t.usado_em)}</Selo> : <Selo>ainda não usado</Selo>}</td>
                  <td className="num">{!t.revogado_em && <button className="btn pequeno perigo" disabled={ocupado} onClick={() => revogar(t.id)}>Revogar</button>}</td>
                </tr>
              ))}
            </tbody></table>
          )}
          <div className="acoes" style={{ marginTop: 10 }}><button className="btn primario" disabled={ocupado} onClick={gerar}>Gerar token para o Sales Coach</button></div>
        </>
      )}
    </div>
  );
}
