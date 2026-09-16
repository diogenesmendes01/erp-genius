# Referências de mercado para decidir escopos e permissões

Pesquisa em documentação oficial, consultada em 07/09/2026. **As propostas para a escola foram aprovadas pelo usuário em 07/09/2026 e consolidadas no [doc 36](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/36-politica-de-acesso-aprovada.md).** O texto abaixo preserva a pesquisa e a formulação da proposta. Aprovação de produto não significa implementação no ERP Genius. Complementa os diagnósticos 33/34 sem modificar suas evidências.

As fontes comprovam escolhas de arquitetura, recursos e alguns padrões de configuração dos fornecedores. Não comprovam quais configurações cada instituição cliente adotou nem que todos os caminhos desses produtos foram auditados. As recomendações para a escola são nossa síntese, explicitamente separada dos fatos dos fornecedores.

## 1. Informação financeira

**Decisões documentadas.** O TOTVS Educacional exige permissões do perfil em Financeiro/Contábil para acessar o financeiro da Central do Aluno. O PowerSchool oferece acesso completo, somente leitura ou nenhum acesso por campo; sua documentação reconhece caminhos que precisam de proteção adicional por página. O Salesforce recomenda controlar acesso por segurança de campo, usando layout para organização. Blackbaud permite controlar acesso a relatórios por papel ou usuário.

