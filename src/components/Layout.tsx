import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';

const MENU = [
  { para: '/', nome: 'Início', fim: true },
  { para: '/leads', nome: 'Leads', contador: 'leads' },
  { para: '/funil', nome: 'Funil' },
  { para: '/contas', nome: 'Contas' },
  { para: '/tarefas', nome: 'Tarefas', contador: 'tarefas' },
  { para: '/propostas', nome: 'Propostas', contador: 'aprovacoes' },
  { para: '/emails', nome: 'E-mails' },
  { para: '/relatorios', nome: 'Relatórios' },
  { para: '/configuracoes', nome: 'Configurações' },
];

export default function Layout() {
  const { perfil, sair } = useSessao();
  const [cont, setCont] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!perfil) return;
    const carregar = async () => {
      const agora = new Date().toISOString();
      const [l, t, a] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
        supabase.from('atividades').select('id', { count: 'exact', head: true }).eq('tipo', 'tarefa').is('concluida_em', null)
          .eq('responsavel', perfil.id).lte('vence_em', agora),
        perfil.aprova_desconto
          ? supabase.from('propostas').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_aprovacao')
          : Promise.resolve({ count: 0 }),
      ]);
      setCont({ leads: l.count ?? 0, tarefas: t.count ?? 0, aprovacoes: a.count ?? 0 });
    };
    carregar();
    const i = window.setInterval(carregar, 60000);
    return () => window.clearInterval(i);
  }, [perfil]);

  return (
    <div className="app">
      <nav className="lateral" aria-label="Menu principal">
        <div className="marca">
          <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10 L50 16 L31 29 Z" fill="#9DB0D0" /><path d="M31 29 L54 20 L36 52 Z" fill="#3B72D9" /><path d="M8 10 L31 29 L26 54 Z" fill="#fff" /></svg>
          <div>lumi<br /><small>CRM</small></div>
        </div>
        {MENU.map((m) => (
          <NavLink key={m.para} to={m.para} end={m.fim} className={({ isActive }) => (isActive ? 'ativo' : '')}>
            <span className="ponto" />{m.nome}
            {m.contador && cont[m.contador] ? <span className="contador">{cont[m.contador]}</span> : null}
          </NavLink>
        ))}
        <div className="rodape">
          <div style={{ color: '#fff', fontWeight: 600 }}>{perfil?.nome}</div>
          <div>{perfil?.email}</div>
          <button onClick={sair} style={{ marginTop: 8 }}>Sair</button>
        </div>
      </nav>
      <main className="conteudo"><Outlet /></main>
    </div>
  );
}
