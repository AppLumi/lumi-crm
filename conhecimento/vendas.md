# Vendas: preços, regras, público, argumentos, objeções e treino

Base de conhecimento do time comercial. Atualizada em 27/11/2026. Preços e regras: `shared/precos.ts` e README do CRM (as mesmas da página de planos do applumi.io). Abordagem a clientes da Grou: documento "Abordagem Lumi para clientes Grou" (27/11/2026).

## 1. Tabela de preços

Preço **por colaborador (vida ativa) por mês**, conforme a faixa de tamanho do time, mais uma **implementação**. O preço da faixa vale para todas as vidas.

| Faixa de colaboradores | Starter (por pessoa/mês) | Premium (por pessoa/mês) | Implementação |
|---|---|---|---|
| 1 a 30 | R$ 9,90 | R$ 29,90 | R$ 700 |
| 31 a 50 | R$ 9,90 | R$ 29,90 | R$ 900 |
| 51 a 200 | R$ 7,90 | R$ 25,90 | R$ 1.200 |
| 201 a 500 | R$ 5,90 | R$ 21,90 | R$ 1.500 |
| 501 a 1.000 | R$ 4,90 | R$ 18,90 | R$ 1.900 |
| 1.001 a 3.000 | R$ 3,90 | R$ 15,90 | R$ 2.600 |
| 3.001 a 5.000 | R$ 2,90 | R$ 13,90 | R$ 3.500 |
| Acima de 5.000 | R$ 1,90 | R$ 12,90 | R$ 4.500 |

- **Mensal** = vidas × preço da faixa (com o piso entre faixas, abaixo).
- **Primeiro ano** = mensal × 12 + implementação.
- **Implementação:** o site diz "cobrada uma vez por ano" e a especificação do CRM diz "uma vez por ano". As fontes não dizem se ela se repete na renovação: **confirmar com uma sócia antes de afirmar** ao cliente.
- **Acima de 5.000 vidas:** o site orienta orçamento pelo time comercial ("times acima de 5.000 pessoas e contratos com escopo específico são orçados pelo time comercial"); a calculadora do site mostra o preço de tabela; o CRM trata como **proposta sob aprovação**.
- A faixa de 3.001 a 5.000 (R$ 2,90 / R$ 13,90 / R$ 3.500) foi definida no meio do caminho entre as faixas vizinhas (decisão registrada na especificação do CRM).

### 1.1 O que cada plano inclui
| | Starter | Premium |
|---|---|---|
| Posicionamento do site | "Só a camada de gestão: o que a empresa precisa para cumprir a NR-1 e enxergar o clima" | "Tudo do Starter mais a camada do colaborador e as sessões: duas por pessoa ao mês" |
| Diagnóstico de NR-1 | Sim | Sim |
| Pesquisas de clima e pulso | Sim | Sim |
| Dashboard e guarda documental | Sim | Sim |
| Plano de ação por IA | Sim | Sim |
| Aplicativo do colaborador | **Não** | Sim |
| Trilhas, Emociômetro e a Luz | **Não** | Sim |
| Sessões com especialistas | **Não** | **2 por colaborador/mês** |

Quando sugerir cada um (leitura das fontes):
- **Starter:** empresa que quer resolver a parte psicossocial da NR-1 e enxergar o clima com orçamento curto; micro e pequenas ("cuidado com o time pequeno; plano Starter", segundo a abordagem Grou); porta de entrada ("dá para começar pelo plano Starter ou por um setor piloto").
- **Premium:** empresa que quer, além da NR-1, cuidado contínuo do colaborador (check-in, trilhas, Luz, sessões). É o plano que fecha o ciclo "diagnóstico → ação → cuidado" do site.
- Lembrete: a NR-1 prioriza medidas na organização do trabalho; o Premium soma apoio individual, que entra no plano de ação como medida **complementar**.

### 1.2 Piso entre faixas
Problema: como o preço da faixa vale para todas as vidas, subir de faixa podia baratear o total (ex.: 50 vidas no Starter = R$ 495,00; 51 vidas a R$ 7,90 = R$ 402,90).

Regra adotada: **o mensal nunca fica abaixo do teto da faixa anterior** (limite da faixa anterior × preço dela).
`Mensal = maior entre (vidas × preço da faixa) e (limite da faixa anterior × preço da faixa anterior)`

| Faixa | Piso Starter | Piso vale de… até… (Starter) | Piso Premium | Piso vale de… até… (Premium) |
|---|---|---|---|---|
| 31 a 50 | R$ 297,00 | nunca se aplica | R$ 897,00 | nunca se aplica |
| 51 a 200 | R$ 495,00 | 51 a 62 vidas | R$ 1.495,00 | 51 a 57 vidas |
| 201 a 500 | R$ 1.580,00 | 201 a 267 vidas | R$ 5.180,00 | 201 a 236 vidas |
| 501 a 1.000 | R$ 2.950,00 | 501 a 602 vidas | R$ 10.950,00 | 501 a 579 vidas |
| 1.001 a 3.000 | R$ 4.900,00 | 1.001 a 1.256 vidas | R$ 18.900,00 | 1.001 a 1.188 vidas |
| 3.001 a 5.000 | R$ 11.700,00 | 3.001 a 4.034 vidas | R$ 47.700,00 | 3.001 a 3.431 vidas |
| Acima de 5.000 | R$ 14.500,00 | 5.001 a 7.631 vidas | R$ 69.500,00 | 5.001 a 5.387 vidas |

(Limiares calculados a partir de `precos.ts`; o gerador de propostas do CRM faz a conta sozinho e marca "piso aplicado".)

