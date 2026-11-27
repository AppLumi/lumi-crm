import { useEffect, type ReactNode } from 'react';
import { brl, data } from '../lib/formato';
import { custoNaoAgir, slidesVisiveis, type ItemServico } from '../../shared/propostaLumi';
import Logo from './Logo';

/** O que a apresentação precisa saber da proposta. Serve para a página pública e para a prévia no CRM. */
export interface DadosApresentacao {
  empresa: string; versao: number; plano: 'starter' | 'premium'; vidas: number; preco_vida: number; mensal_tabela: number;
  desconto_pct: number; mensal: number; implementacao_tabela: number; desconto_implementacao_pct: number; implementacao: number;
  primeiro_ano: number; validade: string; observacoes: string | null; criado_em: string;
  slides: string[] | null; servicos: ItemServico[]; servicos_total: number;
  responsavel: { nome: string; email: string } | null;
}

const WS = 'workshop_nr1_liderancas';
const FONTES = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Figtree:wght@300..600&display=swap';
const n = (v: number) => Math.round(v).toLocaleString('pt-BR');
const reais = (v: number) => `R$ ${n(v)}`;
const pct = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Selo({ children, claro }: { children: ReactNode; claro?: boolean }) {
  return <div className={`ap-selo${claro ? ' claro' : ''}`}>{children}</div>;
}

