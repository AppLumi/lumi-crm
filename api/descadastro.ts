// /api/descadastro?l=<lead>&t=<assinatura> — link "Descadastre-se" dos e-mails em massa.
// GET mostra a confirmação (leitores de link e antivírus abrem links sozinhos, então o GET não descadastra).
// POST descadastra: vem do botão da página ou do "cancelar inscrição" do próprio Gmail/Outlook (List-Unsubscribe-Post).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, assinaturaLeadValida, esc } from './_lib.js';

const uuid = /^[0-9a-f-]{36}$/i;

function pagina(res: VercelResponse, status: number, titulo: string, texto: string, form?: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titulo)} · Lumi</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F7FC;font:16px/1.6 Arial,Helvetica,sans-serif;color:#0B1B3F;padding:24px;box-sizing:border-box}
main{max-width:440px;background:#fff;border-radius:18px;padding:32px 28px;box-shadow:0 18px 40px -24px rgba(11,27,63,.35)}
h1{font-size:22px;margin:0 0 10px}p{margin:0 0 18px;color:#3B4A6B}button{font:600 15px Arial,Helvetica,sans-serif;background:#1E4FB8;color:#fff;border:0;border-radius:12px;padding:12px 20px;cursor:pointer}</style>
</head><body><main><h1>${esc(titulo)}</h1><p>${esc(texto)}</p>${form ?? ''}</main></body></html>`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const l = String(req.query.l ?? ''), t = String(req.query.t ?? '');
  if (!uuid.test(l) || !assinaturaLeadValida(l, t)) return pagina(res, 400, 'Link inválido', 'Este link de descadastro não está completo. Responda o e-mail pedindo para sair da lista que a gente tira você.');

  if (req.method === 'GET') {
    return pagina(res, 200, 'Parar de receber e-mails do Lumi?', 'Você deixa de receber os e-mails de conteúdo e novidades do Lumi neste endereço.',
      `<form method="post"><button type="submit">Sim, quero sair da lista</button></form>`);
  }
  if (req.method !== 'POST') return res.status(405).end();

  const db = admin();
  const { data: lead } = await db.from('leads').select('id, email').eq('id', l).maybeSingle();
  if (lead) {
    const { data: ja } = await db.from('eventos').select('id').eq('nome', 'descadastro').eq('lead_id', l).limit(1);
    if (!ja?.length) await db.from('eventos').insert({ nome: 'descadastro', origem: 'email', lead_id: l });
    await db.from('leads').update({ aceita_marketing: false }).eq('id', l);
    if (lead.email) await db.from('contatos').update({ descadastrado_em: new Date().toISOString(), aceita_marketing: false })
      .ilike('email', lead.email).is('descadastrado_em', null);
    await db.from('atividades').insert({ tipo: 'sistema', titulo: 'Pediu para não receber mais e-mails', lead_id: l });
  }
  return pagina(res, 200, 'Pronto, você saiu da lista', 'Você não vai mais receber os e-mails de conteúdo do Lumi neste endereço.');
}