O CRM também avisa quando a empresa está **perto da próxima faixa** (faltam menos de 10% do limite da faixa para trocar de faixa). Use para conversar sobre crescimento do time, nunca para empurrar vidas que a empresa não tem.

### 1.3 Exemplos de tabela (sem desconto)
| Vidas | Plano | Mensal | Implementação | Primeiro ano |
|---|---|---|---|---|
| 30 | Starter | R$ 297,00 | R$ 700 | R$ 4.264,00 |
| 30 | Premium | R$ 897,00 | R$ 700 | R$ 11.464,00 |
| 50 | Starter | R$ 495,00 | R$ 900 | R$ 6.840,00 |
| 51 | Starter | R$ 495,00 (piso) | R$ 1.200 | R$ 7.140,00 |
| 100 | Starter | R$ 790,00 | R$ 1.200 | R$ 10.680,00 |
| 100 | Premium | R$ 2.590,00 | R$ 1.200 | R$ 32.280,00 |
| 200 | Starter | R$ 1.580,00 | R$ 1.200 | R$ 20.160,00 |
| 200 | Premium | R$ 5.180,00 | R$ 1.200 | R$ 63.360,00 |
| 500 | Starter | R$ 2.950,00 | R$ 1.500 | R$ 36.900,00 |
| 500 | Premium | R$ 10.950,00 | R$ 1.500 | R$ 132.900,00 |
| 1.000 | Premium | R$ 18.900,00 | R$ 1.900 | R$ 228.700,00 |
| 5.000 | Starter | R$ 14.500,00 | R$ 3.500 | R$ 177.500,00 |

Os valores de 200 vidas são os mesmos que a calculadora do site mostra por padrão.

## 2. Descontos e aprovação

| Situação | Regra |
|---|---|
| Desconto no mensal até 10% | Decide quem vende |
| Desconto no mensal acima de 10% e até 20% | Precisa de **aprovação de uma sócia** (no CRM, perfis com "aprova desconto") |
| Desconto no mensal acima de 20% | **Bloqueado** (não se pratica) |
| Mais de 5.000 vidas | Precisa de aprovação de uma sócia, com qualquer desconto |
| Desconto na implementação | Até **50%**, para **pilotos e contratos de 24 meses** |

- O banco de dados do CRM reforça as mesmas regras (gatilho `proposta_regras`): não dá para burlar pelo navegador.
- O desconto incide sobre o mensal de tabela **já com o piso** aplicado.
- Divergência de fontes: o README diz "até 10% decide quem vende"; a especificação de 28/10 dizia "até 10% pela Bruna" (diretora de negócios, que hoje faz pré-vendas e fechamento). Vale o README e o código (mais recentes): quem vende decide até 10%.
- Proposta tem link público com aceite. Não passe preço fechado por mensagem fria: a tabela tem piso por faixa e descontos que precisam de aprovação, e o CRM faz a conta na proposta.

Exemplo: 300 vidas Premium = R$ 6.570,00/mês de tabela. Com 10% (sem aprovação): R$ 5.913,00/mês; primeiro ano R$ 72.456,00 (com implementação cheia de R$ 1.500). Com 15%: precisa de sócia. Implementação em piloto ou contrato de 24 meses: pode cair até R$ 750.

## 3. Para quem vendemos (ICP)

### 3.1 Perfil ideal
- **Empresas de 50 a 5.000 pessoas** que precisam cumprir a parte psicossocial da NR-1 (estratégia do blog).
- **Quem compra:** CEO, diretoria de pessoas, SESMT ou jurídico de empresas que precisam cumprir a NR-1 (especificação do CRM).
- **Quem usa o painel:** RH e gestores do cliente; SESMT (técnicos e engenheiros de segurança, médicos do trabalho).
- **Quem se beneficia do app:** colaboradores da empresa cliente.
- **Sinais de perfil (nota de fit do CRM, pesos a calibrar):** 100+ colaboradores pesa mais; setor com risco psicossocial alto; cargo do contato em RH, SESMT ou diretoria; região atendida.
- **Sinais de interesse (nota de intent):** pediu demo, foi a evento, baixou material sobre NR-1, voltou ao site na semana, abriu e clicou e-mails, respondeu WhatsApp. O interesse perde força com o tempo (ex.: metade a cada 30 dias sem ação).
- **Dores que qualificam** (critério da etapa 1 do funil): NR-1, afastamentos, turnover.

### 3.2 Segmentos por porte (base Grou, usável como referência geral)
| Grupo | Faixas | Para quem escrever | Ângulo principal |
|---|---|---|---|
| Médias e grandes | 201 a 5.000 | Gerente ou diretor de RH, SESMT, gestão de pessoas | Diagnóstico NR-1 por setor + plano de ação com evidências |
| Grandes contas | Acima de 5.000 | Diretoria de pessoas, saúde ocupacional, benefícios | Escala: clima emocional contínuo e cuidado para milhares de pessoas, com dados agregados |
| Pequenas e médias | 21 a 200 | Dono, sócio ou RH generalista | NR-1 resolvida sem montar estrutura, com preço por pessoa |
| Micro | 1 a 20 | Dono ou sócio | Cuidado com o time pequeno; plano Starter |

Faixas de 201 a 5.000 vêm primeiro: têm RH estruturado e sentem a NR-1 agora. Lembrete para micro e pequenas: ME e EPP de grau de risco 1 e 2 dispensadas do PGR continuam obrigadas a fazer a AEP (ver nr1.md).

### 3.3 Divisão com a Grou
- A Grou cuida de **perfil e desenvolvimento** (avaliação comportamental como PDA e DISC, liderança e treinamento de gestores). O Lumi cuida de **saúde emocional e NR-1** pelo lado da gestão de riscos, PGR, diagnóstico e plataforma.
- No conteúdo: NR-1 pelo lado de liderança e treinamento de gestores é da Grou; pelo lado de gestão de riscos é do Lumi.

