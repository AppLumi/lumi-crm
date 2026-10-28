import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import Icone, { type NomeIcone } from './Icone';
import Comando from './Comando';
import Logo from './Logo';
import { Carregando } from './Splash';

type Contador = 'leads' | 'tarefas' | 'aprovacoes';
interface Item { para: string; nome: string; icone: NomeIcone; contador?: Contador }

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  { titulo: 'Hoje', itens: [{ para: '/', nome: 'Início', icone: 'inicio' }, { para: '/tarefas', nome: 'Tarefas', icone: 'tarefas', contador: 'tarefas' }] },
  {
    titulo: 'Vendas', itens: [
      { para: '/leads', nome: 'Leads', icone: 'leads', contador: 'leads' },
      { para: '/funil', nome: 'Funil', icone: 'funil' },
      { para: '/propostas', nome: 'Propostas', icone: 'propostas', contador: 'aprovacoes' },
      { para: '/contas', nome: 'Contas', icone: 'contas' },
    ],
  },
  { titulo: 'Relacionamento', itens: [{ para: '/emails', nome: 'E-mails', icone: 'emails' }] },
  { titulo: 'Gestão', itens: [{ para: '/relatorios', nome: 'Relatórios', icone: 'relatorios' }, { para: '/configuracoes', nome: 'Configurações', icone: 'configuracoes' }] },
];
const TODOS = GRUPOS.flatMap((g) => g.itens);
const MOVEL = ['/', '/leads', '/funil', '/tarefas'];
const PAPEIS = { socia: 'Sócia', negocios: 'Negócios', marketing: 'Marketing', tecnologia: 'Tecnologia' } as const;

const ehAtivo = (para: string, caminho: string) =>
  para === '/' ? caminho === '/' : caminho.startsWith(para) || (para === '/funil' && caminho.startsWith('/oportunidades'));

const lerPreferencia = () => { try { return localStorage.getItem('lumi-crm:menu') === 'recolhido'; } catch { return false; } };
const semMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ehMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export default function Layout() {
  const { perfil, sair } = useSessao();
  const { pathname } = useLocation();
  const [cont, setCont] = useState<Record<Contador, number>>({ leads: 0, tarefas: 0, aprovacoes: 0 });
  const [recolhido, setRecolhido] = useState(lerPreferencia);
  const [comando, setComando] = useState(false);
  const [gota, setGota] = useState<{ top: number; height: number } | null>(null);
  const [sombra, setSombra] = useState<{ top: number; height: number } | null>(null);
  const [dica, setDica] = useState<{ texto: string; y: number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const gotaRef = useRef<HTMLSpanElement>(null);
  const ultimoTopo = useRef<number | null>(null);

  // a gota líquida desliza até o item ativo e se deforma no caminho
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('a.ativo');
    if (!el) { setGota(null); ultimoTopo.current = null; return; }
    const pos = { top: el.offsetTop, height: el.offsetHeight };
    setGota(pos);
    if (ultimoTopo.current != null && ultimoTopo.current !== pos.top && !semMovimento()) {
      const desce = pos.top > ultimoTopo.current;
      gotaRef.current?.animate(
        [{ scale: '1 1' }, { scale: '0.9 1.35', transformOrigin: desce ? 'top' : 'bottom', offset: 0.3 }, { scale: '1.04 0.92', offset: 0.65 }, { scale: '1 1' }],
        { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    }
    ultimoTopo.current = pos.top;
  }, [pathname, recolhido]);

  useEffect(() => {
    try { localStorage.setItem('lumi-crm:menu', recolhido ? 'recolhido' : 'aberto'); } catch { /* sem armazenamento */ }
  }, [recolhido]);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setComando((c) => !c); }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

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

  const luz = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  // no menu recolhido, a dica fica fora do vidro para não ser cortada
  const mostrarDica = (e: React.MouseEvent<HTMLElement>, texto: string) => {
    if (!recolhido) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDica({ texto, y: r.top + r.height / 2 });
  };
  const iniciais = (perfil?.nome ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={`app ${recolhido ? 'recolhido' : ''}`}>
      <div className="aurora" aria-hidden="true"><i /><i /><i /><i /></div>

      <aside className="lateral" onMouseMove={luz} aria-label="Menu principal">
        <div className="marca">
          <span className="logo-marca"><Logo marca altura={30} /></span>
          <span className="nome-marca"><Logo altura={24} /><small>CRM</small></span>
          <button className="recolher" onClick={() => setRecolhido((r) => !r)} aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : 'Recolher menu'}>
            <Icone nome={recolhido ? 'expandir' : 'recolher'} tamanho={16} />
          </button>
        </div>

        <button className="busca-rapida" onClick={() => setComando(true)} onMouseEnter={(e) => mostrarDica(e, 'Buscar')} onMouseLeave={() => setDica(null)}>
          <Icone nome="busca" tamanho={17} />
          <span className="rotulo">Buscar ou ir para…</span>
          <kbd>{ehMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>

        <div className="navegacao" ref={navRef} onMouseLeave={() => { setSombra(null); setDica(null); }}>
          <span className="gota-sombra" style={sombra ? { transform: `translateY(${sombra.top}px)`, height: sombra.height, opacity: 1 } : { opacity: 0 }} />
          <span ref={gotaRef} className="gota" style={gota ? { transform: `translateY(${gota.top}px)`, height: gota.height, opacity: 1 } : { opacity: 0 }} />
          {GRUPOS.map((g) => (
            <div className="grupo" key={g.titulo}>
              <div className="grupo-titulo">{g.titulo}</div>
              {g.itens.map((m) => {
                const n = m.contador ? cont[m.contador] : 0;
                return (
                  <NavLink key={m.para} to={m.para} className={ehAtivo(m.para, pathname) ? 'ativo' : ''} aria-label={m.nome}
                    onMouseEnter={(e) => { setSombra({ top: e.currentTarget.offsetTop, height: e.currentTarget.offsetHeight }); mostrarDica(e, m.nome); }}>
                    <Icone nome={m.icone} />
                    <span className="rotulo">{m.nome}</span>
                    {n > 0 && <span className="contador">{n}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        <div className="pessoa">
          <span className="avatar">{iniciais}</span>
          <span className="rotulo">
            <strong>{perfil?.nome}</strong>
            <small>{perfil ? PAPEIS[perfil.papel] : ''}{perfil?.aprova_desconto ? ' · aprova descontos' : ''}</small>
          </span>
          <button className="sair" onClick={sair} aria-label="Sair" title="Sair"><Icone nome="sair" tamanho={17} /></button>
        </div>
      </aside>

      {dica && recolhido && <div className="dica" style={{ top: dica.y }} role="tooltip">{dica.texto}</div>}

      <main className="conteudo">
        <div className="pagina" key={pathname}><Suspense fallback={<Carregando />}><Outlet /></Suspense></div>
      </main>

      <nav className="barra-movel" aria-label="Menu rápido">
        {TODOS.filter((m) => MOVEL.includes(m.para)).map((m) => (
          <NavLink key={m.para} to={m.para} className={ehAtivo(m.para, pathname) ? 'ativo' : ''}>
            <Icone nome={m.icone} />
            <span>{m.nome}</span>
            {m.contador && cont[m.contador] > 0 && <i className="ponto-alerta" />}
          </NavLink>
        ))}
        <button onClick={() => setComando(true)}><Icone nome="busca" /><span>Buscar</span></button>
      </nav>

      <Comando aberto={comando} fechar={() => setComando(false)} atalhos={TODOS} />
    </div>
  );
}
