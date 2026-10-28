import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MARCA_LOGIN, useSessao } from '../lib/sessao';
import { Campo } from '../components/ui';
import Logo from '../components/Logo';
import { TelaVidro } from '../components/Splash';

export default function Login() {
  const { sessao } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [tremer, setTremer] = useState(0);

  if (sessao) return <Navigate to="/" replace />;

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setOcupado(true);
    try { sessionStorage.setItem(MARCA_LOGIN, '1'); } catch { /* sem armazenamento */ }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : error.message);
      setTremer((n) => n + 1);
    }
  };
  const esqueci = async () => {
    if (!email.trim()) { setErro('Digite seu e-mail primeiro'); setTremer((n) => n + 1); return; }
    setErro('');
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/definir-senha` });
    setMsg('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.');
  };
  const luz = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <TelaVidro>
      <div className="login-coluna">
        <div className="login-logo">
          <Logo altura={76} animacao="entrada" />
          <p className="login-sub">CRM comercial</p>
        </div>

        <form key={tremer} className={`cartao login-cartao ${tremer ? 'tremer' : ''}`} onSubmit={entrar} onMouseMove={luz}>
          <h1>Boas-vindas</h1>
          <p className="muted" style={{ margin: '4px 0 18px' }}>Entre com o e-mail do time Lumi.</p>
          {erro && <div className="aviso erro">{erro}</div>}
          {msg && <div className="aviso ok">{msg}</div>}
          <Campo rotulo="E-mail"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Campo>
          <Campo rotulo="Senha"><input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></Campo>
          <button className="btn primario largo" disabled={ocupado}>
            {ocupado ? <><span className="girando claro" /> Entrando</> : 'Entrar'}
          </button>
          <button type="button" className="btn-texto" onClick={esqueci}>Esqueci minha senha</button>
        </form>
        <p className="login-rodape">Acesso restrito ao time Lumi · applumi.io</p>
      </div>
    </TelaVidro>
  );
}
