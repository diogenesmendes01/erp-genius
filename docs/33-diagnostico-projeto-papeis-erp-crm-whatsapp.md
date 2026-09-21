# Diagnóstico do ERP Genius — 07/09/2026

Base analisada: commit **bc858af**, código, schema, migrations, testes e documentação disponíveis neste checkout.

> Atualização: a [auditoria profunda posterior](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/34-auditoria-profunda-documentacao-vs-codigo.md) instalou dependências, executou os testes e reproduziu falhas com PostgreSQL e login real. As limitações de execução descritas abaixo registram apenas a primeira análise; consultar o doc 34 para as evidências atuais.

**Conclusão:** há uma base funcional de gestão comercial, matrícula e contas a receber, com infraestrutura de WhatsApp relativamente desenvolvida. Ainda falta fechar o controle de acesso de ponta a ponta e construir o acompanhamento acadêmico e o pós-venda para sustentar uma escola de idiomas.

## Escopo e grau de certeza

- Análise estática dos principais domínios, rotas, ações, consultas, modelos e testes. Não é uma homologação de produção nem uma inspeção visual das telas.
- “Implementado” significa que há código executável para a função; não significa validado em operação real.
- Falhas confirmadas abaixo são caminhos identificáveis no código. Os cenários descritos devem virar testes de regressão antes da correção ser considerada concluída.
- Foi tentado `npm test -- --reporter=dot`. A execução parou porque `vitest` não está disponível: este checkout não tem `node_modules`. Não houve execução de testes, build, integrações externas nem acesso ao banco de produção.
- Foram localizados **48 arquivos de teste**, entre unitários e integração; isso não é contagem de testes aprovados.
- A análise não altera regras do sistema. A única entrega adicionada é este relatório.

## Parte 1 — O que existe, mas ainda está incompleto

### 1.1 Inventário de maturidade

| Área | Implementado no código | O que impede considerar completo |
|---|---|---|
| Acesso | Login, sete papéis acumuláveis, releitura do usuário no banco, navegação por papel, guards de ações/páginas | Inconsistências de escopo, exposição de campos e alçadas entre caminhos |
| Configuração | Países, moedas, documentos, idiomas, modalidades, níveis, produtos, preços, turmas e usuários | Regras fragmentadas e divergências entre documentação, formulários e servidor |
| CRM | Leads, funil, responsáveis comerciais, notas, histórico, perdas, experimental, proposta, conversão | Distribuição por capacidade, SLA medido por eventos reais, tarefas completas, pós-venda e renovação |
| Matrícula | Cadastro, responsável financeiro/emergência, preço de referência, taxa, mensalidade, ativação, comissão | Alçadas de preço/comissão na criação; reutilizar aluno existente; contrato e entrega ao acadêmico |
| Alunos | Cadastro detalhado, importação, ficha, turma, pausa, reativação, encerramento e movimentações | Diário de aula, frequência, avaliações, progressão, certificados e jornada de retenção |
| Financeiro | Cobranças, baixas parciais, ajustes, aprovações, comissões, câmbio e régua | Indicadores corretos para pagamentos parciais; registro financeiro estruturado por recebimento; despesas, conciliação e integrações |
| WhatsApp | Meta Cloud/Evolution, webhooks, inbox, texto/mídia, contatos, fila, templates, opt-out, health, shadow e cadências | Segurança das cadências adiadas, distribuição por conversa, preferências integradas e validação operacional |
| Operação técnica | Next.js, Prisma/Postgres, eventos transacionais em diversos fluxos, Docker/Caddy, migrações e script de backup | Evidência de restauração, monitoramento e homologação; testes de interface e concorrência nos pontos críticos |

O README ainda anuncia a próxima etapa como automações, embora elas já existam. O schema também contém comentários antigos sobre ativação por contrato + taxa + primeira mensalidade; a implementação atual exige cobertura da taxa na ativação e agenda a mensalidade. Essa diferença afeta treinamento, testes e futuras implementações.