Fontes: [TOTVS — financeiro](https://centraldeatendimento.totvs.com/hc/pt-br/articles/5321155768599-TOTVS-Educacional-Educacional-EDU-Como-liberar-o-acesso-ao-menu-Financeiro-da-Central-do-Aluno), [PowerSchool — campos](https://ps.powerschool-docs.com/pssis-admin/latest/field-level-security), [Salesforce — campos e layout](https://help.salesforce.com/s/articleView?id=platform.managing_page_layouts_and_field-level_security.htm&language=en_US&type=5), [Blackbaud — relatórios](https://webfiles-sc1.blackbaud.com/files/support/helpfiles/education/k12/full-help/content/bb-core-reports-access.html).

**Proposta para a escola.** Acesso ao cadastro do aluno não concede automaticamente acesso a todas as suas informações financeiras.

| Papel | Informação financeira proposta | Limite |
|---|---|---|
| Vendedor | Preços autorizados, negociação e confirmação do pagamento inicial das próprias vendas; própria comissão | Sem carteira de inadimplência geral, caixa, custo/margem interna ou comissão de colegas; não define sua comissão |
| Gerente comercial | Vendas, descontos, conversão, receita comercial e comissões da equipe | Sem despesas, contas bancárias ou controle de recebimentos por decorrência do cargo |
| Professor | Nenhum valor, dívida ou histórico de cobrança | Recebe agenda e instrução operacional autorizada para suas aulas |
| Gerente pedagógico | Situação operacional da matrícula necessária à alocação/continuidade | Sem valores e histórico de dívida por padrão; detalhes acadêmicos mantêm escopo próprio |
| Secretaria | Contrato, parcelas, vencimentos e situação de pagamento para atendimento individual | Sem caixa global, despesas ou comissões; registrar recebimento exige capacidade adicional de caixa |
| Financeiro | Cobranças, recebimentos, ajustes e conciliação no seu escopo | Aprovar desconto, estornar e pagar são capacidades distintas, com alçadas |
| Administração/direção | Visão consolidada e decisões autorizadas | Acesso amplo não remove a exigência de segunda pessoa quando o fluxo a requer |

Uma pessoa que acumula funções pode receber permissões adicionais. Essa concessão deve ser explícita. Exportações, arquivos e buscas precisam respeitar o mesmo escopo da consulta.

## 2. Transferência de turma e avanço de nível

**Decisão documentada.** Oracle PeopleSoft Campus Solutions separa operações de matrícula de permissões para ignorar pré-requisitos, lotação, conflitos de horário, bloqueios e prazos. Os acessos podem diferir entre grupos administrativos. Isso permite distribuir a operação sem dar a todos o direito de criar exceções acadêmicas. A fonte não impõe a mesma divisão de cargos a todas as escolas.

Fonte: [Oracle — Enrollment Access IDs](https://docs.oracle.com/en/applications/peoplesoft/campus-solutions/9.2.038/campus-solutions-application-fundamentals/setting-enrollment-access-ids.html).

**Proposta para a escola.** Secretaria transfere entre turmas equivalentes, com mesmo idioma/nível, vaga e horário compatível. Progressão regular pode seguir uma regra pedagógica aprovada, quando essa regra estiver implementada. Salto de nível, dispensa de avaliação, alteração retroativa ou exceção de pré-requisito exigem decisão da gerência pedagógica/direção; professor registra avaliação/parecer e secretaria executa. Mudança de preço ou contrato também passa pela política comercial/financeira correspondente.

Exemplos: A1 terça → A1 quinta pode ser rotina; A1 → B2 exige decisão acadêmica; regular → particular exige verificar os efeitos no contrato. Registrar motivo, origem/destino, executor e aprovador, quando aplicável.

## 3. Transferência do lead e histórico de WhatsApp

**Decisões documentadas.** Salesforce remove compartilhamentos manuais quando muda o proprietário; hierarquia, equipes e outras regras ainda podem conceder acesso. HubSpot configura acesso à inbox por usuários/equipes e permite atribuir a conversa de WhatsApp a outro atendente. Portanto, atribuição de atendimento e autorização de leitura são controles separados; trocar atendente não equivale, por si só, a tornar o histórico invisível aos demais membros da inbox.

Fontes: [Salesforce — compartilhamento](https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-sharing-architecture), [HubSpot — acesso à inbox](https://knowledge.hubspot.com/inbox/set-up-the-conversations-inbox), [HubSpot — WhatsApp e reatribuição](https://knowledge.hubspot.com/inbox/connect-whatsapp-to-the-conversations-inbox).

**Proposta para a escola.** Manter proprietário comercial, responsável pelo atendimento e equipe autorizada como relações distintas. Transferir a carteira deve atualizar explicitamente as conversas comerciais abertas e recalcular acesso. Novo responsável recebe o histórico necessário daquele atendimento; antigo responsável perde acesso operacional por padrão, salvo colaboração expressa, de preferência temporária. Gerente mantém supervisão da sua equipe.

Preservar autoria das mensagens/eventos e atribuição econômica da venda. Comissão histórica não muda automaticamente ao trocar o dono atual. Histórico de cobrança continua restrito ao atendimento financeiro; contexto pedagógico sensível não deve ser aberto em bloco para vendas. Uma conversa já compartilhada não perde suas cópias externas quando o ERP revoga acesso.

Para começar, filas de **Comercial, Secretaria e Financeiro**, com encaminhamento explícito entre elas, são suficientes. Um único número institucional pode exigir roteamento interno; o número não deve ser a única chave de autorização. Atendimento compartilhado por equipe é uma alternativa válida à carteira estrita, mas precisa ser uma decisão consciente.

## 4. Acúmulo de papéis e autoaprovação

**Decisões documentadas.** Dynamics 365 Finance permite proibir aprovação pelo solicitante e configurar aprovador final. A opção de proibir vem **desativada por padrão**. Também existem regras de segregação de funções e validação de conflitos. PowerSchool soma permissões de múltiplos papéis, prevalecendo o maior acesso concedido; isso demonstra por que combinar papéis merece revisão própria.

Fontes: [Dynamics — autoaprovação](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/fin-ops/organization-administration/configure-approval-process-workflow), [Dynamics — segregação](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/fin-ops/sysadmin/set-up-segregation-duties), [PowerSchool — papéis cumulativos](https://ps.powerschool-docs.com/pssis-admin/latest/field-level-security).

**Proposta para a escola.** Acúmulo de papéis amplia tarefas, mas não cria uma segunda pessoa. Desconto acima da alçada, perdão, estorno e exceções de comissão devem impedir aprovação pelo próprio solicitante, mesmo que ele também seja gerente. Dentro da alçada, a política pode autorizar diretamente a operação; isso não deve aparecer como aprovação independente.

Em equipe muito pequena, prever aprovador substituto e delegação com prazo. Se a direção optar por permitir intervenção excepcional do proprietário sem segunda pessoa, registrá-la como **exceção administrativa**, com motivo e revisão posterior; ela não satisfaz uma exigência de dupla aprovação. Não conceder a si próprio um novo limite para aprovar pedido já aberto.

## 5. Configurações e administração

**Decisões documentadas.** HubSpot separa gestão de usuários, equipes, padrões da conta e permissões especiais de Super Admin. Microsoft distingue administração de ambiente, criação/customização e acesso aos dados de negócio. Blackbaud concede tarefas específicas para gerenciar acesso e relatórios. Nenhuma dessas referências obriga a concentrar todas as configurações operacionais no administrador geral.

Fontes: [HubSpot — permissões](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide), [Microsoft — escopos de administração](https://learn.microsoft.com/en-us/power-platform/admin/database-security), [Blackbaud — tarefas de relatórios](https://webfiles-sc1.blackbaud.com/files/support/helpfiles/education/k12/full-help/content/bb-core-reports-access.html).

**Proposta para a escola.** Manter sete papéis principais e delegar capacidades por domínio, sem criar dezenas de cargos agora.

| Configuração | Quem altera, por proposta | Quem consulta |
|---|---|---|
| Usuários, papéis, alçadas e acesso a equipes | Administrador autorizado | Gestão pertinente; demais apenas diretório necessário |
| Credenciais, integrações, números e chaves | Administrador técnico autorizado | Equipes veem situação operacional; segredos não ficam disponíveis |
| Países, moedas contratuais e ativação de mercados | Direção/administração | Equipes veem mercados e opções aprovados necessários ao trabalho |
| Currículo, níveis, critérios de progressão e avaliações | Gerência pedagógica | Professores/secretaria; comercial vê catálogo de venda |
| Preços, política de descontos e comissões | Direção; financeiro/comercial com delegação e alçada | Vendedor vê tabela negociável e própria comissão; demais conforme função |
| Agenda, turmas e alocação | Pedagógico/secretaria conforme rotina | Professores veem suas turmas; comercial vê disponibilidade necessária |
| Textos e fluxos de atendimento | Gestão da respectiva área | Atendentes da área; ativação de automação obedece controles próprios |

Consultar uma tabela aprovada não exige acessar a tela de administração que a altera. Mudanças de regra devem ter vigência e histórico; alterações futuras não podem reescrever silenciosamente contratos já firmados.

## Decisões sugeridas para formalização

1. Adotar a projeção financeira por função da seção 1, com caixa da secretaria como capacidade separada.
2. Autorizar transferência equivalente pela secretaria; submeter exceções acadêmicas à gerência pedagógica.
3. Preservar histórico, recalcular acesso na transferência e separar conversa comercial, financeira e acadêmica.
4. Impedir autoaprovação nas operações que exigem uma segunda pessoa; documentar qualquer exceção de direção.
5. Centralizar segurança/integrações e delegar configurações operacionais por domínio.

Antes de aprovar a implementação, demonstrar essas decisões em lista, ficha, busca, arquivo, exportação e ação direta; incluir revogação, acúmulo de papéis e mudança de responsável. As fontes de mercado ajudam a escolher a política, mas não substituem a verificação do nosso código.
