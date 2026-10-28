import { useEffect, useState } from 'react';
import { api, ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import type { Papel, Perfil } from '../lib/tipos';
import { Campo, Modal, Selo } from '../components/ui';
import { FAIXAS, rotuloFaixa, brl, LIMITE_DESCONTO, LIMITE_DESCONTO_IMPLEMENTACAO, LIMITE_DESCONTO_SEM_APROVACAO } from '../../shared/precos';

const PAPEIS: Record<Papel, string> = { socia: 'Sócia', negocios: 'Negócios', marketing: 'Marketing', tecnologia: 'Tecnologia' };

const formulario = (crm: string) => `<form id="lumi-lead" style="display:grid;gap:10px;max-width:420px">
  <input name="nome" placeholder="Seu nome" required>
  <input name="email" type="email" placeholder="E-mail de trabalho" required>
  <input name="whatsapp" placeholder="WhatsApp">
  <input name="empresa" placeholder="Empresa">
  <input name="cargo" placeholder="Cargo">
  <input name="colaboradores" inputmode="numeric" placeholder="Nº de colaboradores">
  <input name="site_url" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <label><input type="checkbox" name="aceita_marketing"> Quero receber conteúdos do Lumi</label>
  <button type="submit">Quero conhecer o Lumi</button>
  <p id="lumi-lead-msg" role="status"></p>
</form>
<script>
document.getElementById('lumi-lead').addEventListener('submit', async function (e) {
  e.preventDefault();
  var f = e.target, d = Object.fromEntries(new FormData(f)), q = new URLSearchParams(location.search);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function (k) { if (q.get(k)) d[k] = q.get(k); });
  d.aceita_marketing = !!f.aceita_marketing.checked; d.pagina = location.href; d.origem = 'site'; d.tipo = 'demo_solicitada';
  var r = await fetch('${crm}/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  document.getElementById('lumi-lead-msg').textContent = r.ok ? 'Recebemos! Em breve falamos com você.' : 'Não deu certo. Tente de novo.';
  if (r.ok) f.reset();
});
</script>`;

export default function Configuracoes() {
  const { perfil, time, aviso } = useSessao();
  const { ocupado, executar } = useAcao();
  const [todos, setTodos] = useState<Perfil[]>(time);
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [convite, setConvite] = useState<{ nome: string; email: string; papel: Papel; aprova_desconto: boolean } | null>(null);
  const socia = perfil?.papel === 'socia';
  const crm = location.origin;

  const carregar = async () => {
    const r = await supabase.from('perfis').select('*').order('nome');
    setTodos((r.data ?? []) as Perfil[]);
  };
  useEffect(() => { carregar(); }, []);

  const salvarNome = () => executar(async () => {
    if (!nome.trim()) throw new Error('Informe seu nome');
    ok(await supabase.from('perfis').update({ nome: nome.trim() }).eq('id', perfil!.id));
  }, 'Nome atualizado (vale a partir do próximo login)');

  const convidar = () => executar(async () => {
    await api('usuarios/convidar', { corpo: convite });
    setConvite(null);
    await carregar();
  }, 'Convite enviado por e-mail');

  const mudar = (p: Perfil, campos: Partial<Perfil>) => executar(async () => {
    await api('usuarios/atualizar', { corpo: { id: p.id, ...campos } });
    await carregar();
  }, 'Permissões atualizadas');

  const copiar = async (t: string) => { await navigator.clipboard.writeText(t); aviso('Copiado'); };

  return (
    <>
      <div className="topo"><div><h1>Configurações</h1></div></div>
      <div className="grade g2">
        <div className="cartao">
          <h2>Meu perfil</h2>
          <Campo rotulo="Nome (aparece no remetente dos e-mails)"><input value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
          <dl className="dados">
            <dt>E-mail</dt><dd>{perfil?.email}</dd>
            <dt>Papel</dt><dd>{perfil && PAPEIS[perfil.papel]}</dd>
            <dt>Aprova descontos</dt><dd>{perfil?.aprova_desconto ? 'Sim' : 'Não'}</dd>
          </dl>
          <div className="acoes" style={{ marginTop: 12 }}><button className="btn primario" disabled={ocupado || nome === perfil?.nome} onClick={salvarNome}>Salvar</button></div>
        </div>

        <div className="cartao">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Time</h2>
            {socia && <button className="btn pequeno primario" onClick={() => setConvite({ nome: '', email: '', papel: 'negocios', aprova_desconto: false })}>Convidar</button>}
          </div>
          <table className="tabela" style={{ marginTop: 8 }}><tbody>
            {todos.map((p) => (
              <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.5 }}>
                <td><strong>{p.nome}</strong><div className="muted">{p.email}</div></td>
                <td>
                  {socia && p.id !== perfil?.id ? (
                    <select value={p.papel} onChange={(e) => mudar(p, { papel: e.target.value as Papel })}>
                      {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : PAPEIS[p.papel]}
                </td>
                <td>
                  {socia ? (
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" style={{ width: 'auto' }} checked={p.aprova_desconto} onChange={(e) => mudar(p, { aprova_desconto: e.target.checked })} /> aprova
                    </label>
                  ) : p.aprova_desconto ? <Selo cor="lima">aprova descontos</Selo> : null}
                </td>
                <td className="num">
                  {socia && p.id !== perfil?.id && <button className="btn pequeno" onClick={() => mudar(p, { ativo: !p.ativo })}>{p.ativo ? 'Desativar' : 'Reativar'}</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>

        <div className="cartao">
          <h2>Tabela de preços</h2>
          <p className="muted" style={{ marginTop: 2 }}>Por colaborador/mês. Implementação anual por faixa. O mensal nunca fica abaixo do teto da faixa anterior.</p>
          <table className="tabela">
            <thead><tr><th>Colaboradores</th><th className="num">Starter</th><th className="num">Premium</th><th className="num">Implementação</th></tr></thead>
            <tbody>{FAIXAS.map((f) => <tr key={f.min}><td>{rotuloFaixa(f)}</td><td className="num">{brl(f.starter)}</td><td className="num">{brl(f.premium)}</td><td className="num">{brl(f.implementacao)}</td></tr>)}</tbody>
          </table>
          <div className="aviso info" style={{ marginTop: 12 }}>
            Desconto: até {LIMITE_DESCONTO_SEM_APROVACAO}% quem vende decide; de {LIMITE_DESCONTO_SEM_APROVACAO}% a {LIMITE_DESCONTO}% com aprovação de uma sócia; acima de {LIMITE_DESCONTO}% não praticamos.
            Implementação: até {LIMITE_DESCONTO_IMPLEMENTACAO}% em pilotos e contratos de 24 meses. Mais de 5.000 vidas sempre passa por uma sócia.
          </div>
        </div>

        <div className="cartao">
          <h2>Captura de leads</h2>
          <p className="muted" style={{ marginTop: 2 }}>Qualquer página (site, landing de evento, QR code) pode mandar leads para cá. Os campos aceitos: nome, email, whatsapp, empresa, cnpj, cargo, colaboradores, mensagem, origem, evento, tipo, aceita_marketing e as UTMs.</p>
          <Campo rotulo="Endereço"><div style={{ display: 'flex', gap: 8 }}><input readOnly value={`${crm}/api/leads`} /><button className="btn" onClick={() => copiar(`${crm}/api/leads`)}>Copiar</button></div></Campo>
          <Campo rotulo="Formulário pronto para colar no site" ajuda="O domínio do site precisa estar em ORIGENS_PERMITIDAS na Vercel.">
            <textarea readOnly value={formulario(crm)} style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 11 }} />
          </Campo>
          <button className="btn" onClick={() => copiar(formulario(crm))}>Copiar formulário</button>
        </div>
      </div>

      <Modal titulo="Convidar para o CRM" aberto={!!convite} fechar={() => setConvite(null)}
        rodape={<><button className="btn" onClick={() => setConvite(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={convidar}>Enviar convite</button></>}>
        {convite && (
          <>
            <Campo rotulo="Nome"><input value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} /></Campo>
            <Campo rotulo="E-mail"><input type="email" value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} /></Campo>
            <Campo rotulo="Papel">
              <select value={convite.papel} onChange={(e) => setConvite({ ...convite, papel: e.target.value as Papel })}>
                {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={convite.aprova_desconto} onChange={(e) => setConvite({ ...convite, aprova_desconto: e.target.checked })} />
              Pode aprovar descontos acima de {LIMITE_DESCONTO_SEM_APROVACAO}%
            </label>
          </>
        )}
      </Modal>
    </>
  );
}