Referências: [README](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/README.md), [schema de matrícula](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/schema.ts:95), [modelo de matrícula](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/schema.prisma:562), [plano atual de piloto](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/32-comercial-c1-c2-piloto-baileys.md).

### 1.2 Papéis e visibilidade: o que já está correto

A arquitetura reconhece duas dimensões úteis: **função** e **propriedade do registro**. Usuários podem acumular papéis; o administrador tem acesso amplo.

Pontos positivos:

- Páginas e ações podem buscar papéis atualizados no banco, invalidando acesso de usuários desativados.
- Leads normalmente são filtrados pelo vendedor dono; professores normalmente recebem apenas alunos de suas turmas.
- A ficha financeira filtra matrículas ligadas ao vendedor, evitando mostrar contratos de outros vendedores do mesmo aluno.
- Arquivos privados têm autorização por objeto, em vez de depender apenas de esconder o link.
- A inbox possui escopo por número e algumas projeções específicas para dados comerciais e financeiros.
- Há testes de escopo, papéis e revogação, embora não cubram todos os caminhos abaixo.

Referências: [sessão](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/_shared/sessao.ts), [arquivos](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/uploads/autorizacao.ts), [ficha financeira](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/consultas.ts), [escopo da inbox](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/escopo.ts).

### 1.3 Falhas confirmadas com maior prioridade

Prioridade **P1** aqui significa corrigir antes de ampliar o uso por equipes; não significa que houve exploração ou vazamento em produção.

| ID | Prioridade | Achado e cenário | Correção/aceite |
|---|---|---|---|
| AC-01 | P1 | A lista de alunos calcula e entrega `financeiro` para todos, inclusive professor. A tela mostra “Em atraso/Em dia”; valores em aberto também vão ao cliente. A proteção da ficha não se aplica à lista. | Projeção pedagógica também na listagem. Professor sem papel financeiro não recebe status, saldos nem vencimentos na resposta. |
| AC-02 | P1 | `ajustarCobranca` aceita vendedor e carrega cobrança apenas por ID, sem conferir vínculo com sua carteira. Quem conhecer o ID de cobrança alheia pode tentar alterar o valor dentro da alçada ou criar pedido sobre ela. | Autorizar a cobrança/matrícula alvo antes de qualquer leitura sensível ou alteração. Testar chamada direta com ID de terceiro, sem gravação de ajuste/evento/aprovação. |
| AC-03 | P1 | Criação de matrícula aceita taxa e mensalidade negociadas sem aplicar `limiteDescontoPct`. Também aceita `comissaoPct` do pedido, de 0 a 100, e persiste esse percentual. O vendedor pode contornar a alçada usada nos ajustes e definir a própria comissão. | Preço negociado deve passar pela mesma alçada; comissão deve ser resolvida de política autorizada no servidor. Testar payload adulterado, mesmo que a interface limite os campos. |
| AC-04 | P1 | `/leads`, `/pipeline` e a ficha de lead exigem sessão, mas não papel comercial. As consultas aceitam o dono pelo ID mesmo se ele perdeu o papel VENDEDOR. Um ex-vendedor ainda ativo, com leads atribuídos, pode continuar lendo sua carteira por URL. | Guard comercial nas páginas e consultas que neguem acesso sem papel válido. Testar revogação mantendo a propriedade anterior. |
| AC-05 | P1 | `buscarVinculosInbox` exige só sessão; a busca retorna nomes/IDs de alunos e responsáveis globalmente. Um usuário autenticado fora da inbox pode chamar a ação, e o vendedor não fica restrito à carteira nessas duas categorias. | Exigir capacidade da inbox e escopo dos objetos pesquisados. Busca de professor sem acesso à inbox deve falhar; vendedor deve receber apenas vínculos autorizados. |

Evidências:

- AC-01: [consulta da lista](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/consultas.ts:101), [tela da lista](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/alunos/AlunosLista.tsx).
- AC-02: [carregamento por ID](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts:170), [ação de ajuste](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts:192).
- AC-03: [valores aceitos](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/schema.ts:78), [cobranças e comissão](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:273).
- AC-04: [leads](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/leads/page.tsx:8), [pipeline](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/pipeline/page.tsx:7), [ficha](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/leads/[id]/page.tsx:10), [escopo](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/consultas.ts:176).
- AC-05: [ação de busca](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/acoes.ts:350), [consulta](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/consultas.ts:406).