## 4. Proposta de valor

### 4.1 Em uma frase
- Geral: "O Lumi faz o diagnóstico dos riscos psicossociais por setor, sem identificar ninguém, ajuda a montar o plano de ação com as evidências e ainda dá ao time apoio no dia a dia pelo aplicativo."
- Para cliente da Grou: "A Grou ajuda vocês a escolher e desenvolver pessoas; o Lumi ajuda a cuidar de como elas estão no dia a dia e resolve a parte psicossocial da NR-1 com dados."
- Do site: "Um só produto. Ganhos dos dois lados." / "O painel mostra à empresa onde agir. O aplicativo cuida de quem trabalha."

### 4.2 Pilares
1. **NR-1 com método:** instrumento validado (HSE, 7 domínios, 35 itens), resultado por setor e domínio, base para o inventário do PGR, plano de ação com responsável e prazo.
2. **Dado contínuo, não foto anual:** clima emocional todo mês pelo check-in (Premium), pesquisas de clima e pulso criadas pelo próprio RH, evolução de até 12 campanhas.
3. **Cuidado para quem trabalha (Premium):** mais de 100 horas de trilhas com quiz e certificado, a Luz 24 horas, sessões com psicólogos com CRP ativo e coaches certificados (2 por pessoa/mês).
4. **Privacidade por construção:** a empresa vê só dados agregados; check-in, Luz e sessões são do colaborador.
5. **IA que ajuda o RH:** relatório gerado a partir do diagnóstico, com plano de ação sugerido.
6. **Preço por pessoa que cai com o tamanho do time**, com implementação acompanhada pelo time do Lumi.

### 4.3 Diferenciais (comparativo do site, setembro/2026)
O site divide o mercado em três frentes; "para fechar a NR-1 do diagnóstico à evidência, e ainda entregar desenvolvimento e cuidado, normalmente é preciso contratar duas ou três dessas frentes".

| Capacidade | Lumi | Telepsicologia (Zenklub, Vittude, StarBem) | Conformidade NR-1 (Moodar, Mapa HDS, Wellz) | RH + SST (Sólides) |
|---|---|---|---|---|
| Diagnóstico psicossocial com instrumento validado | ✓ | – | ✓ | ✓ |
| Inventário de riscos e plano de ação | ✓ | – | ✓ | ✓ |
| PGR gerado na plataforma e envio ao eSocial | ○ | – | ○ | ✓ |
| Pesquisas de clima e pulso criadas pelo próprio RH | ✓ | – | ○ | ○ |
| Trilhas de desenvolvimento para todo o time | ✓ | – | ○ | – |
| Aplicativo do colaborador com check-in diário | ✓ | ○ | – | – |
| IA que gera relatório e sugere plano de ação | ✓ | – | – | – |
| Sessões com psicólogos credenciados no CRP | ✓ | ✓ | – | – |
| Sessões com coaches e mentores | ✓ | – | – | – |

✓ entrega · ○ parcial ou via consultoria · – fora do foco. Elaborado pelo Lumi com material público das empresas em setembro de 2026; descreve foco de atuação, não qualidade.

Regras de uso:
- Nunca fale mal de concorrente. "Cada uma é referência na frente em que atua."
- **Inventário de riscos:** o quadro marca ✓ para o Lumi, mas o mapeamento interno de 13/11/2026 mostra que hoje o Lumi entrega a **base** do inventário, não o inventário no formato da norma (ver produto.md, seção 9). Fale em "base para o inventário" e "plano de ação".
- **PGR:** é parcial no Lumi. O Lumi entrega o diagnóstico e as evidências no formato que alimenta o programa; a emissão do documento final e o eSocial seguem com o SESMT ou consultoria de SST. Contra a Sólides, não dispute o PGR: dispute o diagnóstico contínuo, o app, as trilhas e o cuidado.
- O site convida a apontar informação desatualizada para suporte@applumi.io.

### 4.4 Argumento econômico (use com cuidado)
- Calculadora "O que custa não agir" do site, para 200 pessoas, salário médio R$ 4.000 e rotatividade 30%: presenteísmo (20% das pessoas perdendo 7,5 h/semana, 3,4% da folha) R$ 326.400; afastamentos (1,2% do time ao ano, 15 dias pagos) R$ 4.800; rotatividade evitável (50% do salário anual por saída, 15% atribuível ao bem-estar) R$ 216.000; **custo anual estimado R$ 547.200**. O site diz: "estimativa para orientar a conversa, não uma projeção de resultado".
- Referências externas citadas no site: Deloitte (2024), 4,7× de retorno para cada £1 investido em saúde mental no trabalho (média de 26 estudos); dados de afastamentos (prefira o número oficial da Previdência: 546.254 benefícios em 2025, +15,66%).
- **Não use** o trecho da calculadora sobre multa ("multa mínima exposta R$ 1.610,12 por trabalhador", "fiscalização já é punitiva"): as sanções psicossociais estão suspensas no STF desde 25/06/2026 e a regra comercial é não ameaçar com multa.
- Nunca prometa redução de afastamentos, turnover ou custo em número.

## 5. Processo de venda

### 5.1 Entrada de leads e SLA
- Todo lead entra pelo mesmo funil, é enriquecido pelo CNPJ (BrasilAPI) e recebe nota de perfil e de interesse.
- Meta de **primeiro contato: até 2 horas úteis** para lead quente. Hoje os leads do site vão para a diretora de negócios (Bruna) enquanto não houver time comercial.
- Origens: formulário do site (demo, contato, download, inscrição e presença em evento, visita à página de planos), eventos (ex.: NR-1 Estratégica), QR codes, WhatsApp, indicações, importação de listas.

