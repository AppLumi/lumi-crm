import { Navigate, Route, Routes } from 'react-router-dom';
import { configurado } from './lib/supabase';
import { SessaoProvider, useSessao } from './lib/sessao';
import Layout from './components/Layout';
import { Carregando } from './components/ui';
import Login from './pages/Login';
import DefinirSenha from './pages/DefinirSenha';
import Inicio from './pages/Inicio';
import Leads from './pages/Leads';
import LeadDetalhe from './pages/LeadDetalhe';
import Funil from './pages/Funil';
import OportunidadeDetalhe from './pages/OportunidadeDetalhe';
import Contas from './pages/Contas';
import ContaDetalhe from './pages/ContaDetalhe';
import Tarefas from './pages/Tarefas';
import Propostas from './pages/Propostas';
import Emails from './pages/Emails';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import PropostaPublica from './pages/PropostaPublica';

function Protegido() {
  const { sessao, perfil, carregando, sair } = useSessao();
  if (carregando) return <Carregando />;
  if (!sessao) return <Navigate to="/entrar" replace />;
  if (!perfil || !perfil.ativo) {
    return (
      <div className="tela-login"><div className="cartao">
        <h1>Acesso pendente</h1>
        <p className="muted">Sua conta ({sessao.user.email}) ainda não faz parte do time do CRM. Peça a uma sócia para te convidar.</p>
        <button className="btn" onClick={sair}>Sair</button>
      </div></div>
    );
  }
  return <Layout />;
}

export default function App() {
  if (!configurado) {
    return (
      <div className="tela-login"><div className="cartao">
        <h1>Configuração pendente</h1>
        <p className="muted">Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente (veja o README).</p>
      </div></div>
    );
  }
  return (
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
  );
}