function Slide({ children, escuro, num, total, className = '' }: { children: ReactNode; escuro?: boolean; num: number; total: number; className?: string }) {
  return (
    <section className={`ap-slide${escuro ? ' escuro' : ''} ${className}`}>
      <div className="ap-deco" aria-hidden="true" />
      <div className="ap-conteudo">{children}</div>
      <footer className="ap-rodape">
        <Logo altura={16} variante={escuro ? 'claro' : 'escuro'} />
        <span>applumi.io</span>
        <span>{String(num).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </footer>
    </section>
  );
}

/** Apresentação da proposta no visual do Lumi: os slides escolhidos, o investimento e o que vier depois (aceite). */
export default function ApresentacaoProposta({ p, depois }: { p: DadosApresentacao; depois?: ReactNode }) {
  useEffect(() => {
    if (document.querySelector('link[data-ap-fontes]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONTES; l.dataset.apFontes = '1';
    document.head.appendChild(l);
  }, []);

  const servicos = p.servicos ?? [];
  const chaves = servicos.map((s) => s.chave);
  const slides = slidesVisiveis(p.slides, p.plano, chaves);
  const premium = p.plano === 'premium';
  const plano = premium ? 'Premium' : 'Starter';
  const ws = servicos.find((s) => s.chave === WS);
  const custo = custoNaoAgir(p.vidas);
  const primeiroAno = Number(p.primeiro_ano);
  const totalServ = Number(p.servicos_total) || 0;
  const total = slides.length;
  const emissao = new Date(p.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const render: Record<string, (i: number) => ReactNode> = {
    capa: (i) => (
      <Slide key="capa" num={i} total={total} className="ap-capa">
        <Logo altura={30} />
        <div className="ap-capa-texto">
          <Selo>Proposta para {p.empresa}</Selo>
          <h1>Riscos psicossociais em <em>ativos de performance.</em></h1>
          <p className="ap-lede">
            Gestão de riscos psicossociais e adequação à NR-1, desenvolvimento e cuidado com o time{ws ? ', com o workshop NR-1 aplicada às lideranças' : ''}, em uma só proposta.
          </p>
        </div>
        <div className="ap-capa-meta">
          <span className="ap-pilula">Proposta comercial · {emissao}</span>
          <span>Plano {plano} · {p.vidas.toLocaleString('pt-BR')} colaboradores · versão {p.versao} · válida até {data(p.validade)}</span>
        </div>
      </Slide>
    ),

    nr1: (i) => (
      <Slide key="nr1" num={i} total={total}>
        <Selo>O que mudou</Selo>
        <h2>A NR-1 agora inclui os <em>riscos psicossociais</em></h2>
        <div className="ap-data">
          <strong>26/05/2026</strong>
          <p>Desde essa data, o gerenciamento de riscos ocupacionais (GRO) inclui expressamente os fatores de risco psicossociais relacionados ao trabalho.</p>
        </div>
        <div className="ap-cartoes c3">
          <div className="ap-cartao"><b>546 mil</b><span>benefícios por incapacidade temporária por transtornos mentais em 2025</span></div>
          <div className="ap-cartao"><b>+15,66%</b><span>de crescimento em relação a 2024</span></div>
          <div className="ap-cartao"><b className="menor">Norma em vigor</b><span>As multas estão suspensas no STF durante a conciliação, mas as diretrizes da norma continuam válidas e devem ser observadas.</span></div>
        </div>
        <p className="ap-fonte">Fontes: Portaria MTE nº 1.419/2024; Previdência Social (jan/2026); STF, ADPF 1316.</p>
      </Slide>
    ),

    custo: (i) => (
      <Slide key="custo" num={i} total={total}>
        <Selo>A conta</Selo>
        <h2>O custo de não agir <em>já está na folha</em></h2>
        <p className="ap-sub">Para um time de {p.vidas.toLocaleString('pt-BR')} pessoas, o que sai da folha todo ano sem aparecer no orçamento:</p>
        <div className="ap-duas">
          <div className="ap-linhas">
            <div><span><b>Presenteísmo</b><small>20% das pessoas perdendo 7,5h por semana</small></span><b>{reais(custo.presenteismo)}</b></div>
            <div><span><b>Afastamentos</b><small>1,2% do time ao ano, 15 dias pagos pela empresa</small></span><b>{reais(custo.afastamentos)}</b></div>
            <div><span><b>Rotatividade evitável</b><small>15% das saídas atribuíveis ao bem-estar</small></span><b>{reais(custo.rotatividade)}</b></div>
          </div>
          <div className="ap-destaque">
            <small>Custo anual estimado</small>
            <strong>{reais(custo.total)}</strong>
            <p>O Lumi no primeiro ano: <b>{reais(primeiroAno)}</b>, ou {pct((primeiroAno / custo.total) * 100)}% desse custo.</p>
          </div>
        </div>
        <p className="ap-fonte">Estimativa para orientar a conversa, não uma projeção de resultado. Premissas: salário médio de R$ 4.000 e rotatividade anual de 30%; folha sem encargos, o que torna a estimativa conservadora. Indenizações ficam fora da soma: dependem de caso, nexo e culpa.</p>
      </Slide>
    ),

    ideia: (i) => (
      <Slide key="ideia" num={i} total={total} escuro className="ap-centro">
        <Selo claro>A grande ideia</Selo>
        <h2 className="grande">Saúde mental é preditor de <em>alta performance.</em></h2>
        <p className="ap-lede">O Lumi nasce da NR-1, mas a promessa vai além da conformidade: conecta saúde mental a desempenho, retenção e cultura.</p>
        <p className="ap-citacao">Transformar desenvolvimento humano e saúde mental em cultura diária.</p>
      </Slide>
    ),

    produto: (i) => (
      <Slide key="produto" num={i} total={total}>
        <Selo>O produto</Selo>
        <h2>Um só produto. <em>Ganhos dos dois lados.</em></h2>
        <p className="ap-sub">O painel mostra à empresa onde agir. O aplicativo cuida de quem trabalha.</p>
        <div className="ap-cartoes c2">
          <div className="ap-cartao azul">
            <small>Para a empresa · painel web</small>
            <h3>Enxergar o risco, <em>agir com evidência.</em></h3>
            <ul><li>Diagnóstico NR-1 por setor e dimensão</li><li>Gestão dos riscos psicossociais mapeados</li><li>Relatórios e planos de ação com IA</li></ul>
          </div>
          <div className={`ap-cartao${premium ? '' : ' apagado'}`}>
            <small>Para o colaborador · aplicativo{premium ? '' : ' · no Premium'}</small>
            <h3>Cuidado e desenvolvimento <em>no bolso.</em></h3>
            <ul><li>Check-in emocional diário e Emociômetro</li><li>Trilhas com especialistas e a Luz, assistente com IA</li><li>Sessões com psicólogos e coaches</li></ul>
          </div>
        </div>
        <p className="ap-nota">Juntos, fecham o ciclo da NR-1 com desenvolvimento e cuidado o ano inteiro.</p>
      </Slide>
    ),

    empresa: (i) => (
      <Slide key="empresa" num={i} total={total}>
        <Selo>A camada da empresa</Selo>
        <h2>Para a empresa: <em>enxergar o risco</em></h2>
        <div className="ap-duas">
          <div className="ap-itens">
            <div><b>Diagnóstico NR-1</b><span>Os sete domínios do HSE, um instrumento validado internacionalmente, setor por setor, com score e classificação.</span></div>
            <div><b>Pesquisas do RH</b><span>Clima, pulso e eNPS: campanhas criadas e programadas pela própria empresa.</span></div>
            <div><b>Planos de ação com IA</b><span>Cada risco vira medida de controle com responsável e prazo.</span></div>
            {premium && <div><b>Clima emocional por equipe</b><span>Cada check-in do aplicativo vira um sinal anônimo, agregado por equipe.</span></div>}
          </div>
          <figure className="ap-painel" aria-label="Ilustração do painel">
            <div className="ap-painel-topo"><b>Diagnóstico <em>NR-1</em></b><span>por setor</span></div>
            <div className="ap-mapa">
              {Array.from({ length: 42 }, (_, k) => <i key={k} className={`n${[0, 1, 0, 2, 1, 0, 3, 0, 1, 1, 0, 2, 0, 0, 1, 2, 3, 1, 0, 1, 0, 0, 0, 1, 2, 1, 0, 0, 1, 0, 2, 3, 2, 1, 0, 0, 1, 0, 0, 1, 2, 1][k]}`} />)}
            </div>
            <figcaption>Ilustração · sete domínios × setores</figcaption>
          </figure>
        </div>
        <p className="ap-nota">Dados sempre agregados, com amostragem mínima protegida: a empresa enxerga o time, nunca a pessoa.</p>
      </Slide>
    ),

    colaborador: (i) => (
      <Slide key="colaborador" num={i} total={total}>
        <Selo>A camada do colaborador</Selo>
        <h2>Para o colaborador: <em>cuidado no bolso</em></h2>
        <div className="ap-duas">
          <div className="ap-itens">
            <div><b>Check-in emocional</b><span>Um por dia, para dar nome ao que sente e perceber o próprio padrão ao longo dos dias.</span></div>
            <div><b>Trilhas com especialistas</b><span>Mais de 100 horas de conteúdo em vídeo, com quiz e certificado ao final.</span></div>
            <div><b>Luz, assistente com IA</b><span>Acolhe, sugere o exercício certo e responde dúvidas, 24 horas por dia.</span></div>
            <div><b>Sessões com especialistas</b><span>Psicólogos com CRP ativo e coaches certificados: até 2 sessões por colaborador por mês.</span></div>
          </div>
          <figure className="ap-celular" aria-label="Ilustração do aplicativo">
            <div className="ap-tela">
              <small>Oi! Como você está se sentindo hoje?</small>
              <div className="ap-carinhas">{['😣', '😕', '😐', '🙂', '😄'].map((c, k) => <span key={k} className={k === 3 ? 'on' : ''}>{c}</span>)}</div>
              <span className="ap-botao">Registrar check-in</span>
            </div>
          </figure>
        </div>
        <p className="ap-nota">O que a pessoa registra é dela: a empresa só enxerga dados agregados.</p>
      </Slide>
    ),

    ciclo: (i) => (
      <Slide key="ciclo" num={i} total={total}>
        <Selo>Como funciona</Selo>
        <h2>Do diagnóstico ao cuidado, <em>em ciclo contínuo</em></h2>
        <div className="ap-cartoes c4">
          {[
            ['Diagnosticar', 'Questionário anônimo dos sete domínios do HSE, instrumento validado internacionalmente.'],
            ['Entender', 'O painel mostra o risco por setor e domínio; a IA gera o relatório e aponta onde ele se concentra.'],
            ['Agir', 'Cada risco vira plano de ação com responsável e prazo.'],
            ['Acompanhar', premium ? 'Check-ins diários, pesquisas e registros mantêm o ciclo vivo o ano todo.' : 'Pesquisas de clima e pulso e registros mantêm o ciclo vivo o ano todo.'],
          ].map(([t, d], k) => <div key={t} className="ap-cartao passo"><i>0{k + 1}</i><h3>{t}</h3><span>{d}</span></div>)}
        </div>
        <p className="ap-nota">O time do Lumi acompanha a implantação ao lado do RH, do primeiro diagnóstico ao ciclo completo.</p>
      </Slide>
    ),

    escopo: (i) => (
      <Slide key="escopo" num={i} total={total}>
        <Selo>Escopo</Selo>
        <h2>O que o Lumi entrega <em>na NR-1</em></h2>
        <p className="ap-sub">Transparência de escopo: cada parte do programa com o responsável certo.</p>
        <div className="ap-cartoes c2">
          <div className="ap-cartao azul">
            <small>O Lumi entrega</small>
            <ul className="ok"><li>Diagnóstico com instrumento validado (HSE)</li><li>Base para o inventário de riscos psicossociais</li><li>Plano de ação com responsável e prazo</li><li>Registros do programa organizados na plataforma</li></ul>
          </div>
          <div className="ap-cartao">
            <small>Segue com o seu SESMT ou consultoria</small>
            <ul className="traco"><li>Documento final do PGR</li><li>Envio de eventos ao eSocial</li><li>Laudos e programas de SST</li></ul>
            <p className="ap-fonte">O Lumi alimenta o PGR com o diagnóstico e o plano de ação, sem substituir a sua equipe de segurança do trabalho.</p>
          </div>
        </div>
      </Slide>
    ),

    ws_abertura: (i) => (
      <Slide key="ws_abertura" num={i} total={total} escuro>
        <Selo claro>Workshop · para lideranças</Selo>
        <h2 className="grande">NR-1 aplicada <em>às lideranças</em></h2>
        <p className="ap-lede">Prepare líderes para atuar com responsabilidade, cuidado emocional e segurança psicológica no dia a dia das equipes.</p>
        <p className="ap-citacao">Quando a NR-1 pede que a liderança reconheça riscos psicossociais no dia a dia.</p>
        <div className="ap-fatos">
          <div><small>Carga horária</small><b>6 horas</b></div>
          <div><small>Encontros</small><b>3 × 2 horas</b></div>
          <div><small>Modalidade</small><b>Presencial ou online</b></div>
          <div><small>Público</small><b>Lideranças formais e potenciais</b></div>
        </div>
      </Slide>
    ),

    ws_objetivos: (i) => (
      <Slide key="ws_objetivos" num={i} total={total}>
        <Selo>Workshop · objetivos</Selo>
        <h2>Saúde psicológica também <em>passa pela liderança.</em></h2>
        <p className="ap-sub">Reconhecer fatores de risco, fortalecer relações e agir no cotidiano da equipe.</p>
        <div className="ap-cartoes c3">
          <div className="ap-cartao passo"><i>01</i><h3>Reconhecer fatores de risco</h3><span>Entender os fatores de risco psicossociais previstos na NR-1 e como aparecem na rotina da equipe.</span></div>
          <div className="ap-cartao passo"><i>02</i><h3>Fortalecer a segurança psicológica</h3><span>Ferramentas práticas para ambientes seguros e para reduzir os indicadores de risco.</span></div>
          <div className="ap-cartao passo"><i>03</i><h3>Colocar o aprendizado em prática</h3><span>Construir estratégias e um plano de ação para ambientes psicologicamente seguros.</span></div>
        </div>
        <p className="ap-fonte">Portaria MTE nº 1.419/2024: fatores de risco psicossociais no gerenciamento de riscos (GRO/PGR) desde 26/05/2026.</p>
      </Slide>
    ),

    ws_conteudo: (i) => (
      <Slide key="ws_conteudo" num={i} total={total}>
        <Selo>Workshop · conteúdo</Selo>
        <h2>O conteúdo que <em>prepara a liderança.</em></h2>
        <div className="ap-cartoes c4">
          {[
            ['Papel da liderança', 'O líder como fator de proteção: metas saudáveis, acordos claros e conversas preventivas.'],
            ['Fatores e prevenção', 'Identificar e gerenciar os 13 fatores de risco psicossocial e construir cultura de prevenção.'],
            ['Segurança psicológica', 'Práticas para ambientes seguros, autocuidado, limites do líder e burnout: mitos e verdades.'],
            ['Plano de ação', 'O comportamento que o líder vai parar, fortalecer e implementar, com meta, indicador e prazo.'],
          ].map(([t, d], k) => <div key={t} className="ap-cartao passo"><i>0{k + 1}</i><h3>{t}</h3><span>{d}</span></div>)}
        </div>
      </Slide>
    ),

    ws_escopo: (i) => (
      <Slide key="ws_escopo" num={i} total={total}>
        <Selo>Workshop · escopo</Selo>
        <h2>O que está <em>incluído</em></h2>
        <div className="ap-duas">
          <div className="ap-itens check">
            <div><b>Preparação e aulas ao vivo</b><span>Pré-curso on-line e 6 horas de aula ao vivo com especialistas.</span></div>
            <div><b>Aprendizagem contínua</b><span>Conteúdos curtos em vídeo, artigos e podcasts para manter o tema vivo depois dos encontros.</span></div>
            <div><b>Aplicação e materiais</b><span>Plano de ação individual, material didático completo e certificado de conclusão.</span></div>
          </div>
          <div className="ap-destaque">
            <small>Nesta proposta</small>
            <strong>{ws ? `${ws.quantidade} ${ws.unidade}` : '—'}</strong>
            <p>{ws?.detalhe ?? '6 horas por turma, em 3 encontros de 2h.'}</p>
          </div>
        </div>
      </Slide>
    ),

    investimento: (i) => (
      <Slide key="investimento" num={i} total={total} className="ap-invest">
        <Selo>Investimento</Selo>
        <h2>Proposta para <em>{p.empresa}</em></h2>
        <p className="ap-sub">Versão {p.versao} · emitida em {data(p.criado_em)} · válida até {data(p.validade)}</p>
        <div className="ap-numeros">
          <div><small>Mensalidade do Lumi</small><strong>{brl(Number(p.mensal))}</strong><span>{p.vidas.toLocaleString('pt-BR')} colaboradores · {brl(Number(p.preco_vida))} por colaborador/mês</span></div>
          <div className="forte"><small>Investimento no primeiro ano</small><strong>{brl(primeiroAno + totalServ)}</strong><span>12 mensalidades + implementação{totalServ > 0 ? ' + workshop' : ''}</span></div>
        </div>
        <table className="ap-tabela">
          <tbody>
            <tr><td>Lumi · plano {plano}: {p.vidas.toLocaleString('pt-BR')} colaboradores</td><td>{brl(Number(p.mensal_tabela))}/mês</td></tr>
            {Number(p.desconto_pct) > 0 && <tr><td>Desconto comercial ({p.desconto_pct}%)</td><td>−{brl(Number(p.mensal_tabela) - Number(p.mensal))}/mês</td></tr>}
            <tr className="sub"><td>Mensalidade</td><td>{brl(Number(p.mensal))}/mês</td></tr>
            <tr><td>Implementação (anual){Number(p.desconto_implementacao_pct) > 0 ? ` · ${p.desconto_implementacao_pct}% de desconto sobre ${brl(Number(p.implementacao_tabela))}` : ''}</td><td>{brl(Number(p.implementacao))}</td></tr>
            <tr className="sub"><td>Lumi no primeiro ano</td><td>{brl(primeiroAno)}</td></tr>
            {servicos.map((s) => (
              <tr key={s.chave}><td>{s.nome}: {s.quantidade} {s.unidade} × {brl(Number(s.valor_unitario))}{s.detalhe ? <small>{s.detalhe}</small> : null}</td><td>{brl(Number(s.valor_total))}</td></tr>
            ))}
            <tr className="total"><td>Total no primeiro ano</td><td>{brl(primeiroAno + totalServ)}</td></tr>
          </tbody>
        </table>
        {p.observacoes && <div className="ap-condicoes"><small>Condições</small><p>{p.observacoes}</p></div>}
      </Slide>
    ),

    proximos: (i) => (
      <Slide key="proximos" num={i} total={total} escuro>
        <Selo claro>Próximo passo</Selo>
        <h2 className="grande">Vamos começar com <em>o seu time?</em></h2>
        <div className="ap-fatos passos">
          <div><small>01</small><b>Aceite desta proposta pelo link</b></div>
          <div><small>02</small><b>{ws ? 'Reunião de início com o RH e datas das turmas do workshop' : 'Reunião de início com o RH e plano de implantação'}</b></div>
          <div><small>03</small><b>Primeiro diagnóstico NR-1 com o time, acompanhado pelo Lumi</b></div>
        </div>
        <div className="ap-contato">
          {p.responsavel && <span>{p.responsavel.nome} · {p.responsavel.email}</span>}
          <span>applumi.io</span>
        </div>
      </Slide>
    ),
  };

  return (
    <div className="ap">
      <div className="ap-deck">{slides.map((k, i) => render[k]?.(i + 1))}</div>
      {depois}
    </div>
  );
}