### 5.2 Funil de vendas (7 etapas)
| Etapa | Critério para sair | Dono | Prazo de referência |
|---|---|---|---|
| 1. Qualificação | Dor confirmada (NR-1, afastamentos, turnover), decisor identificado, nº de vidas | SDR | 5 dias |
| 2. Diagnóstico | Reunião feita, situação atual do PGR registrada, critério de decisão anotado | Executivo | 10 dias |
| 3. Demo | Demo do app e do painel feita para o decisor e o RH | Executivo | 7 dias |
| 4. Piloto (opcional) | Escopo, área e meta de adesão definidos; resultado registrado | Executivo + CS | 30 a 45 dias |
| 5. Proposta | Proposta enviada com plano, vidas, valor e validade | Executivo | 7 dias |
| 6. Negociação | Jurídico e compras envolvidos; condições finais registradas | Executivo | 15 dias |
| 7. Ganha ou perdida | Contrato assinado, ou motivo de perda da lista fechada | Executivo | n/a |

- No CRM, para avançar o card, o sistema pede os critérios de saída: dor, decisor, situação do PGR, demo, vidas e valor, condições.
- **Motivos de perda (lista fechada):** preço, timing, concorrente, sem decisor, sem orçamento.
- **Piloto:** pode ter até 50% de desconto na implementação.
- Ao ganhar: o cliente é criado no admin do Lumi (empresa, plano, vidas) e a implantação vai para o CS (automático na fase 2 do CRM).

### 5.3 Perguntas de diagnóstico (descoberta)
Da abordagem Grou e dos critérios do funil:
- "Como vocês estão organizando a parte psicossocial da NR-1 hoje?"
- "Já fizeram o diagnóstico? Com qual ferramenta? Quem decide?"
- "Vocês já têm o inventário psicossocial no PGR? Quem faz o PGR: SESMT próprio ou consultoria?"
- "A pesquisa de clima de vocês mede os fatores de risco psicossocial por setor?"
- "Hoje o maior desafio é a NR-1 ou o cuidado com o time?"
- "Quanto do programa atual de apoio vocês conseguem medir?"
- "Como estão afastamentos e rotatividade nas áreas mais pressionadas?"
- "Quantas pessoas são, em quantas unidades? Quantas têm celular para usar o app?"
- "Quando fecham o orçamento do próximo ano?"

### 5.4 Demo de 30 minutos (estrutura sugerida a partir do site)
1. Contexto do cliente (2 a 3 perguntas da lista acima).
2. **Ciclo de cuidado:** diagnosticar → entender → agir → acompanhar.
3. **Painel:** diagnóstico NR-1 por setor e domínio (HSE), relatório da IA, planos de ação, pesquisas, clima emocional. Mostre que a empresa vê só agregados.
4. **App (se Premium fizer sentido):** check-in, trilhas, a Luz, agendamento de sessão.
5. **Divisão de responsabilidades:** o Lumi entrega a parte psicossocial; o SESMT ou a consultoria de SST fecha o PGR e o eSocial.
6. Próximo passo: proposta com plano e vidas, ou piloto num setor.
Não demonstre o que está na lista "não prometer" (produto.md, seção 9).

## 6. Objeções e respostas

Regra da abordagem: responda curto, devolva com uma pergunta e leve para a conversa de 30 minutos.

