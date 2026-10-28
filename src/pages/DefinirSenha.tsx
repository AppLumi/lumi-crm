import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { Campo } from '../components/ui';

/** Destino do link de convite e de “esqueci minha senha”. */
export default function DefinirSenha() {
  const { sessao, carregando } = useSessao();
  const ir = useNavigate();
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 10) return setErro('Use pelo menos 10 caracteres');
    if (senha !== conf) return setErro('As senhas não conferem');
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return setErro(error.message);
    ir('/', { replace: true });
  };

  return (
    <div className="tela-login">
      <form className="cartao" onSubmit={salvar}>
        <h1>Criar senha</h1>
        {!carregando && !sessao ? (
          <div className="aviso erro" style={{ marginTop: 12 }}>O link expirou ou já foi usado. Peça um novo convite ou use “Esqueci minha senha”.</div>
        ) : (
          <>
            <p className="muted">{sessao?.user.email}</p>
            {erro && <div className="aviso erro">{erro}</div>}
            <Campo rotulo="Nova senha" ajuda="Mínimo de 10 caracteres"><input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
            <Campo rotulo="Repita a senha"><input type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} /></Campo>
            <button className="btn primario" style={{ width: '100%', justifyContent: 'center' }}>Salvar e entrar</button>
          </>
        )}
      </form>
    </div>
  );
}
