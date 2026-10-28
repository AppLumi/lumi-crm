// GET /api/cnpj?cnpj=00000000000000 — consulta cadastral para o time (exige login)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { consultarCnpj, exigirTime, soDigitos } from './_lib.js';
import { cnpjValido } from '../shared/pontuacao.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await exigirTime(req, res))) return;
  const cnpj = soDigitos(req.query.cnpj);
  if (!cnpjValido(cnpj)) return res.status(400).json({ erro: 'CNPJ inválido' });
  const dados = await consultarCnpj(cnpj);
  if (!dados) return res.status(404).json({ erro: 'Não encontrado na consulta pública' });
  return res.status(200).json(dados);
}
