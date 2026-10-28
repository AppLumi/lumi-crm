import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { Campo } from '../components/ui';

export default function Login() {
  const { sessao } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (sessao) return <Navigate to="/" replace />;

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : error.message);
  };
  const esqueci = async () => {
    if (!email.trim()) { setErro('Digite seu e-mail primeiro'); return; }
    setErro('');
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/definir-senha` });
    setMsg('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.');
  };

  return (
    <div className="tela-login">
      <form className="cartao" onSubmit={entrar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10 L50 16 L31 29 Z" fill="#9DB0D0" /><path d="M31 29 L54 20 L36 52 Z" fill="#3B72D9" /><path d="M8 10 L31 29 L26 54 Z" fill="#061B4A" /></svg>
          <div><h1>Lumi CRM</h1><div className="muted">Acesso do time</div></div>
        </div>
        {erro && <div className="aviso erro">{erro}</div>}
        {msg && <div className="aviso ok">{msg}</div>}
        <Campo rotulo="E-mail"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
        <Campo rotulo="Senha"><input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></Campo>
        <button className="btn primario" style={{ width: '100%', justifyContent: 'center' }} disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8, border: 0 }} onClick={esqueci}>Esqueci minha senha</button>
      </form>
    </div>
  );
}
