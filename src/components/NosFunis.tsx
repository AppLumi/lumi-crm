import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import type { CardFunil, Funil } from '../lib/tipos';
import { Modal, Selo } from './ui';

export interface BaseCard {
  titulo: string; nome?: string | null; email?: string | null; whatsapp?: string | null; empresa?: string | null;
  conta_id?: string | null; contato_id?: string | null; lead_id?: string | null; aceita_marketing?: boolean; consentimento_em?: string | null;
}

/** Cartão "Nos funis": em quais funis próprios esta pessoa/empresa está, e botão para colocar em mais um. */
export default function NosFunis({ filtro, base }: { filtro: { coluna: 'lead_id' | 'conta_id'; valor: string }; base: BaseCard }) {
  const ir = useNavigate();
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [cards, setCards] = useState<CardFunil[] | null>(null);
  const [funis, setFunis] = useState<Pick<Funil, 'id' | 'nome' | 'dono_padrao'>[]>([]);
  const [escolher, setEscolher] = useState(false);

  const carregar = useCallback(async () => {
    const [c, f] = await Promise.all([
      supabase.from('v_funil_cards').select('id, funil_id, titulo, etapa_nome, etapa_tipo').eq(filtro.coluna, filtro.valor).order('criado_em', { ascending: false }),
      supabase.from('funis').select('id, nome, dono_padrao').eq('ativo', true).order('ordem'),
    ]);
    if (f.error) { setCards(null); return; } // migração dos funis ainda não rodou
    setCards((c.data ?? []) as CardFunil[]);
    setFunis((f.data ?? []) as Pick<Funil, 'id' | 'nome' | 'dono_padrao'>[]);
  }, [filtro.coluna, filtro.valor]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!cards || !funis.length) return null;
  const nomeFunil = (id: string) => funis.find((f) => f.id === id)?.nome ?? 'Funil';

  const adicionar = (f: Pick<Funil, 'id' | 'nome' | 'dono_padrao'>) => executar(async () => {
    const { data: et } = await supabase.from('funil_etapas').select('id').eq('funil_id', f.id).eq('tipo', 'aberta').order('ordem').limit(1);
    if (!et?.length) throw new Error('Esse funil não tem etapa em andamento');
    const r = ok(await supabase.from('funil_cards').insert({
      funil_id: f.id, etapa_id: et[0].id, titulo: base.titulo, nome: base.nome ?? null, email: base.email ?? null, whatsapp: base.whatsapp ?? null,
      empresa: base.empresa ?? null, conta_id: base.conta_id ?? null, contato_id: base.contato_id ?? null, lead_id: base.lead_id ?? null,
      aceita_marketing: !!base.aceita_marketing, consentimento_em: base.consentimento_em ?? null, dono: f.dono_padrao ?? perfil?.id, origem: 'crm',
    }).select('id').single());
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `Entrou no funil ${f.nome}`, card_id: r!.id, conta_id: base.conta_id ?? null, lead_id: base.lead_id ?? null, autor: perfil?.id });
    ir(`/cards/${r!.id}`);
  }, `Adicionado ao funil ${f.nome}`);

  return (
    <div className="cartao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2>Nos funis</h2>
        <button className="btn pequeno" onClick={() => setEscolher(true)}>Adicionar a um funil</button>
      </div>
      {cards.length === 0 ? <p className="muted" style={{ marginTop: 8 }}>Em nenhum funil próprio.</p> : (
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {cards.map((c) => (
            <Link key={c.id} to={`/cards/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{nomeFunil(c.funil_id)}{c.titulo !== base.titulo ? <span className="muted"> · {c.titulo}</span> : null}</span>
              <Selo cor={c.etapa_tipo === 'ganha' ? 'verde' : c.etapa_tipo === 'perdida' ? 'vermelho' : 'azul'}>{c.etapa_nome}</Selo>
            </Link>
          ))}
        </div>
      )}
      <Modal titulo="Adicionar a um funil" aberto={escolher} fechar={() => setEscolher(false)}>
        <p className="muted">O card entra na primeira etapa, com os dados de {base.titulo}.</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {funis.map((f) => (
            <button key={f.id} className="btn" style={{ justifyContent: 'space-between', display: 'flex' }} disabled={ocupado} onClick={() => adicionar(f)}>
              <span>{f.nome}</span>{cards.some((c) => c.funil_id === f.id) && <span className="muted">já está</span>}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