### 1.4 Inconsistências adicionais de acesso e governança

**Professor recebe cadastro excessivo.** A ficha envia documento, endereço, contatos e observações livres ao componente cliente, mesmo para professor. Também envia opções de outras turmas, embora ele não possa movimentar aluno. A projeção deve ser uma lista explícita de campos pedagógicos permitidos. Isso é uma recomendação de minimização; o conjunto final de dados necessário ao professor depende da rotina da escola. [Ficha do aluno](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/alunos/[id]/page.tsx:31).

**Pedagógico, financeiro e comercial estão misturados.** O gerente pedagógico recebe resumo financeiro na ficha geral, mas a rota da ficha financeira o bloqueia. O gerente comercial vê o painel financeiro global; a secretaria registra pagamentos, mas não acessa esse painel. Algumas dessas permissões podem ser desejadas, porém precisam ser deliberadas e coerentes, com acesso ao trabalho correspondente. [Ficha geral](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/consultas.ts:8), [rota financeira](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/alunos/[id]/financeiro/page.tsx:17), [painel global](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/financeiro/page.tsx).

**Transferir turma permite decidir avanço.** A secretaria pode executar `trocarTurma`; o servidor confere destino e vaga, mas não exige aprovação pedagógica para mudança de nível/idioma. A justificativa é opcional no schema. O texto da interface não constitui bloqueio. Separar transferência equivalente de exceção acadêmica. [Ação](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/acoes.ts:265), [schema](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/schema.ts:31).

**Aprovação e múltiplos papéis.** Quem acumula VENDEDOR e GERENTE_COMERCIAL pode solicitar um desconto e decidir a própria solicitação: não há comparação entre solicitante e aprovador. O Financeiro aplica descontos sem limite, enquanto a documentação descreve limites por usuário. Definir se isso é a política desejada; recomendar separação entre solicitar e aprovar, com exceção administrativa explícita. [Ajustes/aprovações](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts:214).

**Desativação sem passagem de carteira.** A gestão permite desativar usuário, mas não obriga a transferir leads, números, aulas experimentais ou turmas. Atribuir dono de lead valida existência do usuário, sem exigir papel VENDEDOR ativo. A edição de papéis também não protege explicitamente a permanência de um último administrador ativo. [Usuários](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/acesso/acoes.ts), [atribuição](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/acoes.ts:748).

**Filtros podem sobrescrever escopo.** `listarLeads` aplica `filtros.vendedorId` depois do filtro obrigatório do usuário. As páginas atuais inspecionadas não passam esse filtro, portanto não classifiquei isso como exposição atual pela interface. É uma falha latente: um novo filtro de tela poderia permitir consultar outro vendedor. Usar interseção (`AND`) entre escopo obrigatório e filtros opcionais. [Consulta](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/consultas.ts:191).

**Chamadas internas permissivas.** Algumas consultas de alunos/financeiro aceitam usuário opcional e interpretam ausência como acesso global. Isso facilita um futuro esquecimento. Separar consultas internas privilegiadas das consultas usadas por requisições.

**Dono do lead não é dono da conversa.** Transferir lead não transfere o número WhatsApp nem altera quem lê suas mensagens. O antigo dono do número pode continuar vendo o histórico, mesmo que o painel de dados do lead fique oculto. É o modelo atual deliberado; falta um fluxo de transferência compatível com ele. [Escopo](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/escopo.ts), [atribuição](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/acoes.ts:748).

**Vínculo de responsável não distingue finalidade na cobrança contextual.** A busca de cobrança da thread usa todos os vínculos do responsável, sem filtrar `papel: FINANCEIRO`. Um contato de emergência/pedagógico pode fazer surgir cobrança contextual de aluno pelo qual não paga. A decisão financeira deve seguir o vínculo correto. [Consulta](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/consultas.ts:360).

