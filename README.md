# Lumi CRM

CRM comercial do Lumi em `crm.applumi.io`: captura de leads, funil de vendas, propostas com a tabela de preços e regras de desconto, e-mails individuais com rastreio e relatórios.

Stack: Vite + React + TypeScript no front, funções serverless da Vercel em `/api`, Supabase (Postgres, Auth e RLS) como banco, Resend para e-mail.

> O CRM não guarda dado de saúde individual. Só dados comerciais. Métricas de uso das empresas entram na fase 2, sempre agregadas (grupo mínimo de 5 pessoas).

## O que tem

| Área | O que faz |
|---|---|
| Início | Leads sem primeiro contato (meta de 2h úteis), pipeline, previsão ponderada, tarefas do dia, leads mais quentes, oportunidades paradas |
| Leads | Lista com filtros, cadastro manual, importação de lista (evento/feira), nota de perfil e de interesse, qualificar → cria conta, contato e oportunidade |
| Funil | Kanban com arrastar e soltar. Para avançar, pede os critérios de saída (dor, decisor, situação do PGR, demo, vidas e valor, condições) |
| Oportunidade | Gerador de propostas com a tabela do site, piso entre faixas e regras de desconto; aprovação por sócia; link público da proposta com aceite |
| Contas | Empresas, contatos e papéis na compra, consulta de CNPJ (BrasilAPI), id do cliente no admin Lumi |
| Tarefas | Atrasadas, hoje e próximas, por pessoa |
| E-mails | Envio pelo Resend em nome de quem vende (respostas voltam para o e-mail da pessoa), abertura e clique, modelos editáveis |
| Relatórios | Aquisição por origem e campanha, conversão, tempo de primeiro contato, taxa de ganho, ciclo, ticket, motivos de perda |
| Configurações | Time e permissões, tabela de preços, endereço e formulário pronto para capturar leads do site |

Regras de preço (em `shared/precos.ts`, com testes):

- **Piso entre faixas:** o mensal nunca fica abaixo do teto da faixa anterior.
- **Desconto até 10%:** decide quem vende.
- **Desconto de 10% a 20%, ou mais de 5.000 vidas:** precisa de aprovação de uma sócia.
- **Desconto acima de 20%:** bloqueado.
- **Implementação:** até 50% de desconto, para pilotos e contratos de 24 meses.

O banco reforça as mesmas regras (trigger `proposta_regras`), então não dá para burlar pelo navegador.

## Implantação (uma vez)

### 1. Supabase
1. Crie o projeto (região São Paulo).
2. Rode `supabase/migrations/0001_crm.sql` no SQL Editor.
3. Em **Authentication → URL Configuration**:
   - Site URL: `https://crm.applumi.io`;
   - Redirect URLs: `https://crm.applumi.io/definir-senha`.
4. Em **Authentication → Providers → Email**, desative "Allow new users to sign up". Só entra quem for convidado.
5. Primeira sócia: em **Authentication → Users → Invite user**, convide o e-mail. Depois rode, trocando nome e e-mail:
   ```sql
   insert into perfis (id, nome, email, papel, aprova_desconto)
   select id, 'Nome da Sócia', email, 'socia', true from auth.users where email = 'socia@applumi.io';
   ```
   As próximas pessoas são convidadas pela tela **Configurações** do próprio CRM.

### 2. Resend (envio de e-mail)
1. Adicione o domínio `applumi.io`.
2. Crie, na Hostinger (DNS de applumi.io), os registros que o Resend mostrar: SPF, DKIM e MX de retorno. Eles ficam num subdomínio de envio e não mexem nos e-mails que já funcionam.
3. Se ainda não existir, crie também um DMARC: `TXT _dmarc` → `v=DMARC1; p=none; rua=mailto:<seu e-mail>`.
4. Crie uma API key com permissão só de envio.
5. Em **Webhooks**, aponte para `https://crm.applumi.io/api/webhooks/resend` com os eventos delivered, opened, clicked, bounced e complained. Copie o signing secret.

### 3. Vercel
1. Importe este repositório (framework: Vite).
2. Configure estas variáveis de ambiente (modelo em `.env.example`):

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service role (secreta, só no servidor) |
| `RESEND_API_KEY` | chave do Resend |
| `RESEND_WEBHOOK_SECRET` | signing secret do webhook |
| `EMAIL_REMETENTE` | `Lumi <comercial@applumi.io>` (avisos internos) |
| `EMAIL_DOMINIO` | `applumi.io` |
| `CRM_URL` | `https://crm.applumi.io` |
| `ORIGENS_PERMITIDAS` | `https://applumi.io,https://www.applumi.io` (sites que podem enviar leads) |
| `NOTIFICAR_LEADS` | e-mails que recebem aviso de lead novo, separados por vírgula |
| `DONO_PADRAO_LEADS` | e-mail de quem recebe os leads do site (hoje, a Bruna) |

3. Em **Domains**, adicione `crm.applumi.io`.
4. Na Hostinger, crie o registro `CNAME crm → cname.vercel-dns.com`.

### 4. Site
Em **Configurações → Captura de leads** há um formulário pronto para colar no site. Ele envia para `/api/leads` com as UTMs da página.

Campos aceitos pelo `/api/leads`:
- **Contato:** `nome`, `email`, `whatsapp`, `empresa`, `cnpj`, `cargo`, `colaboradores`, `mensagem`.
- **Origem:** `origem`, `evento`, `pagina`.
- **Sinal de interesse (`tipo`):** `demo_solicitada`, `formulario_contato`, `download_material`, `inscricao_evento`, `presenca_evento`, `visita_planos`.
- **Consentimento:** `aceita_marketing`.
- **UTMs:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.

O campo escondido `site_url` funciona como armadilha para robôs.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha com um projeto Supabase de teste
npm run dev                  # front em http://localhost:5173
npx vercel dev               # front + funções /api
npm test                     # regras de preço, pontuação, horas úteis e o SQL (PGlite)
npm run build
```

Os testes de SQL sobem um Postgres em memória (PGlite) e rodam a migração inteira. Eles verificam:
- qualificação de lead;
- mudança de etapa;
- regras de aprovação de desconto;
- proteção de permissões.

## Próximas fases
- **Fase 2:** integração com o admin do Lumi (uso agregado por empresa, saúde da conta, alertas de churn) e réguas de e-mail para clientes, especialistas e usuários do app.
- **Fase 3:** API oficial do WhatsApp Business e assistente de IA para resumos e próximos passos.
