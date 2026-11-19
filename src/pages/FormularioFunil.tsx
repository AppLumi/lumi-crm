import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import CamposFunil from '../components/CamposFunil';
import { Campo } from '../components/ui';
import { validarDados, type CampoFunil } from '../../shared/funis';

interface Publico { titulo: string; texto: string | null; pede_empresa: boolean; campos: CampoFunil[] }

/** Formulário público de um funil (ex.: cadastro de especialistas da telepsicologia). Não exige login. */
export default function FormularioFunil() {
  const { slug } = useParams<{ slug: string }>();
  const [f, setF] = useState<Publico | null>(null);
  const [erro, setErro] = useState('');
  const [b, setB] = useState({ nome: '', email: '', whatsapp: '', empresa: '', site_url: '', aceite: false, aceita_marketing: false });
  const [dados, setDados] = useState<Record<string, unknown>>({});
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState('');

  useEffect(() => {
    fetch(`/api/funis/publico?slug=${encodeURIComponent(slug ?? '')}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.erro); setF(j); document.title = `${j.titulo} · Lumi`; })
      .catch((e: Error) => setErro(e.message || 'Formulário não encontrado'));
  }, [slug]);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!f) return;
    const faltas: string[] = [];
    if (b.nome.trim().split(/\s+/).length < 2) faltas.push('Informe nome e sobrenome');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim())) faltas.push('E-mail inválido');
    faltas.push(...validarDados(f.campos.map((c) => ({ ...c, publico: true })), dados, { publico: true }).erros);
    if (!b.aceite) faltas.push('Marque a autorização de uso dos dados');
    if (faltas.length) { setErro(faltas[0]); return; }
    setEnviando(true); setErro('');
    const r = await fetch(`/api/funis/publico?slug=${encodeURIComponent(slug ?? '')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...b, dados }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) { setErro(j.erro ?? 'Não foi possível enviar agora. Tente de novo.'); return; }
    setPronto(j.mensagem ?? 'Recebemos seu cadastro. Obrigado!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!f) return <div className="publica"><div className="folha"><div className="corpo">{erro ? <div className="aviso erro">{erro}</div> : 'Carregando…'}</div></div></div>;

  return (
    <div className="publica">
      <article className="folha">
        <header className="cabeca">
          <Logo altura={34} variante="claro" />
          <h1 style={{ marginTop: 22, fontSize: 26 }}>{f.titulo}</h1>
          {f.texto && <p style={{ margin: '8px 0 0', color: 'var(--nevoa)', whiteSpace: 'pre-wrap' }}>{f.texto}</p>}
        </header>
        <div className="corpo">
          {pronto ? <div className="aviso ok" role="status">{pronto}</div> : (
            <form onSubmit={enviar} noValidate style={{ display: 'grid', gap: 2 }}>
              <Campo rotulo="Nome completo *"><input value={b.nome} onChange={(e) => setB({ ...b, nome: e.target.value })} autoComplete="name" /></Campo>
              <div className="linha-campos">
                <Campo rotulo="E-mail *"><input type="email" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} autoComplete="email" /></Campo>
                <Campo rotulo="WhatsApp"><input inputMode="tel" value={b.whatsapp} onChange={(e) => setB({ ...b, whatsapp: e.target.value })} placeholder="DDD + número" autoComplete="tel" /></Campo>
              </div>
              {f.pede_empresa && <Campo rotulo="Empresa"><input value={b.empresa} onChange={(e) => setB({ ...b, empresa: e.target.value })} autoComplete="organization" /></Campo>}
              <CamposFunil campos={f.campos.map((c) => ({ ...c, publico: true }))} valores={dados} mudar={setDados} publico />
              <input type="text" name="site_url" tabIndex={-1} autoComplete="off" aria-hidden="true" value={b.site_url}
                onChange={(e) => setB({ ...b, site_url: e.target.value })} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, fontSize: 14 }}>
                <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={b.aceite} onChange={(e) => setB({ ...b, aceite: e.target.checked })} />
                <span>Autorizo o Lumi a usar estes dados para analisar meu cadastro e entrar em contato comigo. *</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
                <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={b.aceita_marketing} onChange={(e) => setB({ ...b, aceita_marketing: e.target.checked })} />
                <span>Quero receber novidades e conteúdos do Lumi por e-mail.</span>
              </label>
              {erro && <div className="aviso erro" role="alert" style={{ marginTop: 8 }}>{erro}</div>}
              <button className="btn primario" type="submit" disabled={enviando} style={{ marginTop: 12, justifySelf: 'start' }}>{enviando ? 'Enviando…' : 'Enviar cadastro'}</button>
            </form>
          )}
        </div>
      </article>
    </div>
  );
}