### 1.5 Matriz proposta para a próxima versão

Esta tabela é **proposta de produto**, não descrição exata das permissões atuais. Manter os sete papéis inicialmente e implementar capacidades reutilizáveis antes de construir um editor genérico de permissões.

| Papel | Escopo principal | Pode executar | Limites recomendados |
|---|---|---|---|
| Administrador | Operação inteira | Configuração, concessão de acesso, exceções e auditoria | Exceções identificadas; proteção do último administrador |
| Gerente comercial | Equipe, leads, propostas e resultados comerciais | Distribuir carteira, aprovar negociação, configurar cadências comerciais | Recebimentos, despesas e alterações acadêmicas exigem capacidade adicional |
| Vendedor | Leads/oportunidades atribuídos e contexto de suas matrículas | Atender, qualificar, agendar, propor e solicitar matrícula/desconto | Sem ajustar terceiro; sem definir própria comissão; financeiro mínimo para fechar venda |
| Gerente pedagógico | Turmas e vida acadêmica global | Currículo, professores, nivelamento e exceções de progressão | Resumo operacional de acesso quando necessário; valores financeiros por permissão explícita |
| Professor | Turmas atribuídas e experimentais atribuídas | Aula, presença, avaliação e observação pedagógica | Sem documentos cadastrais desnecessários, cobrança ou carteira comercial |
| Financeiro | Recebíveis, recebimentos, ajustes e futuras despesas | Baixar, conciliar, cobrar, apurar comissão | Desconto/perdão conforme alçada definida; não editar currículo |
| Secretaria acadêmica | Cadastro, documentação, matrícula e alocação | Conferir documentação, executar alocação aprovada, gerir agenda | Receber pagamento apenas se autorizado; não aprovar avanço de nível |
| Aluno/responsável — futuro | Próprios dados/vínculos | Agenda, materiais, resultados, solicitações e cobranças pertinentes | Responsável pedagógico, financeiro e emergência com acessos distintos |

Autorização deve responder a cinco perguntas: **quem**, **qual ação**, **qual registro**, **quais campos** e **em qual estado do processo**. Acumular papéis não deve eliminar regras como “não aprovar a própria solicitação”.

Implementação sugerida: funções centrais de capacidade, escopo e projeção usadas por páginas, Server Actions, buscas, arquivos e futuros relatórios. Para os próximos testes, usar dois vendedores, dois professores, alunos em turmas distintas, múltiplos papéis, papel revogado, usuário desativado e responsável apenas de emergência.

## Parte 2 — Adequação a ERP + CRM + WhatsApp para uma escola de idiomas

### 2.1 Jornada que o produto precisa fechar

**Interessado → atendimento → nivelamento/experimental → proposta → matrícula e pagamento → início das aulas → aprendizagem → renovação/progressão → retenção ou encerramento.**

Hoje há mais implementação na aquisição, matrícula e cobrança. A gestão da aprendizagem e do relacionamento depois da venda é a principal área ainda ausente.

### 2.2 ERP educacional

**A base aproveitável:** catálogo por idioma/modalidade/país, preços por moeda, alunos/responsáveis, turmas com dias/horários, mensalidades e eventos. Isso atende particularidades de uma escola online que pode ter alunos em diferentes mercados.

**Lacunas concretas:**

