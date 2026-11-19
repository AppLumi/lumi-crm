// /api/funis/publico?slug=<slug> — formulário público de um funil (ex.: cadastro de especialistas).
// GET devolve só o que o formulário precisa mostrar. POST cria o card na primeira etapa (ou atualiza o cadastro
// da mesma pessoa feito nas últimas 24 h) e avisa o time.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, cors, emailValido, enviarEmail, env, esc, soDigitos, texto } from '../_lib.js';
import { validarDados, valorLegivel, type CampoFunil } from '../../shared/funis.js';

interface Funil {
  id: string; nome: string; campos: CampoFunil[]; formulario_publico: boolean; formulario_titulo: string | null;
  formulario_texto: string | null; formulario_obrigado: string | null; pede_empresa: boolean; avisar: string | null; dono_padrao: string | null; ativo: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const slug = String(req.query.slug ?? '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) return res.status(404).json({ erro: 'Formulário não encontrado' });
  const db = admin();
  const { data } = await db.from('funis').select('id, nome, campos, formulario_publico, formulario_titulo, formulario_texto, formulario_obrigado, pede_empresa, avisar, dono_padrao, ativo').eq('slug', slug).maybeSingle();
  const funil = data as Funil | null;
  if (!funil || !funil.formulario_publico || !funil.ativo) return res.status(404).json({ erro: 'Este formulário não está disponível' });
  const campos = (funil.campos ?? []).filter((c) => c.publico);

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      titulo: funil.formulario_titulo || funil.nome, texto: funil.formulario_texto, pede_empresa: funil.pede_empresa,
      campos: campos.map(({ chave, rotulo, tipo, obrigatorio, opcoes, ajuda }) => ({ chave, rotulo, tipo, obrigatorio: !!obrigatorio, opcoes, ajuda })),
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });

  const b = (typeof req.body === 'object' && req.body) ? req.body as Record<string, unknown> : {};
  if (texto(b.site_url)) return res.status(200).json({ ok: true, mensagem: funil.formulario_obrigado }); // honeypot
  const nome = texto(b.nome, 120);
  const email = texto(b.email, 160)?.toLowerCase() ?? null;
  const whatsapp = soDigitos(b.whatsapp).slice(0, 13) || null;
  const empresa = funil.pede_empresa ? texto(b.empresa, 160) : null;
  const erros: string[] = [];
  if (!nome || nome.split(/\s+/).length < 2) erros.push('Nome completo: obrigatório');
  if (!emailValido(email)) erros.push('E-mail: inválido');
  if (whatsapp && whatsapp.length < 10) erros.push('WhatsApp: use DDD + número');
  if (b.aceite !== true) erros.push('Autorização de uso dos dados: obrigatória');
  const v = validarDados(funil.campos ?? [], (b.dados ?? {}) as Record<string, unknown>, { publico: true });
  erros.push(...v.erros);
  if (erros.length) return res.status(400).json({ erro: erros[0], erros });

  const { data: etapas } = await db.from('funil_etapas').select('id').eq('funil_id', funil.id).eq('tipo', 'aberta').order('ordem').limit(1);
  if (!etapas?.length) return res.status(503).json({ erro: 'Formulário em manutenção. Tente mais tarde.' });

  // mesma pessoa reenviando em 24 h: atualiza o cadastro em vez de duplicar
  const { data: recente } = await db.from('funil_cards').select('id, dados').eq('funil_id', funil.id).eq('email', email)
    .gte('criado_em', new Date(Date.now() - 864e5).toISOString()).limit(1);
  const agora = new Date().toISOString();
  let cardId: string;
  if (recente?.length) {
    cardId = recente[0].id;
    await db.from('funil_cards').update({ nome, whatsapp, empresa, dados: { ...(recente[0].dados ?? {}), ...v.dados }, consentimento_em: agora }).eq('id', cardId);
    await db.from('atividades').insert({ tipo: 'sistema', titulo: 'Reenviou o formulário', card_id: cardId });
  } else {
    const { data: card, error } = await db.from('funil_cards').insert({
      funil_id: funil.id, etapa_id: etapas[0].id, titulo: nome, nome, email, whatsapp, empresa, dados: v.dados,
      origem: 'formulario', aceita_marketing: b.aceita_marketing === true, consentimento_em: agora, dono: funil.dono_padrao,
    }).select('id').single();
    if (error) { console.error('funil publico:', error.message); return res.status(500).json({ erro: 'Não foi possível enviar agora. Tente de novo.' }); }
    cardId = card.id;
    await db.from('atividades').insert({ tipo: 'sistema', titulo: 'Cadastro recebido pelo formulário', card_id: cardId });
  }

  const avisar = (funil.avisar ?? '').split(',').map((s) => s.trim()).filter((s) => emailValido(s));
  if (avisar.length && process.env.RESEND_API_KEY) {
    const url = `${(env('CRM_URL', false) || 'https://crm.applumi.io').replace(/\/$/, '')}/cards/${cardId}`;
    const linhas = [`${nome} · ${email}${whatsapp ? ` · ${whatsapp}` : ''}`, ...(empresa ? [`Empresa: ${empresa}`] : []),
      ...campos.filter((c) => v.dados[c.chave] != null).map((c) => `${c.rotulo}: ${valorLegivel(c, v.dados[c.chave])}`)];
    try {
      await enviarEmail({ para: avisar, assunto: `${recente?.length ? 'Cadastro atualizado' : 'Novo cadastro'} em ${funil.nome}: ${nome}`,
        texto: `${linhas.join('\n')}\n\nAbrir no CRM: ${url}`,
        html: `<div style="font:15px/1.6 Arial,sans-serif;color:#0B1B3F">${linhas.map((l) => `<div>${esc(l)}</div>`).join('')}<p><a href="${url}" style="color:#1E4FB8">Abrir no CRM</a></p></div>` });
    } catch (e) { console.error('aviso funil:', (e as Error).message); }
  }
  return res.status(200).json({ ok: true, mensagem: funil.formulario_obrigado || 'Recebemos seu cadastro. Obrigado!' });
}
