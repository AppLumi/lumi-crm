// Valida a migração num Postgres em memória (PGlite) com um stub mínimo do schema auth do Supabase.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';

const SOCIA = '00000000-0000-0000-0000-000000000001';
const BRUNA = '00000000-0000-0000-0000-000000000002';
let db: PGlite;

const como = async (uid: string | null, sql: string, params: unknown[] = []) => {
  await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
  return db.query(sql, params);
};

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/0001_crm.sql', import.meta.url), 'utf8'));
  await db.exec(`
    insert into auth.users values ('${SOCIA}', 'socia@applumi.io'), ('${BRUNA}', 'bruna@applumi.io');
    insert into perfis (id, nome, email, papel, aprova_desconto) values
      ('${SOCIA}', 'Sócia', 'socia@applumi.io', 'socia', true),
      ('${BRUNA}', 'Bruna Salazar', 'bruna@applumi.io', 'negocios', false);
  `);
});

describe('migração', () => {
  it('qualifica lead criando conta, contato e oportunidade', async () => {
    const { rows } = await db.query<{ id: string }>(`insert into leads (nome, email, empresa, cnpj, colaboradores, cargo)
      values ('Ana Souza', 'ana@acme.com.br', 'Acme', '12345678000199', 250, 'Gerente de RH') returning id`);
    const lead = rows[0].id;
    await db.query(`insert into eventos (nome, lead_id) values ('demo_solicitada', $1), ('visita_planos', $1)`, [lead]);
    const v = await db.query<{ nota_interesse: number }>(`select nota_interesse from v_leads where id = $1`, [lead]);
    expect(v.rows[0].nota_interesse).toBe(50);
    const op = await como(BRUNA, `select qualificar_lead($1, 'premium') as id`, [lead]);
    const opId = (op.rows[0] as { id: string }).id;
    const o = await db.query<{ vidas: number; titulo: string }>(`select vidas, titulo from oportunidades where id = $1`, [opId]);
    expect(o.rows[0]).toEqual({ vidas: 250, titulo: 'Lumi · Acme' });
    const l = await db.query<{ status: string }>(`select status from leads where id = $1`, [lead]);
    expect(l.rows[0].status).toBe('qualificado');
    // idempotente
    const de_novo = await como(BRUNA, `select qualificar_lead($1) as id`, [lead]);
    expect((de_novo.rows[0] as { id: string }).id).toBe(opId);
  });

  it('mudança de etapa registra na linha do tempo e ganho vira cliente', async () => {
    const { rows } = await db.query<{ id: string; conta_id: string }>(`select id, conta_id from oportunidades limit 1`);
    await como(BRUNA, `update oportunidades set etapa = 'ganha' where id = $1`, [rows[0].id]);
    const c = await db.query<{ estagio: string }>(`select estagio from contas where id = $1`, [rows[0].conta_id]);
    expect(c.rows[0].estagio).toBe('cliente');
    const a = await db.query(`select titulo from atividades where oportunidade_id = $1 and tipo = 'sistema'`, [rows[0].id]);
    expect(a.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('desconto acima de 10% exige aprovação de sócia', async () => {
    const { rows } = await db.query<{ id: string }>(`select id from oportunidades limit 1`);
    const base = `insert into propostas (oportunidade_id, versao, plano, vidas, preco_vida, mensal_tabela, desconto_pct, mensal,
      implementacao_tabela, implementacao, primeiro_ano, status) values ($1, $2, 'premium', 250, 21.90, 5475, $3, 4653.75, 1500, 1500, 57345, $4) returning id`;
    await expect(como(BRUNA, base, [rows[0].id, 1, 15, 'aprovada'])).rejects.toThrow(/aprovação/);
    const p = await como(BRUNA, base, [rows[0].id, 2, 15, 'aguardando_aprovacao']);
    const pid = (p.rows[0] as { id: string }).id;
    await expect(como(BRUNA, `update propostas set aprovado_por = $2, status = 'aprovada' where id = $1`, [pid, BRUNA])).rejects.toThrow(/permissão/);
    await expect(como(BRUNA, `update propostas set aprovado_por = $2, status = 'aprovada' where id = $1`, [pid, SOCIA])).rejects.toThrow(/quem aprova/);
    await como(SOCIA, `update propostas set aprovado_por = $2, status = 'aprovada' where id = $1`, [pid, SOCIA]);
    const ok = await db.query<{ aprovado_em: string | null }>(`select aprovado_em from propostas where id = $1`, [pid]);
    expect(ok.rows[0].aprovado_em).not.toBeNull();
    await expect(como(SOCIA, base, [rows[0].id, 3, 25, 'rascunho'])).rejects.toThrow(/20%/);
  });

  it('ninguém muda o próprio papel', async () => {
    await expect(como(BRUNA, `update perfis set aprova_desconto = true where id = $1`, [BRUNA])).rejects.toThrow(/administração/);
  });
});