| Objeção | Resposta |
|---|---|
| "A NR-1 está suspensa, vamos esperar o STF." | O que está em discussão no STF são as punições; a exigência de mapear os riscos psicossociais vale desde 26/05/2026, e o STF registrou que as diretrizes da norma continuam válidas. Quem fizer o diagnóstico agora chega pronto a qualquer decisão. Vocês já têm o inventário psicossocial no PGR? (Diga a data: "conferido em 27/11/2026".) |
| "Acho que a NR-1 vai ser adiada." | A vigência já começou em 26/05/2026. A conciliação no STF e na AGU discute parâmetros e sanções; a tomada de subsídios da AGU vai até 02/12/2026. Ninguém sabe o desfecho, mas o diagnóstico serve para qualquer cenário e para cuidar do time. |
| "Já fazemos pesquisa de clima." | Ótimo, isso ajuda. A NR-1 pede outra coisa: medir os fatores de risco psicossocial por setor e ter plano de ação com evidências. O Lumi faz as duas coisas no mesmo painel. A pesquisa de vocês mede os sete domínios do HSE? |
| "Já temos psicólogo, convênio ou programa de apoio." | O Lumi não substitui o que funciona: dá o diagnóstico e o acompanhamento contínuo para a empresa e o primeiro apoio no dia a dia para o time. Quanto do programa atual vocês conseguem medir? |
| "Já temos plano de saúde." | Plano de saúde cuida de quem adoece; a NR-1 pede identificar e controlar as condições de trabalho que adoecem. São coisas diferentes e complementares. Como vocês enxergam hoje onde está o risco? |
| "As pessoas vão ter medo de responder." | Por construção, a empresa só vê dados agregados por grupo. Ninguém é identificado, e o check-in é da pessoa. Na implantação, ajudamos a explicar o anonimato antes de pedir respostas. |
| "Por que outro fornecedor, se já temos a Grou?" | O Lumi é do mesmo grupo da Grou e fala a mesma língua de método e dado. A Grou cuida de perfil e desenvolvimento; o Lumi, de saúde emocional e NR-1. |
| "Não temos orçamento agora." | O preço é por pessoa por mês e cai conforme o tamanho da empresa. Dá para começar pelo Starter ou por um setor piloto. Quando fecham o orçamento do próximo ano? |
| "Quanto custa?" | Depende do número de pessoas e do plano (Starter ou Premium). Na conversa eu monto o valor exato; o CRM calcula a proposta pela tabela e pelas regras de desconto. (Se insistirem: a página de planos mostra a calculadora pública.) |
| "Me manda um material por e-mail." | Mando, sim. Para mandar o que importa, me conta: hoje o maior desafio é a NR-1 ou o cuidado com o time? E já deixo uma sugestão de horário. |
| "O RH não tem tempo." | O time do Lumi acompanha a implantação: configuração do painel, comunicação ao time e orientação ao RH. As campanhas abrem sozinhas no prazo e o relatório sai pronto da IA. O que mais toma tempo do RH hoje nesse tema? |
| "App de bem-estar não funciona." | Concordo que app sozinho não resolve: a OMS e um estudo de Oxford com 46.336 trabalhadores mostram que ações individuais isoladas rendem pouco. Por isso o Lumi começa pelo diagnóstico da organização do trabalho e pelo plano de ação; o app é apoio complementar. O que vocês já tentaram? |
| "Só um questionário não basta para a NR-1?" | Não basta, e o MTE diz isso. O questionário é uma das fontes; os resultados precisam ser analisados e integrados ao inventário, com escuta, plano de ação e acompanhamento. O Lumi organiza o diagnóstico e o plano; o SESMT fecha o PGR. |
| "Vocês fazem o PGR / enviam ao eSocial?" | Não. O Lumi entrega a parte psicossocial (diagnóstico, base para o inventário, plano de ação e evidências). O documento final do PGR, a assinatura e o eSocial seguem com o SESMT ou a consultoria de SST de vocês. |
| "Já temos consultoria de SST." | Ótimo: é exatamente com ela que o Lumi trabalha. A consultoria fecha o PGR; o Lumi dá o diagnóstico psicossocial contínuo, o plano e o cuidado com o time. |
| "A Sólides (ou outra plataforma) já faz." | Cada uma é referência na sua frente. O diferencial do Lumi é juntar diagnóstico, pesquisas do próprio RH, IA que sugere o plano e o cuidado do colaborador (app, trilhas, Luz e sessões) num só produto. O que falta hoje na solução de vocês? |
| "O HSE é obrigatório?" | Não, a NR-1 não exige método específico. O HSE é um instrumento validado internacionalmente que o Lumi usa como núcleo; a empresa precisa mostrar que o método é fundamentado e coerente. |
| "Vocês garantem que não seremos multados?" | Ninguém pode garantir isso. O Lumi ajuda a ter método, dados, plano e registros, que é o que a fiscalização verifica. |
| "Vocês dão o selo da Lei 14.831?" | Não, e ninguém dá hoje: o certificado ainda depende de regulamento (o Ministério da Saúde criou um grupo técnico em março de 2026). As práticas que o Lumi apoia vão na direção das diretrizes da lei. |
| "A Luz substitui o psicólogo?" | Não. A Luz acolhe e orienta no dia a dia e indica o cuidado profissional quando é hora. No Premium, cada colaborador tem sessões com psicólogos com CRP ativo e coaches certificados. |
| "Quem não tem celular corporativo fica de fora." | Hoje a participação é pelo aplicativo no celular; quem não tem acesso ao app não responde. Para operação e campo, combine na implantação como incluir esse público e complemente com escuta e observação, métodos que o MTE também aceita. Participação por QR, totem ou WhatsApp ainda não existe (não prometer). |

## 7. Abordagem para clientes da Grou (resumo do documento de 27/11/2026)

### 7.1 Objetivo e premissas
- Marcar uma **conversa de 30 minutos** sobre NR-1 e saúde emocional com quem já confia na Grou, sem tratar essas pessoas como lead nem como público de marketing em massa.
- **Base:** 1.342 empresas clientes ativas da Grou e cerca de 9.400 contatos, no CRM do Lumi, em 13 listas "Clientes Grou · faixa de porte", origem "Prospecção – clientes Grou".
- **Por que funciona:** essas empresas já compram avaliação comportamental (PDA, DISC) e desenvolvimento da Grou. O Lumi é o passo seguinte do mesmo cuidado com pessoas, agora com a NR-1 por trás.
- **Quem assina:** a pessoa do comercial do Lumi, citando a Grou na primeira linha. Nas contas com CS ativo na Grou, o melhor é o CS apresentar o Lumi por e-mail e o comercial seguir. (Em aberto: quais contas têm CS disposto a apresentar.)
- **Tom:** mensagem individual, curta e consultiva, escrita para o cargo. Nada de newsletter, arte pronta ou disparo em lote.
- **LGPD:** os contatos entraram com "aceita marketing" desligado. A base é o **legítimo interesse** (LGPD, art. 7º, IX): só mensagens individuais e ligadas ao trabalho da pessoa, sempre com saída simples ("se não fizer sentido, me avise que não escrevo mais"). Quem pedir para sair é marcado como descadastrado no mesmo dia.

### 7.2 Ordem de ataque
| Grupo | Listas | Contatos | Para quem | Ordem |
|---|---|---|---|---|
| Médias e grandes | 201-500 · 501-2.000 · 2.001-5.000 | 2.919 | RH, SESMT, gestão de pessoas | 1º |
| Grandes contas | 5.001-10.000 · 10.001-20.000 · acima de 20.001 | 2.397 | Diretoria de pessoas, saúde ocupacional, benefícios | 2º (contas nomeadas, um contato por vez) |
| Pequenas e médias | 21-50 · 51-100 · 101-200 | 900 | Dono, sócio ou RH generalista | 3º |
| Micro | 01 · 02-10 · 11-20 | 132 | Dono ou sócio | 4º (só e-mail) |
| A qualificar | Porte não informado | 3.077 | Quem estiver no cadastro | Antes, descobrir o porte (CNPJ ou LinkedIn) |

