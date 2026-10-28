import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { configurado } from './lib/supabase';
import { MARCA_LOGIN, SessaoProvider, useSessao } from './lib/sessao';
import Layout from './components/Layout';
import Splash, { TelaVidro } from './components/Splash';
import Logo from './components/Logo';
import Login from './pages/Login';
import DefinirSenha from './pages/DefinirSenha';

// cada página vira um pedaço separado: abre rápido e carrega o resto conforme o uso
const Inicio = lazy(() => import('./pages/Inicio'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetalhe = lazy(() => import('./pages/LeadDetalhe'));
const Funil = lazy(() => import('./pages/Funil'));
const OportunidadeDetalhe = lazy(() => import('./pages/OportunidadeDetalhe'));
const Contas = lazy(() => import('./pages/Contas'));
const ContaDetalhe = lazy(() => import('./pages/ContaDetalhe'));
const Tarefas = lazy(() => import('./pages/Tarefas'));
const Propostas = lazy(() => import('./pages/Propostas'));
const Emails = lazy(() => import('./pages/Emails'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const PropostaPublica = lazy(() => import('./pages/PropostaPublica'));

/** Área logada: mostra o splash até o perfil carregar (e um tempo mínimo para a animação respirar). */
function Protegido() {
  const { sessao, perfil, carregando, sair } = useSessao();
  const [tempoMinimo, setTempoMinimo] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [terminou, setTerminou] = useState(false);

  useEffect(() => {
    let veioDoLogin = false;
    try { veioDoLogin = sessionStorage.getItem(MARCA_LOGIN) === '1'; } catch { /* sem armazenamento */ }
    const t = window.setTimeout(() => setTempoMinimo(true), veioDoLogin ? 1900 : 1100);
    return () => window.clearTimeout(t);
  }, []);

  const pronto = !carregando && tempoMinimo;
  useEffect(() => {
    if (!pronto) return;
    setSaindo(true);
    const t = window.setTimeout(() => {
      setTerminou(true);
      try { sessionStorage.removeItem(MARCA_LOGIN); } catch { /* sem armazenamento */ }
    }, 750);
    return () => window.clearTimeout(t);
  }, [pronto]);

  if (!carregando && !sessao) return <Navigate to="/entrar" replace />;

  let conteudo = null;
  if (!carregando && perfil?.ativo) conteudo = <Layout />;
  else if (!carregando && sessao) {
    conteudo = (
      <TelaVidro>
        <div className="login-coluna">
          <Logo altura={48} />
          <div className="cartao">
            <h1>Acesso pendente</h1>
            <p className="muted">Sua conta ({sessao.user.email}) ainda não faz parte do time do CRM. Peça a uma sócia para te convidar.</p>
            <button className="btn" onClick={sair}>Sair</button>
          </div>
        </div>
      </TelaVidro>
    );
  }

  return (
    <>
      <div className={`revela ${saindo ? 'ativo' : ''}`}>{conteudo}</div>
      {!terminou && <Splash saindo={saindo} />}
    </>
  );
}

export default function App() {
  if (!configurado) {
    return (
      <TelaVidro>
        <div className="login-coluna">
          <Logo altura={48} />
          <div className="cartao">
            <h1>Configuração pendente</h1>
            <p className="muted">Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente (veja o README).</p>
          </div>
        </div>
      </TelaVidro>
    );
  }
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/p/:token" element={<PropostaPublica />} />
        <Route path="*" element={
          <SessaoProvider>
            <Routes>
              <Route path="/entrar" element={<Login />} />
              <Route path="/definir-senha" element={<DefinirSenha />} />
              <Route element={<Protegido />}>
                <Route index element={<Inicio />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/:id" element={<LeadDetalhe />} />
                <Route path="funil" element={<Funil />} />
                <Route path="oportunidades/:id" element={<OportunidadeDetalhe />} />
                <Route path="contas" element={<Contas />} />
                <Route path="contas/:id" element={<ContaDetalhe />} />
                <Route path="tarefas" element={<Tarefas />} />
                <Route path="propostas" element={<Propostas />} />
                <Route path="emails" element={<Emails />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </SessaoProvider>
        } />
      </Routes>
    </Suspense>
  );
}