1. **Não existe diário acadêmico estruturado.** O schema não possui entidades próprias para aula realizada, presença, avaliação, resultado por habilidade, certificado ou progressão. Check-in de experimental é comercial e não substitui chamada das aulas regulares.
2. **Agenda incompleta para online.** Turma tem dias e horários, mas não tem fuso próprio nem link estruturado de sala virtual. Fuso do aluno/país não resolve sozinho o horário de referência da turma, exceções e reagendamentos.
3. **Renovação ainda não fecha o ciclo.** O fluxo atual de criação de matrícula cria um novo Aluno. Falta selecionar pessoa/aluno existente e abrir nova matrícula mantendo histórico, responsáveis e conversas.
4. **Só uma turma ativa por aluno.** Há índice único parcial que impõe essa regra. Isso limita inglês + espanhol simultâneos, regular + conversação ou reposição em outra turma. Evoluir para alocação vinculada à matrícula/curso e regras de participação, preservando o histórico.
5. **Indicadores financeiros não acompanham baixas parciais corretamente.** KPIs de aberto/atraso somam valor negociado; “recebido no mês” seleciona cobranças quitadas e usa o total acumulado. Exemplo: mensalidade de 100 com 40 pagos pode continuar contando 100 em aberto; se os 60 restantes forem pagos no mês seguinte, os 100 podem aparecer no mês da quitação.
6. **ERP financeiro ainda centrado em receber.** Não há modelos próprios de despesas, fornecedores, contas a pagar, conciliação ou resultado por turma. O evento guarda histórico de baixa, mas não existe uma entidade dedicada para cada recebimento com suas alocações.
7. **Concorrência merece testes específicos.** A baixa calcula o acumulado antes da transação; duas baixas simultâneas podem disputar o mesmo saldo. A verificação de vaga também precisa proteção contra matrículas/transferências simultâneas.
8. **Bloqueio acadêmico é decisão registrada.** `acessoBloqueado` existe, mas não corresponde a integração que bloqueie entrada em sala virtual. Definir a política operacional e como aluno/professor/secretaria veem a decisão.
9. **B2B é inicial.** Flag no lead e pagador “empresa” não substituem empresa contratante, colaboradores, contrato corporativo, fatura agregada e relatório do RH.
10. **Professor ainda não tem gestão de trabalho.** Faltam disponibilidade, conflito de agenda, substituições e apuração por aula/hora para pagamento.

Referências: [modelo acadêmico](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/schema.prisma:219), [regra de turma única](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/migrations/20260622120000_integridade_alocacao_preco/migration.sql:4), [novo aluno em matrícula](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:141), [KPIs](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/financeiro/consultas.ts:33), [baixas](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/financeiro/acoes.ts:33), [ficha financeira](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/consultas.ts:104).