Nas grandes contas, um contato por empresa (o de cargo mais alto em pessoas) e só depois os demais. Escrever para cinco pessoas da mesma empresa no mesmo dia queima a conta.

### 7.3 Cadência de 14 dias (até 6 toques)
| Dia | Canal | O que fazer |
|---|---|---|
| 0 | E-mail pelo CRM | Primeiro contato citando a Grou e a NR-1 (assunto: "[Empresa] + Grou: um passo além na NR-1") |
| 2 | LinkedIn | Convite com nota curta (até 300 caracteres), sem link |
| 5 | WhatsApp | Só para quem já falava com a Grou por WhatsApp; uma mensagem, sem áudio |
| 7 | E-mail no mesmo fio | Conteúdo útil (post do blog) + convite para 30 minutos |
| 10 | Ligação | 2 tentativas em horários diferentes, até 2 minutos; sem recado longo |
| 14 | E-mail | Encerramento educado, porta aberta |

Roteiro da ligação: (1) "Oi, [Nome], aqui é [seu nome], do Lumi, do mesmo grupo da Grou. Tem um minuto?" (2) "Te escrevi sobre a parte psicossocial da NR-1. Como vocês estão organizando isso hoje?" (3) Escutar e anotar: já fizeram o diagnóstico? Com qual ferramenta? Quem decide? (4) "Posso te mostrar em 30 minutos como o Lumi faz o diagnóstico e o plano. Quinta ou sexta fica melhor?" (5) Sem interesse: agradecer, perguntar se pode voltar a falar em 90 dias, registrar o motivo.

**Regras de parada:** respondeu (qualquer resposta) → sai da cadência e vira conversa; pediu para não receber → descadastrar no mesmo dia e não escrever por nenhum canal; saiu da empresa ou e-mail voltou → corrigir e tentar a próxima pessoa da conta; sem resposta no dia 14 → volta para "Prospecção" e só é retomada depois de 90 dias, com outro ângulo.

**Ritmo seguro:** até 40 primeiros e-mails por dia por pessoa do comercial, sempre individuais (mais que isso aumenta o risco de spam no domínio).

### 7.4 O que não dizer (abordagem Grou)
- Promessa clínica (o Lumi não cura, não trata, não diagnostica).
- "Vi no sistema da Grou que vocês têm X pessoas" ou qualquer dado interno do relacionamento com a Grou.
- Ameaça de multa ou prazo de fiscalização inventado.
- Número, caso ou depoimento que não esteja publicado pelo Lumi.
- "A Lumi" ou "da Lumi".

### 7.5 Como operar no CRM
1. Em **Funil**, "+ Novo funil": "Prospecção · clientes Grou" com as etapas A abordar · Em cadência · Respondeu · Reunião marcada · Sem interesse.
2. Toda segunda, em **Contatos**, filtrar a lista da semana, marcar até 200 pessoas e usar **Colocar num funil**.
3. No card, o bloco **Abordagem sugerida** mostra o passo do dia com texto pronto (e-mail: "Revisar e enviar"; WhatsApp: "Abrir no WhatsApp"; LinkedIn: "Copiar nota"). Cada passo feito entra na linha do tempo.
4. Registrar cada toque como atividade e mover o card.
5. Reunião marcada: **Mover para outro funil** → "Vendas Lumi"; a empresa vira "Em negociação". Com a integração do Sales Coach, a análise da reunião cai no negócio.
6. Sem interesse ou pedido para sair: mover para "Sem interesse" e anotar o motivo. (Em aberto: para contatos, ainda falta um botão "Não contatar".)

**Metas semanais sugeridas por pessoa (ajustar após 2 semanas):** 200 contatos em cadência · 20 respostas (10%) · 6 reuniões (3%) · 2 propostas. Os percentuais são ponto de partida, não histórico.

### 7.6 Modelos de mensagem (troque o que está entre colchetes e ajuste uma frase ao cargo e ao setor)
Mensagem que parece em lote é ignorada. O assistente pode escrever rascunhos a partir destes modelos; o envio é sempre pela pessoa, pelo CRM.

**E-mail 1 · dia 0 · primeiro contato**
Assunto: [Empresa] + Grou: um passo além na NR-1
> Oi, [Nome], tudo bem?
> Sou [seu nome], do Lumi, a plataforma de saúde emocional do mesmo grupo da Grou, que já trabalha com a [Empresa].
> Desde maio, a NR-1 pede que as empresas mapeiem e gerenciem os riscos psicossociais no PGR. O Lumi faz esse diagnóstico por setor, sem identificar ninguém, monta o plano de ação com as evidências e ainda dá ao time apoio no dia a dia pelo aplicativo.
> Faz sentido conversarmos 30 minutos para eu mostrar como ficaria para a [Empresa]?
> Se não for com você, me diz quem cuida disso por aí. E se preferir não receber mais mensagens minhas, é só responder "não".
> [Assinatura]

**E-mail 2 · dia 7 · no mesmo fio**
> Oi, [Nome], voltando aqui com uma coisa útil, mesmo que a gente não converse agora: escrevemos um guia sobre [tema do post, ex.: o retorno ao trabalho após afastamento por saúde mental]: [link do post em applumi.io/blog].
> Se a NR-1 estiver na pauta da [Empresa] neste semestre, posso te mostrar em 30 minutos como o Lumi organiza o diagnóstico e o plano. Que dia fica melhor?

