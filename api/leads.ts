// POST /api/leads — captura pública (site, landing pages, eventos, QR). Chamada pelo navegador do visitante.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, consultarCnpj, cors, emailValido, enviarEmail, esc, soDigitos, texto } from './_lib.js';
import { cnpjValido, notaPerfil, PESOS_EVENTOS } from '../shared/pontuacao.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const b = (typeof req.body === 'object' && req.body) ? req.body as Record<string, unknown> : {};
  if (texto(b.site_url)) return res.status(200).json({ ok: true }); // honeypot: robôs preenchem o campo escondido

  const nome = texto(b.nome, 120);
  const email = texto(b.email, 160)?.toLowerCase() ?? null;
  const whatsapp = soDigitos(b.whatsapp).slice(0, 13) || null;
  if (!nome || (!emailValido(email) && !whatsapp)) return res.status(400).json({ erro: 'Informe nome e um e-mail ou WhatsApp válido' });
  const cnpjBruto = soDigitos(b.cnpj);
  const cnpj = cnpjBruto && cnpjValido(cnpjBruto) ? cnpjBruto : null;
  const colab = Number(soDigitos(b.colaboradores)) || null;
  const evento = texto(b.tipo, 40) ?? 'formulario_contato';
  const tipoEvento = evento in PESOS_EVENTOS ? evento : 'formulario_contato';
  const aceita = b.aceita_marketing === true || b.aceita_marketing === 'true' || b.aceita_marketing === 'on';

  const db = admin();
  const enriquecimento = cnpj ? await consultarCnpj(cnpj) : null;

  // mesmo e-mail nos últimos 90 dias = mesmo lead: soma o sinal em vez de duplicar
  let leadId: string | null = null;
  if (email) {
    const { data } = await db.from('leads').select('id').eq('email', email)
      .gte('criado_em', new Date(Date.now() - 90 * 864e5).toISOString()).order('criado_em', { ascending: false }).limit(1);
    leadId = data?.[0]?.id ?? null;
  }
  const dono = (await db.from('perfis').select('id').eq('email', (process.env.DONO_PADRAO_LEADS ?? '').toLowerCase()).maybeSingle()).data?.id ?? null;

  if (!leadId) {
    const { data, error } = await db.from('leads').insert({
      nome, email, whatsapp, cnpj,
      empresa: texto(b.empresa, 160) ?? (enriquecimento?.nome_fantasia as string) ?? (enriquecimento?.razao_social as string) ?? null,
      cargo: texto(b.cargo, 120), colaboradores: colab, mensagem: texto(b.mensagem, 2000),
      origem: texto(b.origem, 60) ?? 'site', pagina: texto(b.pagina, 300), evento: texto(b.evento, 120),
      utm_source: texto(b.utm_source, 120), utm_medium: texto(b.utm_medium, 120), utm_campaign: texto(b.utm_campaign, 120),
      utm_content: texto(b.utm_content, 120), utm_term: texto(b.utm_term, 120),
      aceita_marketing: aceita, consentimento_em: aceita ? new Date().toISOString() : null,
      enriquecimento, dono,
      nota_perfil: notaPerfil({ colaboradores: colab, cargo: texto(b.cargo), cnae: enriquecimento?.cnae as string, cnpjValido: !!cnpj, temWhatsapp: !!whatsapp }),
    }).select('id').single();
    if (error) { console.error('lead:', error.message); return res.status(500).json({ erro: 'Não foi possível registrar agora' }); }
    leadId = data.id;
  }
  await db.from('eventos').insert({ nome: tipoEvento, origem: texto(b.origem, 60) ?? 'site', lead_id: leadId,
    propriedades: { pagina: texto(b.pagina, 300), evento: texto(b.evento, 120), utm_campaign: texto(b.utm_campaign, 120) } });

  // aviso imediato para quem atende os leads
  const avisar = (process.env.NOTIFICAR_LEADS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (avisar.length && process.env.RESEND_API_KEY) {
    const url = `${process.env.CRM_URL ?? 'https://crm.applumi.io'}/leads/${leadId}`;
    const linhas = [`${nome}${texto(b.cargo) ? ` · ${texto(b.cargo)}` : ''}`, texto(b.empresa) ?? '', colab ? `${colab} colaboradores` : '', `Origem: ${texto(b.origem) ?? 'site'} · ${tipoEvento}`];
    try {
      await enviarEmail({ para: avisar, assunto: `Novo lead: ${nome}${texto(b.empresa) ? ` (${texto(b.empresa)})` : ''}`,
        texto: `${linhas.filter(Boolean).join('\n')}\n\nAbrir no CRM: ${url}`,
        html: `<div style="font:15px/1.6 Arial,sans-serif;color:#0B1B3F">${linhas.filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('')}<p><a href="${url}" style="color:#1E4FB8">Abrir no CRM</a></p></div>` });
    } catch (e) { console.error('aviso de lead:', (e as Error).message); }
  }
  return res.status(200).json({ ok: true });
}