Para idiomas, recomendo avaliação por habilidade e evidências de aprendizagem, com níveis e critérios configuráveis. O CEFR pode orientar currículo e avaliação; seu Companion Volume também contempla interação online e mediação. A adoção dessa estrutura é uma proposta para a escola, não uma exigência do sistema. [Conselho da Europa](https://www.coe.int/en/web/common-european-framework-reference-languages/home).

### 2.3 CRM educacional

**Já existe uma boa base de execução comercial:** funil, responsável, qualificação, temperatura, notas, perdas e experimental.

O próximo ganho é transformar essa base em acompanhamento da decisão do interessado:

- Disponibilidade do aluno × idioma × nível × professor × turma/vaga.
- Próxima ação com responsável, prazo, conclusão e histórico; hoje há campos de próxima ação/data, mas não uma estrutura completa de tarefas.
- Distribuição por disponibilidade/capacidade do vendedor, fila sem dono e cobertura de férias/ausência.
- SLA de primeira resposta humana baseado em mensagem/evento, com horário de atendimento. Hoje o percentual da Home do vendedor usa proporção de leads fora de NOVO, não tempo real de resposta.
- Agendamento/reagendamento da experimental, confirmação, resultado pedagógico e encaminhamento comercial.
- Renovação, desistência, trancamento, reativação e indicação.
- Oportunidades distintas para a mesma pessoa: novo idioma, novo nível, curso adicional e renovação. Um único lead com uma matrícula não deve representar toda a vida do cliente.
- Conversão por período/coorte, origem, vendedor e produto; a conversão global acumulada é pouco útil para comparar campanhas recentes.
- Transferência comercial → secretaria → professor com pendências e responsável, sem depender de mensagens informais.

Referências: [Home e métricas](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/home/consultas.ts), [Lead](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/schema.prisma:455), [ações comerciais](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/acoes.ts).

### 2.4 WhatsApp como canal integrado

A base técnica já inclui elementos importantes: fila persistida, estados de intenção, deduplicação, despacho centralizado, shadow, templates, mídia e controles de envio. Não deve ser tratada como “módulo ainda inexistente”.

Porém, há pendências verificáveis que impedem considerar as cadências comerciais prontas para expansão:

| Pendência | Consequência | Próxima entrega |
|---|---|---|
| Política comercial sem lista delimitada de leads | Ativar pode alcançar todos os elegíveis do número | Grupo de piloto explícito e auditável |
| Saída manual pelo celular entra sem origem HUMANO | Cadência de lead novo pode continuar depois de atendimento no celular | Reconhecer intervenção humana com origem e momento corretos |
| Despachante não revalida etapa e ocorrência atuais do lead | Item adiado pode sair depois de avanço ou reagendamento | Revalidar estado e cancelar intenções obsoletas antes do envio |
| Falta validade temporal para pré-experimental | Lembrete pode chegar após começar a aula | Expiração por ocorrência/degrau |
| REAGENDAR gera evento sem estado persistente de espera | Próximo tick pode criar novos lembretes da agenda antiga | Pausa até reagendamento humano |
| Falta alerta operacional de check-in vencido | Recuperação de no-show depende de registro que pode nunca acontecer | Pendência com responsável, prazo e escalonamento |
| Conversas pertencem ao número | Cobertura de equipe/transferência exige trocar acesso ao número inteiro | Atribuição por conversa e fila de atendimento |
| Aceita comunicações e opt-out são estados separados | Desmarcar preferência no cadastro não necessariamente bloqueia envio | Política única de preferências por finalidade, consultada no envio |
| Remoção de opt-out apenas com alcance à conversa | Atendente pode reativar contato sem registrar motivo/evidência | Capacidade específica e evidência da nova autorização |
| Listas limitadas a 200 conversas/300 mensagens sem paginação histórica completa | Histórico mais antigo pode ficar inacessível na interface | Paginação e busca no servidor |

O [documento 32](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/32-comercial-c1-c2-piloto-baileys.md) já registra vários desses bloqueadores. Conferi os principais contra [cron comercial](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/cron-comercial.ts), [despachante](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/despachante.ts), [captura](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/captura.ts) e [schema de políticas](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/prisma/schema.prisma:1118). Não considerei itens documentados como automaticamente corrigidos.

A escola também precisa de atendimento acadêmico/pós-venda: hoje as finalidades dos números são VENDAS e COBRANCA. Acrescentar atendimento acadêmico com fila, responsável e permissões; permitir ao professor apenas comunicações relacionadas às suas atividades quando isso fizer parte da operação.

A política oficial de mensagens exige respeito a pedidos de interrupção e define o uso de templates fora da janela de atendimento de 24 horas. Por isso, permissões e preferências precisam participar da decisão final de envio. [Política oficial do WhatsApp](https://whatsappbusiness.com/policy/). Não houve homologação da conta Meta nem avaliação de conformidade legal nesta análise.

### 2.5 Online agora; presencial depois

Para a escola online, priorizar **aula agendada**, fuso, sala virtual, chamada, material, reposição e suporte. “Turma cadastrada” não basta para executar uma aula.

Para o presencial, o campo `online` é apenas um início de modelagem; o formulário de turma atual nem o inclui. Acrescentar, quando houver demanda concreta:

- Unidade e sala, capacidade e recursos.
- Reserva de sala e conflitos de professor/aluno.
- Modalidade de oferta por encontro: online, presencial ou híbrida.
- Calendário local, feriados e reposições.
- Check-in e procedimentos de retirada/autorização quando houver menores.

A unidade física deve ser independente de país/mercado comercial. Não é necessário dividir os dados atuais por país nem construir multiempresa apenas para permitir uma sala presencial.

## Parte 3 — Mapeamento de próximas funcionalidades

### 3.1 Backlog priorizado

P0 = primeira frente de estabilização; P1 = operação educacional online; P2 = eficiência e retenção; P3 = expansão condicionada à demanda. Tamanhos são relativos: P pequeno, M médio, G grande. Não representam prazo de entrega.

| ID | Prioridade | Entrega | Valor para a escola | Dependência | Tamanho | Critério de conclusão |
|---|---|---|---|---|---|---|
| F01 | P0 | Matriz de acesso aplicada no servidor | Equipe trabalha sem acesso indevido | Decidir campos/alçadas | M | AC-01 a AC-05 cobertos; páginas, ações, buscas e arquivos usam a mesma política |
| F02 | P0 | Alçadas de negociação e comissão | Evita preço/comissão fora da política | F01 | M | Matrícula e ajuste usam alçada comum; comissão do vendedor não vem livre do cliente |
| F03 | P0 | Correção de saldos e registros de recebimento | Indicadores confiáveis e conciliação futura | Regras atuais de baixa | M/G | Pagamento parcial reduz saldo; recebimento pertence à sua data; concorrência não perde valores |
| F04 | P0 | Cadências com estado e validade revalidados | Evita mensagens incoerentes | F01 + fila atual | M/G | Piloto limitado; nenhuma intenção obsoleta após mudança/reagendamento/assunção humana |
| F05 | P0 | Homologação e operação observável | Detecta falhas antes de ampliar equipe | F01–F04 | M | Testes críticos, restore, cron/health e procedimento de recuperação comprovados |
| F06 | P1 | Pendências e passagem de matrícula | Aluno vendido efetivamente começa a estudar | F01/F02 | M | Secretaria recebe fila de documentos, pagamento, turma e início; cada item tem responsável |
| F07 | P1 | Agenda de aulas e disponibilidade | Organiza operação online diária | Turmas + professores | G | Fuso/link, conflitos, cancelamento, substituição e reposição por encontro |
| F08 | P1 | Diário de aula e frequência | Escola passa a acompanhar a entrega | F01/F07 | M | Professor registra aula/presença apenas da sua turma; correções têm histórico |
| F09 | P1 | Nivelamento e avaliações por habilidade | Progressão pedagógica demonstrável | F08 + critérios da escola | G | Resultado por habilidade, regra de aprovação e exceção pedagógica auditada |
| F10 | P1 | Renovação e matrícula de aluno existente | Cresce receita sem duplicar cadastro | F06 + identidade existente | G | Nova matrícula reutiliza aluno; histórico preservado; alocações por curso quando necessário |
| F11 | P1 | Inbox por conversa e atendimento acadêmico | Equipe consegue compartilhar atendimento | F01/F04 | G | Assumir, transferir, encerrar, cobrir ausência e consultar histórico paginado |
| F12 | P1 | Preferências e responsáveis por finalidade | Comunicação chega à pessoa correta | F01/F11 | M | Cadastro e WhatsApp usam preferência coerente; pagador não é inferido de contato de emergência |
| F13 | P2 | Portal do aluno/responsável | Reduz solicitações repetidas | F07–F09/F12 | G | Agenda, acesso à aula, materiais e resultados; cobranças só para titular autorizado |
| F14 | P2 | Retenção e renovação assistidas | Identifica evasão e renovações esquecidas | F08/F10 | M | Faltas/ausência e fim de plano geram tarefa com dono, ação e resultado |
| F15 | P2 | Pagamentos integrados e conciliação | Reduz baixa manual | F03 + escolha por mercados | G | Webhook idempotente, conciliação, estorno e exceções; escolha de fornecedor em etapa própria |
| F16 | P2 | Contas a pagar e remuneração docente | Visão real do custo da escola | F03/F08 | G | Despesas categorizadas; apuração docente por aula/hora e resultado por turma |
| F17 | P2 | CRM de tarefas e métricas por coorte | Melhora gestão da equipe comercial | F06/F11 | M/G | SLA humano real; funil por período/origem; tarefas concluídas e motivos de perda consistentes |
| F18 | P2 | IA assistiva no atendimento | Poupa redação e organização | F01/F11/F12 | M/G | Resumo e rascunho com fonte/contexto; revisão humana; escopo igual ao usuário |
| F19 | P3 | Operação presencial/híbrida | Permite abrir unidade sem duplicar ERP | F07/F08 | G | Unidade/sala, reservas, capacidade, conflitos e encontro híbrido |
| F20 | P3 | Contratos corporativos B2B | Viabiliza vendas para empresas | F03/F10/F15 | G | Empresa, colaboradores, contrato, faturamento agregado e portal/relatório restrito do RH |

Não há necessidade de implementar todas essas frentes ao mesmo tempo. A ordem recomendada é **estabilizar acesso e dinheiro → fechar matrícula até primeira aula → registrar aprendizagem → renovar/reter → expandir canais e formatos**.

F04 pode avançar junto da estabilização financeira se houver capacidade técnica, mas automações de retenção dependem dos registros acadêmicos. F13 pode começar pequeno, mostrando apenas agenda, link de aula e solicitações, antes de incluir financeiro.

### 3.2 Três pacotes de entrega concretos

**Pacote A — equipe com acesso confiável**

- Fechar AC-01 a AC-05 e as alçadas de matrícula/comissão.
- Definir política de desconto, autoaprovação e campos por papel.
- Ajustar vínculos financeiros de responsáveis e transferência de carteira.
- Corrigir indicadores com recebimento parcial.
- Cobrir casos negativos por ação direta e dados entregues ao cliente.

**Pacote B — escola online operável**

- Pendências de matrícula e aluno existente.
- Agenda, fuso, sala virtual, disponibilidade e experimental.
- Diário e frequência.
- Home de professor com aulas do dia; Home de secretaria com pendências; Home pedagógica com exceções; Home financeira com ações.
- Piloto WhatsApp restrito com correções de estado/validade e encaminhamento humano.

**Pacote C — aprendizagem e receita recorrente**

- Nivelamento, avaliação por habilidade e progressão aprovada.
- Renovação, prevenção de evasão e comunicação acadêmica.
- Portal mínimo do aluno/responsável.
- Integração de recebimentos e controle de despesas/docentes.
- IA assistiva depois que contexto, permissões e tarefas estiverem consistentes.

### 3.3 Decisões de negócio que mudam o desenho

Estas são decisões para refinar a implementação, não impedimentos à análise entregue:

1. A secretaria deve receber pagamentos ou apenas conferir comprovantes e encaminhar?
2. O gerente comercial precisa do financeiro global ou apenas receita/comissões ligadas ao comercial?
3. O professor deve acessar telefone direto do aluno/responsável ou usar comunicação mediada pela escola?
4. Um aluno poderá cursar mais de um idioma/modalidade simultaneamente?
5. A matrícula depende de contrato assinado, além da taxa? Hoje o código e parte da documentação divergem.
6. Qual é o público inicial: adultos, crianças/adolescentes, empresas, ou combinação? Isso altera responsáveis e portal.
7. Quais países/moedas e plataforma de aula estarão no primeiro uso? Isso orienta calendário e integrações, sem exigir escolha antecipada de fornecedor.
8. O atendimento usa um número por vendedor ou um número compartilhado? A resposta define a urgência da atribuição por conversa.

### 3.4 Direção técnica

Preservar o monólito modular atual: já há separação útil entre comercial, matrícula, alunos, financeiro e WhatsApp. A prioridade é compartilhar políticas de acesso e regras de negócio, não migrar para microserviços.

Para as próximas entidades, favorecer:

- **Aluno/pessoa reutilizável → múltiplas matrículas → alocações por curso → encontros/aulas.**
- **Recebimento individual → alocações em cobranças**, preservando auditoria e saldo.
- **Contato → conversas → atribuição de atendimento**, com permissões compatíveis com leads e responsáveis.
- **Tarefa operacional → dono/prazo/estado → evento de conclusão**, atendendo comercial, secretaria e retenção.

Manter Evento como trilha de auditoria; dados usados diariamente em relatórios e filas devem ter estrutura própria quando o volume e as regras justificarem. Reconciliar README, roadmap, permissões e regras de ativação com o código a cada entrega.