**E-mail 3 · dia 14 · encerramento**
> Oi, [Nome], não quero encher sua caixa, então este é meu último e-mail por enquanto.
> Se em algum momento a saúde emocional do time ou a NR-1 virarem prioridade, é só responder esta mensagem que eu retomo. Obrigado pela atenção e um abraço para o time da [Empresa].

**LinkedIn 1 · dia 2 · nota do convite (até 300 caracteres)**
> Oi, [Nome]! Sou do Lumi, do mesmo grupo da Grou, que já trabalha com a [Empresa]. Cuido de saúde emocional e NR-1 em empresas e gostaria de te ter na rede.

**LinkedIn 2 · depois que aceitar**
> Obrigado por aceitar, [Nome]! Te mandei um e-mail sobre como o Lumi apoia a NR-1 na [Empresa]. Se preferir conversar por aqui, fico à disposição.

**WhatsApp 1 · dia 5 · só se a pessoa já falava com a Grou por WhatsApp**
> Oi, [Nome], aqui é [seu nome], do Lumi (mesmo grupo da Grou). Te mandei um e-mail sobre NR-1 e saúde emocional do time. Posso te mostrar em 30 minutos como funciona? Se não fizer sentido, é só me avisar que não volto a escrever.

Observação: o texto "desde maio, a NR-1 pede…" é correto (vigência em 26/05/2026). Se o contato for retomado em 2027, troque por "desde maio de 2026".

### 7.7 Qual post do blog mandar para cada dor (passo do dia 7)
| Dor ou pergunta do cliente | Post |
|---|---|
| "Por onde começo a NR-1?" / "o que vai no PGR?" | applumi.io/blog/pgr-riscos-psicossociais/ |
| "Como montar o inventário?" | applumi.io/blog/inventario-de-riscos-psicossociais/ |
| "O que pôr no plano de ação?" | applumi.io/blog/plano-de-acao-riscos-psicossociais/ |
| "E se o fiscal vier?" / "está suspenso?" | applumi.io/blog/fiscalizacao-nr-1-riscos-psicossociais/ |
| Empresa pequena (ME/EPP) | applumi.io/blog/aep-nr-17-riscos-psicossociais/ |
| "Já fizemos a pesquisa, e agora?" | applumi.io/blog/comunicar-diagnostico-psicossocial/ |
| "Que questionário usar?" | applumi.io/blog/questionario-de-riscos-psicossociais/ e /copsoq-questionarios-validados/ |
| Afastamentos altos | applumi.io/blog/afastamentos-por-saude-mental/ e /retorno-ao-trabalho-apos-afastamento/ |
| Times sobrecarregados, horas extras | applumi.io/blog/sobrecarga-de-trabalho/ e /burnout-no-trabalho/ |
| Times remotos ou híbridos | applumi.io/blog/trabalho-remoto-riscos-psicossociais/ |
| Denúncias, CIPA, assédio | applumi.io/blog/assedio-moral-no-trabalho/ |
| Cultura, liderança, erros escondidos | applumi.io/blog/seguranca-psicologica/ |
| "Que números acompanhar?" | applumi.io/blog/indicadores-de-saude-emocional/ |
| "Já temos programa de bem-estar" / "app não funciona" | applumi.io/blog/programa-de-bem-estar-corporativo/ e /saude-mental-no-trabalho-oms-oit/ |
| Comparando fornecedores de terapia online | applumi.io/blog/terapia-online-como-beneficio/ e /telepsicologia-para-empresas/ |
| "Queremos o selo da Lei 14.831" | applumi.io/blog/lei-14831-empresa-promotora-da-saude-mental/ |
| Campanha de janeiro | applumi.io/blog/janeiro-branco-nas-empresas/ |

### 7.8 Como montar a proposta no CRM
1. Na oportunidade, abra o **gerador de propostas**: escolha o plano (Starter ou Premium) e o número de vidas. O CRM aplica a tabela do site e o piso entre faixas.
2. Se houver desconto, informe o percentual no mensal (até 20%) e, se for o caso, na implementação (até 50%, pilotos e contratos de 24 meses).
3. Desconto acima de 10% ou mais de 5.000 vidas: a proposta vai para **aprovação de uma sócia** antes do envio.
4. Envie o **link público da proposta**, que tem aceite pelo cliente.
5. Para avançar o card de etapa, preencha os critérios de saída (dor, decisor, situação do PGR, demo, vidas e valor, condições).

## 8. Treino e roleplay

### 8.1 Personas do CRM (o assistente interpreta) e o que a pessoa de vendas deve fazer

**A. Gerente de RH de uma indústria de 300 pessoas, cliente da Grou (usa PDA), sem diagnóstico psicossocial e com pouco orçamento**
- Preocupações prováveis: orçamento, tempo do RH, anonimato, "o que muda em relação à Grou".
- Tabela: Starter R$ 1.770,00/mês (R$ 5,90 × 300), implementação R$ 1.500, primeiro ano R$ 22.740,00. Premium R$ 6.570,00/mês, primeiro ano R$ 80.340,00. Com 10% sem aprovação: Starter R$ 1.593,00/mês.
- Bom caminho: ponte Grou → Lumi; mostrar que a obrigação vale desde 26/05/2026 sem ameaçar multa; propor Starter ou setor piloto; perguntar data do orçamento; marcar os 30 minutos.

**B. Diretora de pessoas de uma rede de varejo com 4.000 funcionários, já faz pesquisa de clima e acha que a NR-1 vai ser adiada**
- Preocupações prováveis: "esperar o STF", duplicar pesquisa, escala, adesão de lojas.
- Tabela: Starter R$ 11.700,00/mês (piso entre faixas: 4.000 × R$ 2,90 = R$ 11.600,00, abaixo do teto da faixa anterior), implementação R$ 3.500, primeiro ano R$ 143.900,00. Premium R$ 55.600,00/mês, primeiro ano R$ 670.700,00.
- Bom caminho: separar sanção de obrigação (com data); diferenciar clima de fatores de risco por setor; mostrar pesquisas do próprio RH no mesmo painel; propor piloto em uma regional; não prometer participação por QR/totem (não existe).

**C. Dono de empresa de tecnologia com 45 pessoas, cético com "app de bem-estar" e preocupado com custo**
- Preocupações prováveis: utilidade real, custo, tempo.
- Tabela: Starter R$ 445,50/mês, implementação R$ 900, primeiro ano R$ 6.246,00. Premium R$ 1.345,50/mês, primeiro ano R$ 17.046,00.
- Bom caminho: concordar que app sozinho não resolve (OMS, estudo de Oxford); posicionar diagnóstico + plano; NR-1 vale também para empresa pequena (trabalho remoto também entra); Starter como entrada.

**D. Técnico de segurança do trabalho (SESMT) de uma construtora com 900 pessoas, focado em PGR e evidências**
- Preocupações prováveis: inventário no formato da norma, critérios de severidade × probabilidade, evidências, quem assina, trabalhadores de obra sem app.
- Tabela: Starter R$ 4.410,00/mês, implementação R$ 1.900, primeiro ano R$ 54.820,00. Premium R$ 17.010,00/mês, primeiro ano R$ 206.020,00.
- Ponto técnico que ele pode trazer: na construção, pela NR-18 (18.4.4), a contratada fornece à contratante o inventário dos riscos de suas atividades, incluindo os psicossociais, para o PGR do canteiro (MTE, pergunta 4; ver nr1.md, seção 14).
- Bom caminho: falar a língua dele (GRO, AEP, 1.5.7.3.2); ser honesto: o Lumi dá a base psicossocial e o SESMT fecha o PGR; não prometer inventário pronto, matriz de risco, dossiê nem participação por QR/totem (roadmap); propor diagnóstico como uma das fontes, combinado com escuta e observação.

### 8.2 Critérios de feedback no roleplay
- Abriu com contexto e pergunta, não com pitch.
- Fez perguntas de descoberta (situação do PGR, ferramenta atual, decisor, vidas, orçamento).
- Separou sanção (suspensa no STF) de obrigação (vigente), com data.
- Falou "o Lumi" no masculino; "a Luz" para a assistente.
- Não fez promessa clínica, não ameaçou com multa, não citou cliente ou número inventado.
- Não prometeu nada da lista "não prometer" (produto.md, seção 9).
- Tratou preço pela regra (faixa, piso, desconto até 10% sem aprovação) e levou para a proposta do CRM.
- Fechou com próximo passo concreto (30 minutos com data, demo para decisor e RH, piloto).

### 8.3 Perguntas de fixação para o modo treino
1. Desde quando a NR-1 inclui expressamente os fatores psicossociais? (26/05/2026, Portaria MTE 765/2025 prorrogou a nova redação da Portaria 1.419/2024.)
2. O que está suspenso no STF e o que continua valendo? (Sanções suspensas na ADPF 1316; diretrizes da norma válidas.)
3. Quais os três documentos obrigatórios do GRO? (Inventário, plano de ação, documento de critérios.)
4. O questionário é obrigatório? Basta sozinho? (Não e não.)
5. Quem assina o PGR? (A organização designa responsáveis; o Lumi não assina nem emite PGR.)
6. Quanto custa o Premium para 200 pessoas? (R$ 25,90 × 200 = R$ 5.180,00/mês; implementação R$ 1.200; primeiro ano R$ 63.360,00.)
7. Quanto paga uma empresa de 55 pessoas no Starter? (Piso: R$ 495,00/mês, não R$ 434,50.)
8. Até quanto de desconto você dá sem aprovação? E com aprovação? (10%; até 20% com sócia; acima disso, não.)
9. O que o Starter não inclui? (App, trilhas, Emociômetro, Luz e sessões.)
10. Cite três coisas que o Lumi ainda não faz. (Inventário no formato da norma, dossiê de fiscalização, devolutiva no app, vínculo plano ↔ risco, análise de afastamentos, participação por QR/totem.)

## Fontes
- Tabela e regras: /home/user/lumi-crm/shared/precos.ts e /home/user/lumi-crm/README.md (limiares do piso calculados com a mesma fórmula).
- Página de planos, comparativo e calculadora de retorno do site: /home/user/lumi-pathway-ignite/index.html.
- "Abordagem Lumi para clientes Grou" (Claude Docs, 27/11/2026): https://claude.ai/artifact/9QQGng3xmWGBt4poktPwdf (e o arquivo /home/user/lumi-crm/shared/abordagens.ts, que implementa os mesmos textos).
- "Lumi CRM: especificação do ecossistema comercial e de relacionamento" (28/10/2026): https://claude.ai/artifact/A47eviTZRbWo1jh93tt7Da
- "Lumi × NR-1: o que a norma pede e o que falta no produto" (13/11/2026): https://claude.ai/artifact/E1i8Zo3doDEG9xbnVLhsMT
- Estratégia editorial do blog: /home/user/lumi-pathway-ignite/conteudo-blog/estrategia.md
- Personas de roleplay: /home/user/lumi-crm/src/components/Assistente.tsx
- Posts do blog citados em argumentos (programa de bem-estar, diretrizes da OMS, fiscalização, Lei 14.831): ver blog.md.
- Situação no STF/AGU: ver nr1.md (conferido em 27/11/2026).
